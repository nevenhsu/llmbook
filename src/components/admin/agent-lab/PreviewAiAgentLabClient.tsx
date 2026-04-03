"use client";

import { useMemo, useState } from "react";
import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-contract";
import type { AiAgentRuntimeSourceSnapshot } from "@/lib/ai/agent/intake/intake-read-model";
import { AiAgentLabSurface } from "./AiAgentLabSurface";
import {
  buildCandidateStage,
  buildEmptyModeState,
  buildModeState,
  buildInitialModes,
  buildSelectorStage,
  filterLabModels,
} from "./lab-data";
import type {
  AgentLabCandidateRow,
  AgentLabSaveTaskOutcome,
  AgentLabSelectorStage,
  AgentLabSourceMode,
  AgentLabTaskRow,
} from "./types";

type PreviewMockState = "default" | "empty" | "error";

type PreviewResults = {
  default: {
    saveOutcomes: Record<AgentLabSourceMode, Record<string, AgentLabSaveTaskOutcome>>;
  };
  error: {
    selectorErrors: Record<AgentLabSourceMode, string>;
    candidateErrors: Record<AgentLabSourceMode, string>;
    saveOutcomes: Record<AgentLabSourceMode, Record<string, AgentLabSaveTaskOutcome>>;
  };
};

type Props = {
  runtimePreviews: {
    notification: AiAgentRuntimeSourceSnapshot;
    public: AiAgentRuntimeSourceSnapshot;
  };
  models: AiModelConfig[];
  providers: AiProviderConfig[];
  results: PreviewResults;
  selectorReferenceBatchSize: number;
};

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildFallbackSaveOutcome(sourceMode: AgentLabSourceMode, candidateIndex: number) {
  return {
    inserted: true,
    skipReason: null,
    taskId: `mock-task-${sourceMode}-${candidateIndex + 1}`,
    errorMessage: null,
    status: "PENDING",
  } satisfies AgentLabSaveTaskOutcome;
}

