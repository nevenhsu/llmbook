"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import type {
  AiModelConfig,
  PersonaGenerationStructured,
} from "@/lib/ai/admin/control-plane-contract";
import type {
  PersonaBatchActionType,
  PersonaBatchRow,
  PersonaBatchRowTask,
} from "@/lib/ai/admin/persona-batch-contract";
import { runChunkedQueue } from "@/lib/ai/admin/persona-batch-queue";
import { formatGeneratedPersonaDisplayName } from "@/lib/ai/admin/persona-display-name";
import type { PersonaBatchGenerationController } from "@/hooks/admin/usePersonaBatchGeneration";
import { derivePersonaUsername } from "@/lib/username-validation";
import { mockPersonaGenerationPreview } from "@/lib/ai/admin/persona-generation-preview-mock";
import { buildPersonaReferenceMatchKey } from "@/lib/ai/admin/persona-reference-normalization";
import { PersonaBatchPage } from "./PersonaBatchPage";

const DEFAULT_CHUNK_SIZE = 5;
const MOCK_TASK_DURATION_MS = 1000;

const previewModels: AiModelConfig[] = [
  {
    id: "model-1",
    providerId: "provider-1",
    modelKey: "grok-4-1-fast-reasoning",
    displayName: "Grok 4.1 Fast Reasoning",
    capability: "text_generation",
    status: "active",
    testStatus: "success",
    lifecycleStatus: "active",
    displayOrder: 1,
    lastErrorKind: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastErrorAt: null,
    supportsInput: true,
    supportsImageInputPrompt: false,
    supportsOutput: true,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    metadata: {},
    updatedAt: "2026-03-22T00:00:00.000Z",
  },
];

function cloneStructured(structured: PersonaGenerationStructured): PersonaGenerationStructured {
  return JSON.parse(JSON.stringify(structured)) as PersonaGenerationStructured;
}

function buildInitialRows(): PersonaBatchGenerationController["rows"] {
  const generatedDisplayName = formatGeneratedPersonaDisplayName(
    mockPersonaGenerationPreview.structured.persona.display_name,
  );
  return [
    {
      rowId: "row-1",
      referenceName: "Anthony Bourdain",
      dbReferenceExists: false,
      contextPrompt:
        "A globe-trotting storyteller who opens with sensory snapshots and attacks shallow taste with lived authority.",
      displayName: generatedDisplayName,
      username: derivePersonaUsername(generatedDisplayName),
      personaData: cloneStructured(mockPersonaGenerationPreview.structured),
      saved: true,
      savedPersonaId: "persona-1",
      promptChangedSinceGenerate: false,
      referenceCheckStatus: "new",
      activeTask: null,
      activeElapsedSeconds: 0,
      lastCompletedTask: "save",
      lastCompletedElapsedSeconds: 6,
      latestError: null,
    },
    {
      rowId: "row-2",
      referenceName: "Hayao Miyazaki",
      dbReferenceExists: true,
      contextPrompt: "",
      displayName: "",
      username: "",
      personaData: null,
      saved: false,
      savedPersonaId: null,
      promptChangedSinceGenerate: false,
      referenceCheckStatus: "duplicate",
      activeTask: null,
      activeElapsedSeconds: 0,
      lastCompletedTask: null,
      lastCompletedElapsedSeconds: 0,
      latestError: {
        type: "check",
        message: "Reference already exists in the database.",
        apiUrl: "/api/admin/ai/persona-references/check",
        payload: { names: ["Hayao Miyazaki"] },
        rawResponse: {
          items: [
            {
              input: "Hayao Miyazaki",
              matchKey: "hayaomiyazaki",
              romanizedName: "Hayao Miyazaki",
              exists: true,
            },
          ],
        },
        createdAt: "2026-03-22T00:00:00.000Z",
      },
    },
    {
      rowId: "row-3",
      referenceName: "Ursula K. Le Guin",
      dbReferenceExists: false,
      contextPrompt:
        "A speculative voice that treats social systems as worlds to be pressure-tested.",
      displayName: "",
      username: "",
      personaData: null,
      saved: false,
      savedPersonaId: null,
      promptChangedSinceGenerate: false,
      referenceCheckStatus: "new",
      activeTask: null,
      activeElapsedSeconds: 0,
      lastCompletedTask: null,
      lastCompletedElapsedSeconds: 0,
      latestError: null,
    },
  ];
}

