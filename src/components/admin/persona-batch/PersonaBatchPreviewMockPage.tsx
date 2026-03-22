"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import type {
  AiModelConfig,
  AiProviderConfig,
  PersonaGenerationStructured,
} from "@/lib/ai/admin/control-plane-contract";
import type { PersonaBatchGenerationController } from "@/hooks/admin/usePersonaBatchGeneration";
import { derivePersonaUsername } from "@/lib/username-validation";
import { mockPersonaGenerationPreview } from "@/lib/ai/admin/persona-generation-preview-mock";
import { buildPersonaReferenceMatchKey } from "@/lib/ai/admin/persona-reference-normalization";
import { PersonaBatchPage } from "./PersonaBatchPage";

const previewProviders: AiProviderConfig[] = [
  {
    id: "provider-1",
    providerKey: "xai",
    displayName: "xAI",
    sdkPackage: "@ai-sdk/xai",
    status: "active",
    testStatus: "success",
    keyLast4: "1234",
    hasKey: true,
    lastApiErrorCode: null,
    lastApiErrorMessage: null,
    lastApiErrorAt: null,
    createdAt: "2026-03-22T00:00:00.000Z",
    updatedAt: "2026-03-22T00:00:00.000Z",
  },
];

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
  return [
    {
      rowId: "row-1",
      referenceName: "Anthony Bourdain",
      contextPrompt:
        "A globe-trotting storyteller who opens with sensory snapshots and attacks shallow taste with lived authority.",
      displayName: mockPersonaGenerationPreview.structured.persona.display_name,
      username: derivePersonaUsername(mockPersonaGenerationPreview.structured.persona.display_name),
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
  ];
}

