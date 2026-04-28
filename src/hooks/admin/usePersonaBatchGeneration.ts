"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ApiError, apiPatch, apiPost } from "@/lib/api/fetch-json";
import type {
  AiModelConfig,
  AiProviderConfig,
  PersonaGenerationStructured,
} from "@/lib/ai/admin/control-plane-contract";
import type {
  PersonaBatchActionType,
  PersonaBatchErrorRecord,
  PersonaBatchRow,
  PersonaBatchRowTask,
} from "@/lib/ai/admin/persona-batch-contract";
import { runChunkedQueue } from "@/lib/ai/admin/persona-batch-queue";
import { formatGeneratedPersonaDisplayName } from "@/lib/ai/admin/persona-display-name";
import { buildPersonaReferenceMatchKey } from "@/lib/ai/admin/persona-reference-normalization";
import {
  buildCreatePersonaPayload,
  buildUpdatePersonaPayload,
} from "@/lib/ai/admin/persona-save-payload";
import { derivePersonaUsername, normalizeUsernameInput } from "@/lib/username-validation";
import { isEligiblePersonaGenerationModel } from "./useAiControlPlane";

const DEFAULT_CHUNK_SIZE = 5;
const MIN_CHUNK_SIZE = 1;
const MAX_CHUNK_SIZE = 20;

type UsePersonaBatchGenerationProps = {
  initialModels: AiModelConfig[];
  initialProviders: AiProviderConfig[];
};

function clampChunkSize(value: number): number {
  return Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, Math.floor(value)));
}

