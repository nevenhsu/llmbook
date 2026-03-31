"use client";

import { useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import type {
  AgentLabCandidateStage,
  AgentLabModeState,
  AgentLabPageProps,
  AgentLabSaveTaskOutcome,
  AgentLabSourceMode,
  AgentLabTaskRow,
} from "../types";

function cloneModes(modes: Record<AgentLabSourceMode, AgentLabModeState>) {
  return {
    public: structuredClone(modes.public),
    notification: structuredClone(modes.notification),
  } satisfies Record<AgentLabSourceMode, AgentLabModeState>;
}

function summarizeRows(rows: AgentLabTaskRow[]) {
  return {
    attempted: rows.filter((row) => row.saveState !== "idle").length,
    succeeded: rows.filter((row) => row.saveState === "success").length,
    failed: rows.filter((row) => row.saveState === "failed").length,
  };
}

function applySaveOutcome(row: AgentLabTaskRow, outcome: AgentLabSaveTaskOutcome): AgentLabTaskRow {
  const inserted = outcome.inserted;
  return {
    ...row,
    taskId: outcome.taskId ?? row.taskId,
    status: outcome.status,
    saveState: inserted ? "success" : "failed",
    errorMessage: outcome.errorMessage ?? outcome.skipReason,
    saveResult: {
      candidateIndex: row.candidateIndex,
      inserted,
      skipReason: outcome.skipReason,
      taskId: outcome.taskId,
    },
    actions: {
      canSave: !inserted,
    },
  };
}

function buildToastMessage(rows: AgentLabTaskRow[]) {
  const summary = summarizeRows(rows);
  if (summary.failed > 0) {
    return `${summary.succeeded} saved, ${summary.failed} failed.`;
  }
  return `${summary.succeeded} task${summary.succeeded === 1 ? "" : "s"} saved.`;
}

export function useAgentLabRunner(props: AgentLabPageProps) {
  const [sourceMode, setSourceMode] = useState<AgentLabSourceMode>(props.initialSourceMode);
  const [modelId, setModelId] = useState(props.initialModelId);
  const [modeStates, setModeStates] = useState(() => cloneModes(props.initialModes));
  const modeStatesRef = useRef(modeStates);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [promptModal, setPromptModal] = useState<{
    title: string;
    description: string;
    prompt: string | null;
    modelPayload: unknown;
    inputData: unknown;
  } | null>(null);
  const [dataModal, setDataModal] = useState<{
    title: string;
    description: string;
    data: unknown;
  } | null>(null);
  const [selectorBusy, setSelectorBusy] = useState(false);
  const [candidateBusy, setCandidateBusy] = useState(false);

  const modeState = modeStates[sourceMode];

  const canRunCandidate = modeState.selectorStage.status === "success";

  function updateModeStates(
    updater: (
      current: Record<AgentLabSourceMode, AgentLabModeState>,
    ) => Record<AgentLabSourceMode, AgentLabModeState>,
  ) {
    setModeStates((current) => {
      const next = updater(current);
      modeStatesRef.current = next;
      return next;
    });
  }

  async function runSelector() {
    setSelectorBusy(true);
    try {
      const selectorStage = await props.onRunSelector({
        sourceMode,
        modelId,
      });
      updateModeStates((current) => ({
        ...current,
        [sourceMode]: {
          ...current[sourceMode],
          selectorStage,
          candidateStage: {
            status: sourceMode === "notification" ? "auto-routed" : "idle",
            prompt: null,
            inputData: null,
            outputData: null,
            selectedReferences: [],
            rows: [],
          },
          taskStage: {
            rows: [],
            summary: {
              attempted: 0,
              succeeded: 0,
              failed: 0,
            },
            toastMessage: null,
          },
        },
      }));
    } finally {
      setSelectorBusy(false);
    }
  }

  async function runCandidate() {
    if (modeState.selectorStage.status !== "success") {
      return;
    }

    setCandidateBusy(true);
    try {
      const result = await props.onRunCandidate({
        sourceMode,
        modelId,
        selectorStage: modeState.selectorStage,
      });

      updateModeStates((current) => ({
        ...current,
        [sourceMode]: {
          ...current[sourceMode],
          candidateStage: result.candidateStage,
          taskStage: {
            rows: result.taskRows,
            summary: summarizeRows(result.taskRows),
            toastMessage: null,
          },
        },
      }));
    } finally {
      setCandidateBusy(false);
    }
  }

  async function saveTaskRow(rowIndex: number, announce = true) {
    const row = modeStatesRef.current[sourceMode].taskStage.rows[rowIndex];
    if (!row || !row.actions.canSave) {
      return;
    }

    updateModeStates((current) => {
      const rows = current[sourceMode].taskStage.rows.map((item, index) =>
        index === rowIndex ? { ...item, saveState: "saving" as const } : item,
      );
      return {
        ...current,
        [sourceMode]: {
          ...current[sourceMode],
          taskStage: {
            ...current[sourceMode].taskStage,
            rows,
            summary: summarizeRows(rows),
          },
        },
      };
    });

    try {
      const outcome = await props.onSaveTask({
        sourceMode,
        modelId,
        row,
        rowIndex,
      });
      updateModeStates((current) => {
        const rows = current[sourceMode].taskStage.rows.map((item, index) =>
          index === rowIndex ? applySaveOutcome(item, outcome) : item,
        );
        return {
          ...current,
          [sourceMode]: {
            ...current[sourceMode],
            taskStage: {
              rows,
              summary: summarizeRows(rows),
              toastMessage: buildToastMessage(rows),
            },
          },
        };
      });
      if (announce) {
        if (outcome.inserted) {
          toast.success("Task saved.");
        } else {
          toast.error(outcome.errorMessage ?? outcome.skipReason ?? "Task save failed.");
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Task save failed.";
      updateModeStates((current) => {
        const rows = current[sourceMode].taskStage.rows.map((item, index) =>
          index === rowIndex
            ? {
                ...item,
                saveState: "failed" as const,
                errorMessage: message,
              }
            : item,
        );
        return {
          ...current,
          [sourceMode]: {
            ...current[sourceMode],
            taskStage: {
              rows,
              summary: summarizeRows(rows),
              toastMessage: buildToastMessage(rows),
            },
          },
        };
      });
      if (announce) {
        toast.error(message);
      }
    }
  }

  async function saveAllTasks() {
    const rows = modeStatesRef.current[sourceMode].taskStage.rows;
    for (let index = 0; index < rows.length; index += 1) {
      if (!modeStatesRef.current[sourceMode].taskStage.rows[index]?.actions.canSave) {
        continue;
      }
      await saveTaskRow(index, false);
    }

    const nextRows = modeStatesRef.current[sourceMode].taskStage.rows;
    const message = buildToastMessage(nextRows);
    if (nextRows.some((row) => row.saveState === "failed")) {
      toast.error(message);
    } else if (nextRows.some((row) => row.saveState === "success")) {
      toast.success(message);
    }
  }

  const api = useMemo(
    () => ({
      sourceMode,
      setSourceMode,
      modelId,
      setModelId,
      modeState,
      groupModalOpen,
      setGroupModalOpen,
      promptModal,
      setPromptModal,
      dataModal,
      setDataModal,
      selectorBusy,
      candidateBusy,
      canRunCandidate,
      runSelector,
      runCandidate,
      saveTaskRow,
      saveAllTasks,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sourceMode,
      modelId,
      modeState,
      groupModalOpen,
      promptModal,
      dataModal,
      selectorBusy,
      candidateBusy,
      canRunCandidate,
    ],
  );

  return api;
}