function waitForPreviewTask(durationMs = MOCK_TASK_DURATION_MS): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function countPreviewDuplicateRows(rows: PersonaBatchRow[]): number {
  return rows.filter((row) => row.referenceCheckStatus === "duplicate").length;
}

function isEligibleForBulkAction(
  row: PersonaBatchRow | undefined,
  task: Exclude<PersonaBatchActionType, "check">,
) {
  if (!row || row.activeTask !== null || row.referenceCheckStatus !== "new") {
    return false;
  }
  if (task === "prompt") {
    return row.contextPrompt.trim().length === 0;
  }
  if (task === "generate") {
    return row.contextPrompt.trim().length > 0 && row.personaData === null;
  }
  return row.personaData !== null && !row.saved;
}

export function PersonaBatchPreviewMockPage() {
  const [resetSignal, setResetSignal] = useState(0);
  const [modelId, setModelId] = useState("model-1");
  const [referenceInput, setReferenceInput] = useState("Octavia Butler");
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK_SIZE);
  const [addLoading, setAddLoading] = useState(false);
  const [addElapsedSeconds, setAddElapsedSeconds] = useState(0);
  const [addLastCompletedElapsedSeconds, setAddLastCompletedElapsedSeconds] = useState<
    number | null
  >(null);
  const [addLastCompletedAddedCount, setAddLastCompletedAddedCount] = useState<number | null>(null);
  const [addLastCompletedDuplicateCount, setAddLastCompletedDuplicateCount] = useState<
    number | null
  >(null);
  const [bulkTask, setBulkTask] = useState<PersonaBatchGenerationController["bulkTask"]>(null);
  const [bulkElapsedSeconds, setBulkElapsedSeconds] = useState(0);
  const [bulkPausedTask, setBulkPausedTask] =
    useState<PersonaBatchGenerationController["bulkPausedTask"]>(null);
  const [bulkPausedElapsedSeconds, setBulkPausedElapsedSeconds] = useState(0);
  const [bulkPauseRequested, setBulkPauseRequested] = useState(false);
  const [bulkLastCompletedTask, setBulkLastCompletedTask] =
    useState<PersonaBatchGenerationController["bulkLastCompletedTask"]>("generate");
  const [bulkLastElapsedSeconds, setBulkLastElapsedSeconds] = useState(31);
  const [autoAdvanceBulkActions, setAutoAdvanceBulkActions] = useState(true);
  const [rows, setRows] = useState<PersonaBatchGenerationController["rows"]>(buildInitialRows);

  const rowCounterRef = useRef(4);
  const rowsRef = useRef<PersonaBatchGenerationController["rows"]>(rows);
  const rowTaskMetaRef = useRef<Record<string, { task: PersonaBatchRowTask; startedAt: number }>>(
    {},
  );
  const bulkTaskMetaRef = useRef<{
    task: Exclude<PersonaBatchActionType, "check">;
    startedAt: number;
  } | null>(null);
  const bulkPauseRequestedRef = useRef(false);
  const bulkPausedQueueRef = useRef<{
    task: Exclude<PersonaBatchActionType, "check">;
  } | null>(null);
  const autoAdvanceBulkActionsRef = useRef(true);
  const previewRunIdRef = useRef(0);
  const addFinishTimerRef = useRef<number | null>(null);
  const addStartedAtRef = useRef<number | null>(null);

  const commitRows = useCallback(
    (
      updater:
        | PersonaBatchGenerationController["rows"]
        | ((
            current: PersonaBatchGenerationController["rows"],
          ) => PersonaBatchGenerationController["rows"]),
    ) => {
      const next = typeof updater === "function" ? updater(rowsRef.current) : updater;
      rowsRef.current = next;
      setRows(next);
    },
    [],
  );

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const setAutoAdvanceBulkActionsValue = useCallback((checked: boolean) => {
    autoAdvanceBulkActionsRef.current = checked;
    setAutoAdvanceBulkActions(checked);
  }, []);

  const clearAddTimer = useCallback(() => {
    if (addFinishTimerRef.current !== null) {
      window.clearTimeout(addFinishTimerRef.current);
      addFinishTimerRef.current = null;
    }
    addStartedAtRef.current = null;
  }, []);

  const clearBulkPausedState = useCallback(() => {
    bulkPauseRequestedRef.current = false;
    bulkPausedQueueRef.current = null;
    setBulkPauseRequested(false);
    setBulkPausedTask(null);
    setBulkPausedElapsedSeconds(0);
  }, []);

  const hasAnyRowTask = rows.some((row) => row.activeTask !== null);
  const anyApiActive = addLoading || bulkTask !== null || hasAnyRowTask;

  useEffect(
    () => () => {
      previewRunIdRef.current += 1;
      clearAddTimer();
    },
    [clearAddTimer],
  );

  useEffect(() => {
    if (!anyApiActive) {
      return;
    }

    const intervalId = window.setInterval(() => {
      commitRows((current) =>
        current.map((row) => {
          const meta = rowTaskMetaRef.current[row.rowId];
          if (!meta) {
            return row.activeElapsedSeconds === 0 ? row : { ...row, activeElapsedSeconds: 0 };
          }
          const nextElapsed = Math.max(0, Math.floor((Date.now() - meta.startedAt) / 1000));
          return nextElapsed === row.activeElapsedSeconds
            ? row
            : { ...row, activeElapsedSeconds: nextElapsed };
        }),
      );

      const bulkMeta = bulkTaskMetaRef.current;
      if (!bulkMeta) {
        setBulkElapsedSeconds((current) => (current === 0 ? current : 0));
      } else {
        const nextElapsed = Math.max(0, Math.floor((Date.now() - bulkMeta.startedAt) / 1000));
        setBulkElapsedSeconds((current) => (current === nextElapsed ? current : nextElapsed));
      }

      const addStartedAt = addStartedAtRef.current;
      if (addStartedAt === null) {
        setAddElapsedSeconds((current) => (current === 0 ? current : 0));
      } else {
        const nextElapsed = Math.max(0, Math.floor((Date.now() - addStartedAt) / 1000));
        setAddElapsedSeconds((current) => (current === nextElapsed ? current : nextElapsed));
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [anyApiActive, commitRows]);

  const markRowTaskStarted = useCallback(
    (rowId: string, task: PersonaBatchRowTask) => {
      rowTaskMetaRef.current[rowId] = { task, startedAt: Date.now() };
      commitRows((current) =>
        current.map((row) =>
          row.rowId === rowId ? { ...row, activeTask: task, activeElapsedSeconds: 0 } : row,
        ),
      );
    },
    [commitRows],
  );

  const markRowTaskFinished = useCallback(
    (rowId: string) => {
      const meta = rowTaskMetaRef.current[rowId];
      const elapsedSeconds = meta
        ? Math.max(0, Math.floor((Date.now() - meta.startedAt) / 1000))
        : 0;
      delete rowTaskMetaRef.current[rowId];
      commitRows((current) =>
        current.map((row) =>
          row.rowId === rowId
            ? {
                ...row,
                activeTask: null,
                activeElapsedSeconds: 0,
                lastCompletedTask: meta?.task ?? row.lastCompletedTask,
                lastCompletedElapsedSeconds: elapsedSeconds,
              }
            : row,
        ),
      );
    },
    [commitRows],
  );

  const canRunRowTask = useCallback(
    (
      row: PersonaBatchRow | undefined,
      task: PersonaBatchRowTask,
      options: { fromBulk?: boolean } = {},
    ) => {
      if (!row || row.activeTask !== null) {
        return false;
      }
      if (!options.fromBulk && bulkTask !== null) {
        return false;
      }
      if (!modelId) {
        return false;
      }
      if (row.referenceCheckStatus !== "new") {
        return false;
      }
      if (task === "generate") {
        return row.contextPrompt.trim().length > 0;
      }
      if (task === "save") {
        return Boolean(row.personaData) && !row.saved;
      }
      return true;
    },
    [bulkTask, modelId],
  );

  const performMockRowTask = useCallback(
    async (rowId: string, task: PersonaBatchRowTask) => {
      const runId = previewRunIdRef.current;
      const generatedDisplayName = formatGeneratedPersonaDisplayName(
        mockPersonaGenerationPreview.structured.persona.display_name,
      );

      markRowTaskStarted(rowId, task);
      await waitForPreviewTask();
      if (runId !== previewRunIdRef.current) {
        return;
      }

      if (task === "prompt") {
        commitRows((current) =>
          current.map((row) =>
            row.rowId === rowId
              ? {
                  ...row,
                  contextPrompt: `Mock AI prompt for ${row.referenceName}`,
                  latestError: null,
                }
              : row,
          ),
        );
      } else if (task === "generate") {
        commitRows((current) =>
          current.map((row) =>
            row.rowId === rowId
              ? {
                  ...row,
                  personaData: cloneStructured(mockPersonaGenerationPreview.structured),
                  displayName: generatedDisplayName,
                  username: derivePersonaUsername(generatedDisplayName),
                  saved: false,
                  promptChangedSinceGenerate: false,
                  latestError: null,
                }
              : row,
          ),
        );
      } else {
        commitRows((current) =>
          current.map((row) =>
            row.rowId === rowId
              ? {
                  ...row,
                  saved: true,
                  savedPersonaId: row.savedPersonaId ?? "persona-preview",
                  latestError: null,
                }
              : row,
          ),
        );
      }

      markRowTaskFinished(rowId);
    },
    [commitRows, markRowTaskFinished, markRowTaskStarted],
  );

  const runRowPromptAssist = useCallback(
    async (rowId: string, options: { fromBulk?: boolean } = {}) => {
      const row = rowsRef.current.find((item) => item.rowId === rowId);
      if (!canRunRowTask(row, "prompt", options)) {
        return;
      }
      await performMockRowTask(rowId, "prompt");
    },
    [canRunRowTask, performMockRowTask],
  );

  const runRowGenerate = useCallback(
    async (rowId: string, options: { fromBulk?: boolean } = {}) => {
      const row = rowsRef.current.find((item) => item.rowId === rowId);
      if (!canRunRowTask(row, "generate", options)) {
        return;
      }
      await performMockRowTask(rowId, "generate");
    },
    [canRunRowTask, performMockRowTask],
  );

  const runRowSave = useCallback(
    async (rowId: string, options: { fromBulk?: boolean } = {}) => {
      const row = rowsRef.current.find((item) => item.rowId === rowId);
      if (!canRunRowTask(row, "save", options)) {
        return;
      }
      await performMockRowTask(rowId, "save");
    },
    [canRunRowTask, performMockRowTask],
  );

  const executeBulkRowAction = useCallback(
    async (task: Exclude<PersonaBatchActionType, "check">, rowId: string) => {
      if (task === "prompt") {
        await runRowPromptAssist(rowId, { fromBulk: true });
        return;
      }
      if (task === "generate") {
        await runRowGenerate(rowId, { fromBulk: true });
        return;
      }
      await runRowSave(rowId, { fromBulk: true });
    },
    [runRowGenerate, runRowPromptAssist, runRowSave],
  );

  const runBulkTaskLoop = useCallback(
    async (
      task: Exclude<PersonaBatchActionType, "check">,
      options: { elapsedOffset?: number } = {},
    ): Promise<{ paused: boolean; elapsedSeconds: number }> => {
      const elapsedOffset = options.elapsedOffset ?? 0;
      let paused = false;
      let finalElapsedSeconds = elapsedOffset;
      bulkTaskMetaRef.current = { task, startedAt: Date.now() - elapsedOffset * 1000 };
      setBulkTask(task);
      setBulkElapsedSeconds(elapsedOffset);
      clearBulkPausedState();

      let previousEligibleSignature: string | null = null;

      try {
        while (true) {
          const targetRowIds = rowsRef.current
            .filter((row) => isEligibleForBulkAction(row, task))
            .map((row) => row.rowId);
          const elapsedSeconds = bulkTaskMetaRef.current
            ? Math.max(0, Math.floor((Date.now() - bulkTaskMetaRef.current.startedAt) / 1000))
            : elapsedOffset;
          finalElapsedSeconds = elapsedSeconds;

          if (targetRowIds.length === 0) {
            bulkPausedQueueRef.current = null;
            setBulkLastCompletedTask(task);
            setBulkLastElapsedSeconds(elapsedSeconds);
            break;
          }

          const roundSignature = targetRowIds.join("|");
          if (previousEligibleSignature === roundSignature) {
            bulkPausedQueueRef.current = null;
            setBulkLastCompletedTask(task);
            setBulkLastElapsedSeconds(elapsedSeconds);
            break;
          }

          previousEligibleSignature = roundSignature;

          const result = await runChunkedQueue(
            targetRowIds,
            chunkSize,
            async (rowId) => {
              const row = rowsRef.current.find((item) => item.rowId === rowId);
              if (!isEligibleForBulkAction(row, task)) {
                return;
              }
              await executeBulkRowAction(task, rowId);
            },
            {
              shouldContinueAfterChunk: () => !bulkPauseRequestedRef.current,
            },
          );

          if (!result.completedAll) {
            paused = true;
            bulkPausedQueueRef.current = { task };
            setBulkPausedTask(task);
            setBulkPausedElapsedSeconds(
              bulkTaskMetaRef.current
                ? Math.max(0, Math.floor((Date.now() - bulkTaskMetaRef.current.startedAt) / 1000))
                : elapsedOffset,
            );
            break;
          }
        }
      } finally {
        bulkTaskMetaRef.current = null;
        bulkPauseRequestedRef.current = false;
        setBulkPauseRequested(false);
        setBulkTask(null);
        setBulkElapsedSeconds(0);
      }
      return {
        paused,
        elapsedSeconds: finalElapsedSeconds,
      };
    },
    [chunkSize, clearBulkPausedState, executeBulkRowAction],
  );

  const nextBulkTask = useCallback(
    (
      task: Exclude<PersonaBatchActionType, "check">,
    ): Exclude<PersonaBatchActionType, "check"> | null => {
      if (task === "prompt") {
        return "generate";
      }
      if (task === "generate") {
        return "save";
      }
      return null;
    },
    [],
  );

  const runBulkTaskSequence = useCallback(
    async (
      task: Exclude<PersonaBatchActionType, "check">,
      options: { elapsedOffset?: number } = {},
    ) => {
      let currentTask: Exclude<PersonaBatchActionType, "check"> | null = task;
      let currentOptions = options;

      while (currentTask) {
        const result = await runBulkTaskLoop(currentTask, currentOptions);
        if (result.paused) {
          return;
        }
        if (!autoAdvanceBulkActionsRef.current) {
          return;
        }
        const upcomingTask = nextBulkTask(currentTask);
        if (!upcomingTask) {
          return;
        }
        currentTask = upcomingTask;
        currentOptions = {};
      }
    },
    [nextBulkTask, runBulkTaskLoop],
  );

  const resumeBulkTask = useCallback(async () => {
    if (bulkTask !== null) {
      if (bulkPauseRequestedRef.current) {
        bulkPauseRequestedRef.current = false;
        setBulkPauseRequested(false);
      }
      return;
    }
    if (hasAnyRowTask) {
      return;
    }
    const pausedQueue = bulkPausedQueueRef.current;
    if (!pausedQueue) {
      return;
    }

    const elapsedOffset = bulkPausedElapsedSeconds;
    const targetRowIds = rowsRef.current
      .filter((row) => isEligibleForBulkAction(row, pausedQueue.task))
      .map((row) => row.rowId);

    if (targetRowIds.length === 0) {
      bulkPausedQueueRef.current = null;
      setBulkPausedTask(null);
      setBulkPausedElapsedSeconds(0);
      setBulkLastCompletedTask(pausedQueue.task);
      setBulkLastElapsedSeconds(elapsedOffset);
      return;
    }

    await runBulkTaskSequence(pausedQueue.task, {
      elapsedOffset,
    });
  }, [bulkPausedElapsedSeconds, bulkTask, hasAnyRowTask, runBulkTaskSequence]);

  const startOrResumeBulkTask = useCallback(
    async (task: Exclude<PersonaBatchActionType, "check">) => {
      if (bulkTask !== null || hasAnyRowTask) {
        return;
      }
      if (bulkPausedTask === task) {
        await resumeBulkTask();
        return;
      }

      const targetRowIds = rowsRef.current
        .filter((row) => isEligibleForBulkAction(row, task))
        .map((row) => row.rowId);
      if (targetRowIds.length === 0) {
        return;
      }

      if (bulkPausedTask !== null) {
        clearBulkPausedState();
      }
      await runBulkTaskSequence(task);
    },
    [
      bulkPausedTask,
      bulkTask,
      clearBulkPausedState,
      hasAnyRowTask,
      resumeBulkTask,
      runBulkTaskSequence,
    ],
  );

  const resetPreviewState = useCallback(() => {
    previewRunIdRef.current += 1;
    clearAddTimer();
    clearBulkPausedState();
    rowTaskMetaRef.current = {};
    bulkTaskMetaRef.current = null;
    bulkPauseRequestedRef.current = false;
    setModelId("model-1");
    setReferenceInput("Octavia Butler");
    setChunkSize(DEFAULT_CHUNK_SIZE);
    setAddLoading(false);
    setAddElapsedSeconds(0);
    setAddLastCompletedElapsedSeconds(null);
    setAddLastCompletedAddedCount(null);
    setAddLastCompletedDuplicateCount(null);
    setBulkTask(null);
    setBulkElapsedSeconds(0);
    setBulkPausedTask(null);
    setBulkPausedElapsedSeconds(0);
    setBulkPauseRequested(false);
    setBulkLastCompletedTask("generate");
    setBulkLastElapsedSeconds(31);
    setAutoAdvanceBulkActionsValue(false);
    commitRows(buildInitialRows());
    rowCounterRef.current = 4;
    setResetSignal((current) => current + 1);
  }, [clearAddTimer, clearBulkPausedState, commitRows, setAutoAdvanceBulkActionsValue]);

  const controller = useMemo<PersonaBatchGenerationController>(
    () => ({
      modelId,
      setModelId,
      referenceInput,
      setReferenceInput,
      rows,
      addLoading,
      addElapsedSeconds,
      addLastCompletedElapsedSeconds,
      addLastCompletedAddedCount,
      addLastCompletedDuplicateCount,
      chunkSize,
      setChunkSize: (value: number) => setChunkSize(Math.max(1, Math.min(20, Math.floor(value)))),
      bulkTask,
      bulkElapsedSeconds,
      bulkPausedTask,
      bulkPausedElapsedSeconds,
      bulkPauseRequested,
      bulkLastCompletedTask,
      bulkLastElapsedSeconds,
      canBulkPrompt: rows.some((row) => isEligibleForBulkAction(row, "prompt")),
      canBulkGenerate: rows.some((row) => isEligibleForBulkAction(row, "generate")),
      canBulkSave: rows.some((row) => isEligibleForBulkAction(row, "save")),
      autoAdvanceBulkActions,
      setAutoAdvanceBulkActions: setAutoAdvanceBulkActionsValue,
      anyApiActive,
      bulkActionsDisabled: addLoading || bulkTask !== null || hasAnyRowTask,
      canReset: !anyApiActive,
      canClearBatchRows:
        !anyApiActive && rows.some((row) => row.referenceCheckStatus === "duplicate" || row.saved),
      personaGenerationModels: previewModels,
      addReferenceRowsFromInput: async () => {
        const value = referenceInput.trim();
        if (!value) {
          return;
        }

        const existingNames = new Set(
          rowsRef.current.map((row) => buildPersonaReferenceMatchKey(row.referenceName)),
        );
        const nextNames: string[] = [];

        for (const item of value
          .split(/[\n,]/u)
          .map((entry) => entry.trim())
          .filter(Boolean)) {
          const normalized = buildPersonaReferenceMatchKey(item);
          if (existingNames.has(normalized)) {
            continue;
          }
          existingNames.add(normalized);
          nextNames.push(item);
        }

        if (nextNames.length === 0) {
          setReferenceInput("");
          setAddLoading(false);
          setAddElapsedSeconds(0);
          setAddLastCompletedElapsedSeconds(0);
          setAddLastCompletedAddedCount(0);
          setAddLastCompletedDuplicateCount(countPreviewDuplicateRows(rowsRef.current));
          return;
        }

        const currentRunId = previewRunIdRef.current;
        clearAddTimer();
        addStartedAtRef.current = Date.now();
        setAddLoading(true);
        setAddElapsedSeconds(0);
        setAddLastCompletedElapsedSeconds(null);
        setAddLastCompletedAddedCount(null);
        setAddLastCompletedDuplicateCount(null);

        commitRows((current) => [
          ...current,
          ...nextNames.map((referenceName) => ({
            rowId: `row-${rowCounterRef.current++}`,
            referenceName,
            dbReferenceExists: false,
            contextPrompt: "",
            displayName: "",
            username: "",
            personaData: null,
            saved: false,
            savedPersonaId: null,
            promptChangedSinceGenerate: false,
            referenceCheckStatus: "new" as const,
            activeTask: null,
            activeElapsedSeconds: 0,
            lastCompletedTask: null,
            lastCompletedElapsedSeconds: 0,
            latestError: null,
          })),
        ]);

        addFinishTimerRef.current = window.setTimeout(() => {
          if (currentRunId !== previewRunIdRef.current) {
            return;
          }
          setAddLoading(false);
          setAddElapsedSeconds(0);
          setAddLastCompletedElapsedSeconds(1);
          setAddLastCompletedAddedCount(nextNames.length);
          setAddLastCompletedDuplicateCount(countPreviewDuplicateRows(rowsRef.current));
          addFinishTimerRef.current = null;
          addStartedAtRef.current = null;
        }, 1000);
        setReferenceInput("");
      },
      clearBatchRows: async () => {
        commitRows((current) =>
          current.filter((row) => row.referenceCheckStatus !== "duplicate" && !row.saved),
        );
        toast.success("Duplicate and saved rows cleared");
      },
      clearRow: async (rowId) => {
        commitRows((current) => current.filter((row) => row.rowId !== rowId));
        toast.success("Row cleared");
      },
      updateContextPrompt: (rowId, contextPrompt) => {
        commitRows((current) =>
          current.map((row) =>
            row.rowId === rowId
              ? {
                  ...row,
                  contextPrompt,
                  promptChangedSinceGenerate: row.personaData
                    ? true
                    : row.promptChangedSinceGenerate,
                }
              : row,
          ),
        );
      },
      updatePersonaIdentity: (rowId, input) => {
        commitRows((current) =>
          current.map((row) =>
            row.rowId === rowId
              ? {
                  ...row,
                  displayName: input.displayName,
                  username: input.username,
                  saved: false,
                }
              : row,
          ),
        );
      },
      runRowPromptAssist,
      runRowGenerate: async (rowId) => {
        await runRowGenerate(rowId);
      },
      runRowSave: async (rowId) => {
        await runRowSave(rowId);
      },
      runBulkPromptAssist: async () => {
        await startOrResumeBulkTask("prompt");
      },
      runBulkGenerate: async () => {
        await startOrResumeBulkTask("generate");
      },
      runBulkSave: async () => {
        await startOrResumeBulkTask("save");
      },
      requestBulkPause: () => {
        if (bulkTask === null || bulkPauseRequestedRef.current) {
          return;
        }
        bulkPauseRequestedRef.current = true;
        setBulkPauseRequested(true);
      },
      resumeBulkTask,
      reset: resetPreviewState,
    }),
    [
      addElapsedSeconds,
      addLastCompletedAddedCount,
      addLastCompletedDuplicateCount,
      addLastCompletedElapsedSeconds,
      addLoading,
      anyApiActive,
      bulkElapsedSeconds,
      bulkLastCompletedTask,
      bulkLastElapsedSeconds,
      bulkPauseRequested,
      bulkPausedElapsedSeconds,
      bulkPausedTask,
      bulkTask,
      chunkSize,
      autoAdvanceBulkActions,
      clearAddTimer,
      commitRows,
      hasAnyRowTask,
      modelId,
      referenceInput,
      resetPreviewState,
      resumeBulkTask,
      rows,
      runRowGenerate,
      runRowPromptAssist,
      runRowSave,
      setAutoAdvanceBulkActionsValue,
      startOrResumeBulkTask,
    ],
  );

  return (
    <PersonaBatchPage
      controller={controller}
      resetSignal={resetSignal}
      title="Persona Batch Preview"
      description="Preview the batch persona workflow with mock rows and reusable modals."
      headerActions={
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-circle"
          aria-label="Refresh preview"
          onClick={resetPreviewState}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      }
      topNotice={
        <div className="alert alert-info mt-3">
          <span>No network request or database write happens here.</span>
        </div>
      }
    />
  );
}
