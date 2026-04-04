"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import type {
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

function buildIdleCandidateStage(input: {
  currentCandidateStage: AgentLabModeState["candidateStage"];
  opportunities: AgentLabModeState["opportunities"];
}) {
  return {
    ...input.currentCandidateStage,
    status: "idle" as const,
    inputData: {
      selected_opportunities: input.opportunities
        .filter((row) => row.selected)
        .map((row) => ({
          opportunity_key: row.opportunityKey,
          content_type:
            row.source === "public-post"
              ? "post"
              : row.source === "notification"
                ? "mention"
                : "comment",
          summary: row.content,
        })),
      speaker_batch: input.currentCandidateStage.rows.map((row) => row.referenceName),
    },
    outputData: null,
    rows: input.currentCandidateStage.rows.map((row) => ({
      ...row,
      opportunityKey: null,
      errorMessage: null,
    })),
  };
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
    sections?: Array<{
      title: string;
      data: unknown;
    }>;
  } | null>(null);
  const [selectorBusy, setSelectorBusy] = useState(false);
  const [candidateBusy, setCandidateBusy] = useState(false);
  const [groupSaveBusy, setGroupSaveBusy] = useState(false);

  const modeState = modeStates[sourceMode];

  useEffect(() => {
    const nextModes = cloneModes(props.initialModes);
    modeStatesRef.current = nextModes;
    setModeStates(nextModes);
  }, [props.initialModes]);

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
        personaGroup: {
          batchSize: modeState.personaGroup.batchSize,
          groupIndex: modeState.personaGroup.groupIndex,
        },
        currentOpportunities: modeState.opportunities,
        onProgress: (partial) => {
          updateModeStates((current) => ({
            ...current,
            [sourceMode]: {
              ...current[sourceMode],
              opportunities: partial.rows,
              selectorStage: partial,
              candidateStage:
                sourceMode === "notification"
                  ? current[sourceMode].candidateStage
                  : buildIdleCandidateStage({
                      currentCandidateStage: current[sourceMode].candidateStage,
                      opportunities: partial.rows,
                    }),
              taskStage:
                sourceMode === "notification"
                  ? current[sourceMode].taskStage
                  : {
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
        },
      });
      const notificationCandidateResult =
        sourceMode === "notification"
          ? await props.onRunCandidate({
              sourceMode,
              modelId,
              personaGroup: {
                batchSize: modeState.personaGroup.batchSize,
                groupIndex: modeState.personaGroup.groupIndex,
              },
              selectorStage,
              currentCandidateStage: modeStatesRef.current[sourceMode].candidateStage,
              currentTaskRows: modeStatesRef.current[sourceMode].taskStage.rows,
            })
          : null;
      updateModeStates((current) => ({
        ...current,
        [sourceMode]: {
          ...current[sourceMode],
          opportunities: selectorStage.rows,
          selectorStage,
          candidateStage:
            notificationCandidateResult?.candidateStage ??
            buildIdleCandidateStage({
              currentCandidateStage: current[sourceMode].candidateStage,
              opportunities: selectorStage.rows,
            }),
          taskStage: notificationCandidateResult
            ? {
                rows: notificationCandidateResult.taskRows,
                summary: summarizeRows(notificationCandidateResult.taskRows),
                toastMessage: null,
              }
            : {
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
        personaGroup: {
          batchSize: modeState.personaGroup.batchSize,
          groupIndex: modeState.personaGroup.groupIndex,
        },
        selectorStage: modeState.selectorStage,
        currentCandidateStage: modeState.candidateStage,
        currentTaskRows: modeState.taskStage.rows,
        onProgress: (partial) => {
          updateModeStates((current) => ({
            ...current,
            [sourceMode]: {
              ...current[sourceMode],
              candidateStage: partial.candidateStage,
              taskStage: {
                rows: partial.taskRows,
                summary: summarizeRows(partial.taskRows),
                toastMessage: null,
              },
            },
          }));
        },
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

  async function savePersonaGroup(input: { batchSize: number; groupIndex: number }) {
    setGroupSaveBusy(true);
    try {
      const currentState = modeStatesRef.current[sourceMode];
      const result = await props.onSavePersonaGroup({
        sourceMode,
        modelId,
        personaGroup: input,
        selectorStage: currentState.selectorStage,
      });

      updateModeStates((current) => ({
        ...current,
        [sourceMode]: {
          ...current[sourceMode],
          personaGroup: result.personaGroup,
          candidateStage: result.candidateStage,
          taskStage: {
            rows: result.taskRows,
            summary: summarizeRows(result.taskRows),
            toastMessage: null,
          },
        },
      }));
      setGroupModalOpen(false);
      toast.success("Reference group updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reference group update failed.";
      toast.error(message);
    } finally {
      setGroupSaveBusy(false);
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
      groupSaveBusy,
      canRunCandidate,
      runSelector,
      runCandidate,
      saveTaskRow,
      saveAllTasks,
      savePersonaGroup,
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
      groupSaveBusy,
      canRunCandidate,
    ],
  );

  return api;
}