function applySaveOutcomeToRow(
  row: AgentLabTaskRow,
  outcome: AgentLabSaveTaskOutcome,
): AgentLabTaskRow {
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

function buildMockSavedTaskRows(input: {
  sourceMode: AgentLabSourceMode;
  rows: AgentLabTaskRow[];
  mockState: PreviewMockState;
  results: PreviewResults;
}) {
  return input.rows.map((row) => {
    if (!row.candidate || !row.actions.canSave) {
      return row;
    }
    const candidateKey = String(row.candidate.candidateIndex);
    const outcome =
      (input.mockState === "error"
        ? input.results.error.saveOutcomes[input.sourceMode][candidateKey]
        : input.results.default.saveOutcomes[input.sourceMode][candidateKey]) ??
      buildFallbackSaveOutcome(input.sourceMode, row.candidate.candidateIndex);
    return applySaveOutcomeToRow(row, outcome);
  });
}

function findCompletedOpportunityKeys(input: {
  selectorStage: AgentLabSelectorStage;
  currentTaskRows: AgentLabTaskRow[];
}) {
  return new Set(
    input.selectorStage.rows
      .filter((row) => row.selected)
      .flatMap((row) => {
        const taskRows = input.currentTaskRows.filter(
          (taskRow) => taskRow.opportunityKey === row.opportunityKey,
        );
        if (taskRows.length === 0) {
          return [];
        }
        return taskRows.every((taskRow) => taskRow.saveState === "success")
          ? [row.opportunityKey]
          : [];
      }),
  );
}

function filterSelectorStageForRetry(input: {
  selectorStage: AgentLabSelectorStage;
  completedOpportunityKeys: Set<string>;
}) {
  if (input.completedOpportunityKeys.size === 0) {
    return input.selectorStage;
  }

  return {
    ...input.selectorStage,
    rows: input.selectorStage.rows.map((row) =>
      input.completedOpportunityKeys.has(row.opportunityKey) ? { ...row, selected: false } : row,
    ),
  } satisfies AgentLabSelectorStage;
}

function mergeCandidateRows(input: {
  existingRows: AgentLabCandidateRow[];
  nextRows: AgentLabCandidateRow[];
  completedOpportunityKeys: Set<string>;
}) {
  const preserved = input.existingRows.filter(
    (row) => row.opportunityKey && input.completedOpportunityKeys.has(row.opportunityKey),
  );
  const merged = [...preserved, ...input.nextRows];
  const seen = new Set<string>();
  return merged.filter((row) => {
    const key = `${row.opportunityKey ?? "none"}:${row.referenceName}:${row.persona?.id ?? "none"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeTaskRows(input: {
  existingRows: AgentLabTaskRow[];
  nextRows: AgentLabTaskRow[];
  completedOpportunityKeys: Set<string>;
}) {
  const preserved = input.existingRows.filter((row) =>
    input.completedOpportunityKeys.has(row.opportunityKey),
  );
  const merged = [...preserved, ...input.nextRows];
  const seen = new Set<string>();
  return merged.filter((row) => {
    const key = `${row.opportunityKey}:${row.persona.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function PreviewAiAgentLabClient({
  runtimePreviews,
  models,
  providers,
  results,
  selectorReferenceBatchSize,
}: Props) {
  const [mockState, setMockState] = useState<PreviewMockState>("default");
  const labModels = useMemo(() => filterLabModels(models), [models]);
  const initialModes = useMemo(() => {
    if (mockState === "empty") {
      return {
        public: buildEmptyModeState("public", {
          batchSize: selectorReferenceBatchSize,
          groupIndex: 0,
        }),
        notification: buildEmptyModeState("notification", {
          batchSize: selectorReferenceBatchSize,
          groupIndex: 0,
        }),
      };
    }

    return buildInitialModes({
      ...runtimePreviews,
      selectorReferenceBatchSize,
    });
  }, [mockState, runtimePreviews, selectorReferenceBatchSize]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-base-content/50 text-sm font-semibold tracking-[0.24em] uppercase">
          Mock State
        </span>
        <div className="flex gap-2">
          {(["default", "empty", "error"] as const).map((state) => (
            <button
              key={state}
              type="button"
              className={`btn btn-sm ${mockState === state ? "btn-neutral" : "btn-outline"}`}
              onClick={() => setMockState(state)}
            >
              {state[0].toUpperCase()}
              {state.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <AiAgentLabSurface
        key={mockState}
        dataSource="mock"
        titleEyebrow="Preview"
        title="AI Agent Lab"
        description="Mock-backed lab surface that mirrors admin runtime UX, including selector, candidate, and save flows."
        sourceModeOptions={[
          { value: "public", label: "Public Preview" },
          { value: "notification", label: "Notification Preview" },
        ]}
        initialSourceMode="public"
        models={labModels}
        providers={providers}
        initialModelId={labModels[0]?.id ?? ""}
        initialModes={initialModes}
        onRunSelector={async ({ sourceMode, personaGroup }) => {
          await wait(150);
          if (mockState === "empty") {
            return buildSelectorStage({
              snapshot: null,
              status: "error",
              errorMessage: "No opportunities available.",
              personaGroup,
            });
          }

          if (mockState === "error") {
            return buildSelectorStage({
              snapshot: runtimePreviews[sourceMode],
              status: "error",
              errorMessage: results.error.selectorErrors[sourceMode],
              personaGroup,
            });
          }

          return buildSelectorStage({
            snapshot: runtimePreviews[sourceMode],
            personaGroup,
          });
        }}
        onRunCandidate={async ({
          sourceMode,
          personaGroup,
          selectorStage,
          currentCandidateStage,
          currentTaskRows,
        }) => {
          await wait(150);
          const completedOpportunityKeys = findCompletedOpportunityKeys({
            selectorStage,
            currentTaskRows,
          });
          const retrySelectorStage = filterSelectorStageForRetry({
            selectorStage,
            completedOpportunityKeys,
          });
          if (mockState === "empty") {
            return {
              candidateStage: {
                status: sourceMode === "notification" ? "auto-routed" : "error",
                prompt: null,
                inputData: null,
                outputData: {
                  error: "No selector input available.",
                },
                rows: [],
              },
              taskRows: [],
            };
          }

          if (mockState === "error") {
            const result = buildCandidateStage({
              kind: sourceMode,
              snapshot: runtimePreviews[sourceMode],
              selectorStage: retrySelectorStage,
              status: sourceMode === "notification" ? "auto-routed" : "error",
              errorMessage: results.error.candidateErrors[sourceMode],
              personaGroup,
            });
            return {
              candidateStage: {
                ...result.candidateStage,
                rows: mergeCandidateRows({
                  existingRows: currentCandidateStage.rows,
                  nextRows: result.candidateStage.rows,
                  completedOpportunityKeys,
                }),
              },
              taskRows: mergeTaskRows({
                existingRows: currentTaskRows,
                nextRows: result.taskRows,
                completedOpportunityKeys,
              }),
            };
          }

          const result = buildCandidateStage({
            kind: sourceMode,
            snapshot: runtimePreviews[sourceMode],
            selectorStage: retrySelectorStage,
            personaGroup,
          });
          const savedTaskRows = buildMockSavedTaskRows({
            sourceMode,
            rows: result.taskRows,
            mockState,
            results,
          });
          return {
            candidateStage: {
              ...result.candidateStage,
              rows: mergeCandidateRows({
                existingRows: currentCandidateStage.rows,
                nextRows: result.candidateStage.rows,
                completedOpportunityKeys,
              }),
            },
            taskRows: mergeTaskRows({
              existingRows: currentTaskRows,
              nextRows: savedTaskRows,
              completedOpportunityKeys,
            }),
          };
        }}
        onSavePersonaGroup={async ({ sourceMode, personaGroup, selectorStage }) => {
          const nextModeState = buildModeState({
            snapshot: mockState === "empty" ? null : runtimePreviews[sourceMode],
            sourceMode,
            personaGroup: {
              batchSize: personaGroup.batchSize,
              groupIndex: sourceMode === "notification" ? 0 : personaGroup.groupIndex,
            },
          });

          if (mockState === "empty" || selectorStage.status !== "success") {
            return {
              personaGroup: nextModeState.personaGroup,
              candidateStage: nextModeState.candidateStage,
              taskRows: [],
            };
          }

          if (mockState === "error") {
            const result = buildCandidateStage({
              kind: sourceMode,
              snapshot: runtimePreviews[sourceMode],
              selectorStage,
              status: sourceMode === "notification" ? "auto-routed" : "error",
              errorMessage: results.error.candidateErrors[sourceMode],
              personaGroup: {
                batchSize: personaGroup.batchSize,
                groupIndex: sourceMode === "notification" ? 0 : personaGroup.groupIndex,
              },
            });
            return {
              personaGroup: nextModeState.personaGroup,
              candidateStage: result.candidateStage,
              taskRows: [],
            };
          }

          const result = buildCandidateStage({
            kind: sourceMode,
            snapshot: runtimePreviews[sourceMode],
            selectorStage,
            personaGroup: {
              batchSize: personaGroup.batchSize,
              groupIndex: sourceMode === "notification" ? 0 : personaGroup.groupIndex,
            },
          });

          return {
            personaGroup: nextModeState.personaGroup,
            candidateStage: result.candidateStage,
            taskRows: buildMockSavedTaskRows({
              sourceMode,
              rows: result.taskRows,
              mockState,
              results,
            }),
          };
        }}
        onSaveTask={async ({ sourceMode, row }) => {
          await wait(150);
          if (!row.candidate) {
            throw new Error("Task row is missing candidate payload.");
          }

          if (mockState === "empty") {
            return {
              inserted: false,
              skipReason: "empty_state",
              taskId: null,
              errorMessage: "No mock task available to save.",
              status: "FAILED",
            };
          }

          const candidateKey = String(row.candidate.candidateIndex);
          const outcome =
            (mockState === "error"
              ? results.error.saveOutcomes[sourceMode][candidateKey]
              : results.default.saveOutcomes[sourceMode][candidateKey]) ??
            buildFallbackSaveOutcome(sourceMode, row.candidate.candidateIndex);

          return outcome;
        }}
      />
    </div>
  );
}