export function PersonaBatchPreviewMockPage() {
  const [modelId, setModelId] = useState("model-1");
  const [referenceInput, setReferenceInput] = useState("Octavia Butler");
  const [chunkSize, setChunkSize] = useState(5);
  const [addLoading, setAddLoading] = useState(false);
  const [addElapsedSeconds, setAddElapsedSeconds] = useState(0);
  const [addLastCompletedElapsedSeconds, setAddLastCompletedElapsedSeconds] = useState<
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
  const [rows, setRows] = useState<PersonaBatchGenerationController["rows"]>(buildInitialRows);
  const addFinishTimerRef = useRef<number | null>(null);
  const addStartedAtRef = useRef<number | null>(null);
  const bulkTimerRef = useRef<number | null>(null);
  const bulkPauseRequestedRef = useRef(false);
  const rowTaskTimerRef = useRef<Record<string, number>>({});

  const clearAddTimer = useCallback(() => {
    if (addFinishTimerRef.current !== null) {
      window.clearTimeout(addFinishTimerRef.current);
      addFinishTimerRef.current = null;
    }
    addStartedAtRef.current = null;
  }, []);

  const clearBulkTimer = useCallback(() => {
    if (bulkTimerRef.current !== null) {
      window.clearTimeout(bulkTimerRef.current);
      bulkTimerRef.current = null;
    }
  }, []);

  const clearRowTaskTimers = useCallback(() => {
    for (const timerId of Object.values(rowTaskTimerRef.current)) {
      window.clearTimeout(timerId);
    }
    rowTaskTimerRef.current = {};
  }, []);

  useEffect(
    () => () => {
      clearAddTimer();
      clearBulkTimer();
      clearRowTaskTimers();
    },
    [clearAddTimer, clearBulkTimer, clearRowTaskTimers],
  );

  useEffect(() => {
    if (!addLoading || addStartedAtRef.current === null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (addStartedAtRef.current === null) {
        return;
      }
      const nextElapsed = Math.max(0, Math.floor((Date.now() - addStartedAtRef.current) / 1000));
      setAddElapsedSeconds((current) => (current === nextElapsed ? current : nextElapsed));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [addLoading]);

  const finishBulkTask = useCallback(
    (
      task: Exclude<PersonaBatchGenerationController["bulkTask"], null>,
      options: { elapsedOffset?: number } = {},
    ) => {
      clearBulkTimer();
      const elapsedOffset = options.elapsedOffset ?? 0;
      bulkPauseRequestedRef.current = false;
      setBulkPauseRequested(false);
      setBulkPausedTask(null);
      setBulkPausedElapsedSeconds(0);
      setBulkTask(task);
      setBulkElapsedSeconds(elapsedOffset);
      bulkTimerRef.current = window.setTimeout(() => {
        const completedElapsed = elapsedOffset + 1;
        setBulkTask(null);
        setBulkElapsedSeconds(0);
        if (bulkPauseRequestedRef.current) {
          bulkPauseRequestedRef.current = false;
          setBulkPauseRequested(false);
          setBulkPausedTask(task);
          setBulkPausedElapsedSeconds(completedElapsed);
        } else {
          setBulkLastCompletedTask(task);
          setBulkLastElapsedSeconds(completedElapsed);
        }
        bulkTimerRef.current = null;
      }, 1000);
    },
    [clearBulkTimer],
  );

  const resetPreviewState = useCallback(() => {
    clearAddTimer();
    clearBulkTimer();
    clearRowTaskTimers();
    bulkPauseRequestedRef.current = false;
    setModelId("model-1");
    setReferenceInput("Octavia Butler");
    setChunkSize(5);
    setAddLoading(false);
    setAddElapsedSeconds(0);
    setAddLastCompletedElapsedSeconds(null);
    setBulkTask(null);
    setBulkElapsedSeconds(0);
    setBulkPausedTask(null);
    setBulkPausedElapsedSeconds(0);
    setBulkPauseRequested(false);
    setBulkLastCompletedTask("generate");
    setBulkLastElapsedSeconds(31);
    setRows(buildInitialRows());
  }, [clearAddTimer, clearBulkTimer, clearRowTaskTimers]);

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
      chunkSize,
      setChunkSize,
      bulkTask,
      bulkElapsedSeconds,
      bulkPausedTask,
      bulkPausedElapsedSeconds,
      bulkPauseRequested,
      bulkLastCompletedTask,
      bulkLastElapsedSeconds,
      anyApiActive: addLoading || bulkTask !== null || rows.some((row) => row.activeTask !== null),
      bulkActionsDisabled: addLoading || bulkTask !== null || bulkPausedTask !== null,
      canReset: true,
      canRemoveDuplicates: rows.some((row) => row.referenceCheckStatus === "duplicate"),
      personaGenerationModels: previewModels,
      addReferenceRowsFromInput: async () => {
        const value = referenceInput.trim();
        if (!value) {
          return;
        }
        const existingNames = new Set(
          rows.map((row) => buildPersonaReferenceMatchKey(row.referenceName)),
        );
        const nextNames = value
          .split(/[\n,]/u)
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .filter((item) => {
            const normalized = buildPersonaReferenceMatchKey(item);
            if (existingNames.has(normalized)) {
              return false;
            }
            existingNames.add(normalized);
            return true;
          });
        if (nextNames.length === 0) {
          return;
        }
        clearAddTimer();
        addStartedAtRef.current = Date.now();
        setAddLoading(true);
        setAddElapsedSeconds(0);
        setAddLastCompletedElapsedSeconds(null);
        setRows((current) => [
          ...current,
          ...nextNames.map((referenceName, index) => ({
            rowId: `row-${current.length + index + 1}`,
            referenceName,
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
          setAddLoading(false);
          setAddElapsedSeconds(0);
          setAddLastCompletedElapsedSeconds(1);
          addFinishTimerRef.current = null;
          addStartedAtRef.current = null;
        }, 1000);
        setReferenceInput("");
      },
      removeDuplicateRows: async () => {
        setRows((current) => current.filter((row) => row.referenceCheckStatus !== "duplicate"));
      },
      clearRow: async (rowId) => {
        setRows((current) => current.filter((row) => row.rowId !== rowId));
      },
      updateContextPrompt: (rowId, contextPrompt) => {
        setRows((current) =>
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
        setRows((current) =>
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
      runRowPromptAssist: async (rowId) => {
        if (rowTaskTimerRef.current[rowId]) {
          window.clearTimeout(rowTaskTimerRef.current[rowId]);
        }
        setRows((current) =>
          current.map((row) =>
            row.rowId === rowId
              ? {
                  ...row,
                  activeTask: "prompt",
                  activeElapsedSeconds: 0,
                }
              : row,
          ),
        );
        rowTaskTimerRef.current[rowId] = window.setTimeout(() => {
          setRows((current) =>
            current.map((row) =>
              row.rowId === rowId
                ? {
                    ...row,
                    contextPrompt: `Mock AI prompt for ${row.referenceName}`,
                    activeTask: null,
                    activeElapsedSeconds: 0,
                    lastCompletedTask: "prompt",
                    lastCompletedElapsedSeconds: 1,
                    latestError: null,
                  }
                : row,
            ),
          );
          delete rowTaskTimerRef.current[rowId];
        }, 1000);
      },
      runRowGenerate: async (rowId) => {
        setRows((current) =>
          current.map((row) =>
            row.rowId === rowId
              ? {
                  ...row,
                  personaData: cloneStructured(mockPersonaGenerationPreview.structured),
                  displayName: mockPersonaGenerationPreview.structured.persona.display_name,
                  username: derivePersonaUsername(
                    mockPersonaGenerationPreview.structured.persona.display_name,
                  ),
                  saved: false,
                  promptChangedSinceGenerate: false,
                  lastCompletedTask: "generate",
                  lastCompletedElapsedSeconds: 18,
                  latestError: null,
                }
              : row,
          ),
        );
      },
      runRowSave: async (rowId) => {
        setRows((current) =>
          current.map((row) =>
            row.rowId === rowId
              ? {
                  ...row,
                  saved: true,
                  savedPersonaId: row.savedPersonaId ?? "persona-preview",
                  lastCompletedTask: "save",
                  lastCompletedElapsedSeconds: 4,
                  latestError: null,
                }
              : row,
          ),
        );
      },
      runBulkPromptAssist: async () => {
        finishBulkTask("prompt");
      },
      runBulkGenerate: async () => {
        finishBulkTask("generate");
      },
      runBulkSave: async () => {
        finishBulkTask("save");
      },
      requestBulkPause: () => {
        if (bulkTask === null || bulkPauseRequestedRef.current) {
          return;
        }
        bulkPauseRequestedRef.current = true;
        setBulkPauseRequested(true);
      },
      resumeBulkTask: async () => {
        if (bulkTask !== null || bulkPausedTask === null) {
          return;
        }
        const pausedTask = bulkPausedTask;
        const elapsedOffset = bulkPausedElapsedSeconds;
        finishBulkTask(pausedTask, { elapsedOffset });
      },
      reset: resetPreviewState,
    }),
    [
      addElapsedSeconds,
      addLastCompletedElapsedSeconds,
      addLoading,
      bulkElapsedSeconds,
      bulkLastCompletedTask,
      bulkLastElapsedSeconds,
      bulkPauseRequested,
      bulkPausedElapsedSeconds,
      bulkPausedTask,
      bulkTask,
      chunkSize,
      clearAddTimer,
      finishBulkTask,
      modelId,
      referenceInput,
      resetPreviewState,
      rows,
    ],
  );

  return (
    <PersonaBatchPage
      controller={controller}
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