function parseReferenceNames(input: string): string[] {
  return input
    .split(/[\n,]/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeReferenceName(value: string): string {
  return buildPersonaReferenceMatchKey(value);
}

function countDuplicateRows(rows: PersonaBatchRow[]): number {
  return rows.filter((row) => row.referenceCheckStatus === "duplicate").length;
}

function buildRowsAfterReferenceCheck(
  current: PersonaBatchRow[],
  rowIds: string[],
  existsByNormalized: Map<string, boolean>,
): PersonaBatchRow[] {
  const counts = new Map<string, number>();
  for (const row of current) {
    const normalized = normalizeReferenceName(row.referenceName);
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return current.map((row) => {
    if (!rowIds.includes(row.rowId)) {
      return row;
    }

    const normalized = normalizeReferenceName(row.referenceName);
    const isDuplicate =
      (existsByNormalized.get(normalized) ?? false) || (counts.get(normalized) ?? 0) > 1;

    return {
      ...row,
      dbReferenceExists: existsByNormalized.get(normalized) ?? false,
      referenceCheckStatus: isDuplicate ? "duplicate" : "new",
      latestError: row.latestError?.type === "check" ? null : row.latestError,
    };
  });
}

function recomputeLocalReferenceStatuses(rows: PersonaBatchRow[]): PersonaBatchRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const normalized = normalizeReferenceName(row.referenceName);
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return rows.map((row) => {
    if (row.referenceCheckStatus === "unchecked" || row.referenceCheckStatus === "check_error") {
      return row;
    }

    const normalized = normalizeReferenceName(row.referenceName);
    const isDuplicate = row.dbReferenceExists || (counts.get(normalized) ?? 0) > 1;
    return {
      ...row,
      referenceCheckStatus: isDuplicate ? "duplicate" : "new",
    };
  });
}

function buildErrorRecord(
  type: PersonaBatchActionType,
  apiUrl: string,
  payload: unknown,
  error: unknown,
  fallbackMessage: string,
): PersonaBatchErrorRecord {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const rawResponse =
    error instanceof ApiError
      ? (error.details ?? { error: message })
      : error instanceof Error
        ? { error: error.message }
        : { error: fallbackMessage };

  return {
    type,
    message,
    apiUrl,
    payload,
    rawResponse,
    createdAt: new Date().toISOString(),
  };
}

function readPreviewStructured(response: unknown): PersonaGenerationStructured | null {
  if (!response || typeof response !== "object") {
    return null;
  }
  const preview = (response as { preview?: { structured?: PersonaGenerationStructured } }).preview;
  return preview?.structured ?? null;
}

export function usePersonaBatchGeneration({
  initialModels,
  initialProviders,
}: UsePersonaBatchGenerationProps) {
  const personaGenerationModels = useMemo(
    () =>
      initialModels.filter((model) => {
        const provider = initialProviders.find((item) => item.id === model.providerId);
        return isEligiblePersonaGenerationModel(model, provider);
      }),
    [initialModels, initialProviders],
  );

  const [modelId, setModelId] = useState<string>(personaGenerationModels[0]?.id ?? "");
  const [referenceInput, setReferenceInput] = useState("");
  const [rows, setRows] = useState<PersonaBatchRow[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addElapsedSeconds, setAddElapsedSeconds] = useState(0);
  const [addLastCompletedElapsedSeconds, setAddLastCompletedElapsedSeconds] = useState<
    number | null
  >(null);
  const [addLastCompletedAddedCount, setAddLastCompletedAddedCount] = useState<number | null>(null);
  const [addLastCompletedDuplicateCount, setAddLastCompletedDuplicateCount] = useState<
    number | null
  >(null);
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK_SIZE);
  const [bulkTask, setBulkTask] = useState<PersonaBatchActionType | null>(null);
  const [bulkElapsedSeconds, setBulkElapsedSeconds] = useState(0);
  const [bulkPausedTask, setBulkPausedTask] = useState<PersonaBatchActionType | null>(null);
  const [bulkPausedElapsedSeconds, setBulkPausedElapsedSeconds] = useState(0);
  const [bulkPauseRequested, setBulkPauseRequested] = useState(false);
  const [bulkLastCompletedTask, setBulkLastCompletedTask] = useState<PersonaBatchActionType | null>(
    null,
  );
  const [bulkLastElapsedSeconds, setBulkLastElapsedSeconds] = useState(0);
  const [autoAdvanceBulkActions, setAutoAdvanceBulkActions] = useState(true);
  const rowCounterRef = useRef(1);
  const rowsRef = useRef<PersonaBatchRow[]>([]);
  const rowTaskRef = useRef<Record<string, { task: PersonaBatchRowTask; startedAt: number }>>({});
  const bulkTaskRef = useRef<{ task: PersonaBatchActionType; startedAt: number } | null>(null);
  const bulkPauseRequestedRef = useRef(false);
  const bulkPausedQueueRef = useRef<{
    task: Exclude<PersonaBatchActionType, "check">;
  } | null>(null);
  const autoAdvanceBulkActionsRef = useRef(true);
  const referenceCheckRunIdRef = useRef(0);
  const addTaskRef = useRef<{ startedAt: number } | null>(null);

  const commitRows = useCallback(
    (updater: PersonaBatchRow[] | ((current: PersonaBatchRow[]) => PersonaBatchRow[])) => {
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

  useEffect(() => {
    if (!personaGenerationModels.some((item) => item.id === modelId)) {
      setModelId(personaGenerationModels[0]?.id ?? "");
    }
  }, [modelId, personaGenerationModels]);

  const hasAnyRowTask = rows.some((row) => row.activeTask !== null);
  const hasReferenceCheckInFlight = rows.some((row) => row.referenceCheckStatus === "checking");
  const anyApiActive =
    addLoading || bulkTask !== null || hasAnyRowTask || hasReferenceCheckInFlight;

  useEffect(() => {
    if (!anyApiActive) {
      return;
    }

    const intervalId = window.setInterval(() => {
      commitRows((current) =>
        current.map((row) => {
          const meta = rowTaskRef.current[row.rowId];
          if (!meta) {
            return row.activeElapsedSeconds === 0 ? row : { ...row, activeElapsedSeconds: 0 };
          }
          const elapsedSeconds = Math.max(0, Math.floor((Date.now() - meta.startedAt) / 1000));
          return elapsedSeconds === row.activeElapsedSeconds
            ? row
            : { ...row, activeElapsedSeconds: elapsedSeconds };
        }),
      );

      const bulkMeta = bulkTaskRef.current;
      if (!bulkMeta) {
        setBulkElapsedSeconds((current) => (current === 0 ? current : 0));
      } else {
        const nextElapsed = Math.max(0, Math.floor((Date.now() - bulkMeta.startedAt) / 1000));
        setBulkElapsedSeconds((current) => (current === nextElapsed ? current : nextElapsed));
      }

      const addMeta = addTaskRef.current;
      if (!addMeta) {
        setAddElapsedSeconds((current) => (current === 0 ? current : 0));
      } else {
        const nextElapsed = Math.max(0, Math.floor((Date.now() - addMeta.startedAt) / 1000));
        setAddElapsedSeconds((current) => (current === nextElapsed ? current : nextElapsed));
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [anyApiActive, commitRows]);

  const markRowTaskStarted = useCallback(
    (rowId: string, task: PersonaBatchRowTask) => {
      rowTaskRef.current[rowId] = { task, startedAt: Date.now() };
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
      const meta = rowTaskRef.current[rowId];
      const elapsedSeconds = meta
        ? Math.max(0, Math.floor((Date.now() - meta.startedAt) / 1000))
        : 0;
      delete rowTaskRef.current[rowId];
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

  const applyReferenceCheckResults = useCallback(
    (
      rowIds: string[],
      items: Array<{
        input: string;
        matchKey: string;
        romanizedName: string;
        exists: boolean;
      }>,
    ): PersonaBatchRow[] => {
      const existsByNormalized = new Map<string, boolean>();
      for (const item of items) {
        existsByNormalized.set(item.matchKey, Boolean(item.exists));
      }

      const nextRows = buildRowsAfterReferenceCheck(rowsRef.current, rowIds, existsByNormalized);
      rowsRef.current = nextRows;
      setRows(nextRows);
      return nextRows;
    },
    [],
  );

  const markReferenceCheckError = useCallback(
    (rowIds: string[], payload: { names: string[] }, error: unknown) => {
      const record = buildErrorRecord(
        "check",
        "/api/admin/ai/persona-references/check",
        payload,
        error,
        "Failed to check reference names",
      );

      commitRows((current) =>
        current.map((row) =>
          rowIds.includes(row.rowId)
            ? {
                ...row,
                referenceCheckStatus: "check_error",
                latestError: record,
              }
            : row,
        ),
      );
    },
    [commitRows],
  );

  const runReferenceCheck = useCallback(
    async (rowIds: string[]): Promise<PersonaBatchRow[] | null> => {
      const targetedRows = rowsRef.current.filter((row) => rowIds.includes(row.rowId));
      if (targetedRows.length === 0) {
        return null;
      }

      const payload = { names: targetedRows.map((row) => row.referenceName) };
      const runId = ++referenceCheckRunIdRef.current;

      commitRows((current) =>
        current.map((row) =>
          rowIds.includes(row.rowId)
            ? {
                ...row,
                referenceCheckStatus: "checking",
                latestError: row.latestError?.type === "check" ? null : row.latestError,
              }
            : row,
        ),
      );

      try {
        const response = await apiPost<{
          items: Array<{
            input: string;
            matchKey: string;
            romanizedName: string;
            exists: boolean;
          }>;
        }>("/api/admin/ai/persona-references/check", payload);
        if (referenceCheckRunIdRef.current !== runId) {
          return null;
        }
        return applyReferenceCheckResults(rowIds, response.items);
      } catch (error) {
        if (referenceCheckRunIdRef.current !== runId) {
          return null;
        }
        markReferenceCheckError(rowIds, payload, error);
        return null;
      }
    },
    [applyReferenceCheckResults, commitRows, markReferenceCheckError],
  );

  const addReferenceRowsFromInput = useCallback(async () => {
    if (anyApiActive) {
      return;
    }

    const existingNames = new Set(
      rowsRef.current.map((row) => normalizeReferenceName(row.referenceName)),
    );
    const filteredNames: string[] = [];
    const seenNames = new Set(existingNames);
    let skippedDuplicateCount = 0;
    for (const name of parseReferenceNames(referenceInput)) {
      const normalized = normalizeReferenceName(name);
      if (!normalized || seenNames.has(normalized)) {
        skippedDuplicateCount += 1;
        continue;
      }
      seenNames.add(normalized);
      filteredNames.push(name);
    }

    if (filteredNames.length === 0) {
      if (skippedDuplicateCount > 0) {
        setReferenceInput("");
        setAddLoading(false);
        setAddElapsedSeconds(0);
        setAddLastCompletedElapsedSeconds(0);
        setAddLastCompletedAddedCount(0);
        setAddLastCompletedDuplicateCount(countDuplicateRows(rowsRef.current));
      }
      return;
    }

    const newRows = filteredNames.map<PersonaBatchRow>((referenceName) => ({
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
      referenceCheckStatus: "unchecked",
      activeTask: null,
      activeElapsedSeconds: 0,
      latestError: null,
      lastCompletedTask: null,
      lastCompletedElapsedSeconds: 0,
    }));
    const nextRows = [...rowsRef.current, ...newRows];
    rowsRef.current = nextRows;
    setRows(nextRows);
    setReferenceInput("");
    setAddLoading(true);
    addTaskRef.current = { startedAt: Date.now() };
    setAddElapsedSeconds(0);
    setAddLastCompletedElapsedSeconds(null);
    setAddLastCompletedAddedCount(null);
    setAddLastCompletedDuplicateCount(null);
    try {
      const checkedRows = await runReferenceCheck(nextRows.map((row) => row.rowId));
      toast.success(
        filteredNames.length === 1
          ? "Added 1 reference name."
          : `Added ${filteredNames.length} reference names.`,
      );
      setAddLastCompletedAddedCount(filteredNames.length);
      setAddLastCompletedDuplicateCount(countDuplicateRows(checkedRows ?? rowsRef.current));
    } finally {
      const elapsedSeconds = addTaskRef.current
        ? Math.max(0, Math.floor((Date.now() - addTaskRef.current.startedAt) / 1000))
        : 0;
      addTaskRef.current = null;
      setAddLoading(false);
      setAddElapsedSeconds(0);
      setAddLastCompletedElapsedSeconds(elapsedSeconds);
    }
  }, [anyApiActive, referenceInput, runReferenceCheck]);

  const clearRow = useCallback(
    async (rowId: string) => {
      if (bulkTask !== null) {
        return;
      }
      const row = rowsRef.current.find((item) => item.rowId === rowId);
      if (!row || row.activeTask !== null || row.referenceCheckStatus === "checking") {
        return;
      }

      const nextRows = rowsRef.current.filter((item) => item.rowId !== rowId);
      const recomputedRows = recomputeLocalReferenceStatuses(nextRows);
      rowsRef.current = recomputedRows;
      setRows(recomputedRows);
      toast.success("Row cleared");
    },
    [bulkTask],
  );

  const clearBatchRows = useCallback(async () => {
    if (anyApiActive) {
      return;
    }

    const nextRows = rowsRef.current.filter(
      (row) => row.referenceCheckStatus !== "duplicate" && !row.saved,
    );
    if (nextRows.length === rowsRef.current.length) {
      return;
    }

    const recomputedRows = recomputeLocalReferenceStatuses(nextRows);
    rowsRef.current = recomputedRows;
    setRows(recomputedRows);
    toast.success("Duplicate and saved rows cleared");
  }, [anyApiActive]);

  const updateContextPrompt = useCallback(
    (rowId: string, contextPrompt: string) => {
      commitRows((current) =>
        current.map((row) =>
          row.rowId === rowId
            ? {
                ...row,
                contextPrompt,
                promptChangedSinceGenerate: row.personaData ? true : row.promptChangedSinceGenerate,
              }
            : row,
        ),
      );
    },
    [commitRows],
  );

  const updatePersonaIdentity = useCallback(
    (
      rowId: string,
      input: {
        displayName: string;
        username: string;
      },
    ) => {
      commitRows((current) =>
        current.map((row) =>
          row.rowId === rowId
            ? {
                ...row,
                displayName: input.displayName,
                username: normalizeUsernameInput(input.username, { isPersona: true }),
                saved: false,
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
      if (!row) {
        return false;
      }
      if (row.activeTask !== null) {
        return false;
      }
      if (!options.fromBulk && bulkTask !== null) {
        return false;
      }
      if (!modelId || !personaGenerationModels.some((item) => item.id === modelId)) {
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
    [bulkTask, modelId, personaGenerationModels],
  );

  const isEligibleForBulkAction = useCallback(
    (row: PersonaBatchRow | undefined, task: Exclude<PersonaBatchActionType, "check">) => {
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
    },
    [],
  );

  const canBulkPrompt = useMemo(
    () => rows.some((row) => isEligibleForBulkAction(row, "prompt")),
    [isEligibleForBulkAction, rows],
  );
  const canBulkGenerate = useMemo(
    () => rows.some((row) => isEligibleForBulkAction(row, "generate")),
    [isEligibleForBulkAction, rows],
  );
  const canBulkSave = useMemo(
    () => rows.some((row) => isEligibleForBulkAction(row, "save")),
    [isEligibleForBulkAction, rows],
  );

  const executeRowPromptAssist = useCallback(
    async (rowId: string, options: { fromBulk?: boolean } = {}) => {
      const row = rowsRef.current.find((item) => item.rowId === rowId);
      if (!canRunRowTask(row, "prompt", options)) {
        return;
      }

      const payload = {
        modelId,
        inputPrompt: row!.contextPrompt.trim() || row!.referenceName,
      };
      markRowTaskStarted(rowId, "prompt");
      try {
        const response = await apiPost<{ text: string }>(
          "/api/admin/ai/persona-generation/prompt-assist",
          payload,
        );
        commitRows((current) =>
          current.map((item) =>
            item.rowId === rowId
              ? {
                  ...item,
                  contextPrompt: response.text,
                  latestError: item.latestError?.type === "prompt" ? null : item.latestError,
                }
              : item,
          ),
        );
      } catch (error) {
        const latestError = buildErrorRecord(
          "prompt",
          "/api/admin/ai/persona-generation/prompt-assist",
          payload,
          error,
          "Failed to assist prompt",
        );
        commitRows((current) =>
          current.map((item) => (item.rowId === rowId ? { ...item, latestError } : item)),
        );
      } finally {
        markRowTaskFinished(rowId);
      }
    },
    [canRunRowTask, commitRows, markRowTaskFinished, markRowTaskStarted, modelId],
  );

  const executeRowGenerate = useCallback(
    async (rowId: string, options: { fromBulk?: boolean } = {}) => {
      const row = rowsRef.current.find((item) => item.rowId === rowId);
      if (!canRunRowTask(row, "generate", options)) {
        return;
      }

      const payload = {
        modelId,
        extraPrompt: row!.contextPrompt,
      };
      markRowTaskStarted(rowId, "generate");
      try {
        const response = await apiPost("/api/admin/ai/persona-generation/preview", payload);
        const structured = readPreviewStructured(response);
        if (!structured) {
          throw new Error("Persona generation preview returned no structured data");
        }
        const generatedDisplayName = formatGeneratedPersonaDisplayName(
          structured.persona.display_name,
        );
        commitRows((current) =>
          current.map((item) =>
            item.rowId === rowId
              ? {
                  ...item,
                  personaData: structured,
                  displayName: generatedDisplayName,
                  username: derivePersonaUsername(generatedDisplayName),
                  saved: false,
                  promptChangedSinceGenerate: false,
                  latestError: item.latestError?.type === "generate" ? null : item.latestError,
                }
              : item,
          ),
        );
      } catch (error) {
        const latestError = buildErrorRecord(
          "generate",
          "/api/admin/ai/persona-generation/preview",
          payload,
          error,
          "Failed to generate persona data",
        );
        commitRows((current) =>
          current.map((item) => (item.rowId === rowId ? { ...item, latestError } : item)),
        );
      } finally {
        markRowTaskFinished(rowId);
      }
    },
    [canRunRowTask, commitRows, markRowTaskFinished, markRowTaskStarted, modelId],
  );

  const executeRowSave = useCallback(
    async (rowId: string, options: { fromBulk?: boolean } = {}) => {
      const row = rowsRef.current.find((item) => item.rowId === rowId);
      if (!canRunRowTask(row, "save", options) || !row?.personaData) {
        return;
      }

      const isUpdate = Boolean(row.savedPersonaId);
      const apiUrl = isUpdate
        ? `/api/admin/ai/personas/${row.savedPersonaId}`
        : "/api/admin/ai/personas";
      const payload = isUpdate
        ? buildUpdatePersonaPayload({
            structured: row.personaData,
            displayName: row.displayName,
            username: row.username,
          })
        : buildCreatePersonaPayload({
            structured: row.personaData,
            displayName: row.displayName,
            username: row.username,
          });

      markRowTaskStarted(rowId, "save");
      try {
        if (isUpdate) {
          await apiPatch(apiUrl, payload);
        } else {
          const response = await apiPost<{ personaId?: string }>(apiUrl, payload);
          commitRows((current) =>
            current.map((item) =>
              item.rowId === rowId
                ? {
                    ...item,
                    savedPersonaId: response.personaId ?? item.savedPersonaId,
                  }
                : item,
            ),
          );
        }

        commitRows((current) =>
          current.map((item) =>
            item.rowId === rowId
              ? {
                  ...item,
                  saved: true,
                  latestError: item.latestError?.type === "save" ? null : item.latestError,
                }
              : item,
          ),
        );
      } catch (error) {
        const latestError = buildErrorRecord(
          "save",
          apiUrl,
          payload,
          error,
          "Failed to save persona",
        );
        commitRows((current) =>
          current.map((item) => (item.rowId === rowId ? { ...item, latestError } : item)),
        );
      } finally {
        markRowTaskFinished(rowId);
      }
    },
    [canRunRowTask, commitRows, markRowTaskFinished, markRowTaskStarted],
  );

  const executeBulkRowAction = useCallback(
    async (task: Exclude<PersonaBatchActionType, "check">, rowId: string) => {
      if (task === "prompt") {
        await executeRowPromptAssist(rowId, { fromBulk: true });
        return;
      }
      if (task === "generate") {
        await executeRowGenerate(rowId, { fromBulk: true });
        return;
      }
      await executeRowSave(rowId, { fromBulk: true });
    },
    [executeRowGenerate, executeRowPromptAssist, executeRowSave],
  );

  const clearBulkPausedState = useCallback(() => {
    bulkPauseRequestedRef.current = false;
    bulkPausedQueueRef.current = null;
    setBulkPauseRequested(false);
    setBulkPausedTask(null);
    setBulkPausedElapsedSeconds(0);
  }, []);

  const runBulkTaskByIds = useCallback(
    async (
      task: Exclude<PersonaBatchActionType, "check">,
      options: { elapsedOffset?: number } = {},
    ): Promise<{ paused: boolean; elapsedSeconds: number }> => {
      const elapsedOffset = options.elapsedOffset ?? 0;
      let paused = false;
      let finalElapsedSeconds = elapsedOffset;
      bulkPauseRequestedRef.current = false;
      setBulkPauseRequested(false);
      setBulkPausedTask(null);
      setBulkPausedElapsedSeconds(0);
      bulkTaskRef.current = {
        task,
        startedAt: Date.now() - elapsedOffset * 1000,
      };
      setBulkTask(task);
      setBulkElapsedSeconds(elapsedOffset);

      try {
        let previousEligibleSignature: string | null = null;

        while (true) {
          const targetRowIds = rowsRef.current
            .filter((row) => isEligibleForBulkAction(row, task))
            .map((row) => row.rowId);

          const elapsedSeconds = bulkTaskRef.current
            ? Math.max(0, Math.floor((Date.now() - bulkTaskRef.current.startedAt) / 1000))
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
              bulkTaskRef.current
                ? Math.max(0, Math.floor((Date.now() - bulkTaskRef.current.startedAt) / 1000))
                : elapsedOffset,
            );
            break;
          }
        }
      } finally {
        bulkTaskRef.current = null;
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
    [chunkSize, executeBulkRowAction, isEligibleForBulkAction],
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
        const result = await runBulkTaskByIds(currentTask, currentOptions);
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
    [nextBulkTask, runBulkTaskByIds],
  );

  const requestBulkPause = useCallback(() => {
    if (bulkTask === null || bulkPauseRequestedRef.current) {
      return;
    }
    bulkPauseRequestedRef.current = true;
    setBulkPauseRequested(true);
  }, [bulkTask]);

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
      isEligibleForBulkAction,
      resumeBulkTask,
      runBulkTaskSequence,
    ],
  );

  const runBulkPromptAssist = useCallback(async () => {
    await startOrResumeBulkTask("prompt");
  }, [startOrResumeBulkTask]);

  const runBulkGenerate = useCallback(async () => {
    await startOrResumeBulkTask("generate");
  }, [startOrResumeBulkTask]);

  const runBulkSave = useCallback(async () => {
    await startOrResumeBulkTask("save");
  }, [startOrResumeBulkTask]);

  const reset = useCallback(() => {
    if (anyApiActive) {
      return;
    }
    referenceCheckRunIdRef.current += 1;
    addTaskRef.current = null;
    rowTaskRef.current = {};
    bulkTaskRef.current = null;
    clearBulkPausedState();
    setReferenceInput("");
    commitRows([]);
    setAddLoading(false);
    setAddElapsedSeconds(0);
    setAddLastCompletedElapsedSeconds(null);
    setAddLastCompletedAddedCount(null);
    setAddLastCompletedDuplicateCount(null);
    setBulkTask(null);
    setBulkElapsedSeconds(0);
    setBulkLastCompletedTask(null);
    setBulkLastElapsedSeconds(0);
    setAutoAdvanceBulkActionsValue(false);
    setChunkSize(DEFAULT_CHUNK_SIZE);
  }, [anyApiActive, clearBulkPausedState, commitRows, setAutoAdvanceBulkActionsValue]);

  return {
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
    setChunkSize: (value: number) => setChunkSize(clampChunkSize(value)),
    bulkTask,
    bulkElapsedSeconds,
    bulkPausedTask,
    bulkPausedElapsedSeconds,
    bulkPauseRequested,
    bulkLastCompletedTask,
    bulkLastElapsedSeconds,
    canBulkPrompt,
    canBulkGenerate,
    canBulkSave,
    autoAdvanceBulkActions,
    setAutoAdvanceBulkActions: setAutoAdvanceBulkActionsValue,
    anyApiActive,
    bulkActionsDisabled:
      bulkTask !== null || hasAnyRowTask || hasReferenceCheckInFlight || addLoading,
    canReset: !anyApiActive,
    canClearBatchRows:
      !anyApiActive && rows.some((row) => row.referenceCheckStatus === "duplicate" || row.saved),
    personaGenerationModels,
    addReferenceRowsFromInput,
    clearBatchRows,
    clearRow,
    updateContextPrompt,
    updatePersonaIdentity,
    runRowPromptAssist: executeRowPromptAssist,
    runRowGenerate: executeRowGenerate,
    runRowSave: executeRowSave,
    runBulkPromptAssist,
    runBulkGenerate,
    runBulkSave,
    requestBulkPause,
    resumeBulkTask,
    reset,
  };
}

export type PersonaBatchGenerationController = ReturnType<typeof usePersonaBatchGeneration>;
