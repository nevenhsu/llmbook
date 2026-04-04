"use client";

import { apiPost } from "@/lib/api/fetch-json";
import type { AiAgentTaskInjectionExecutedResponse } from "@/lib/ai/agent/intake/task-injection-service";
import type { AiAgentRuntimeSourceSnapshot } from "@/lib/ai/agent/intake/intake-read-model";
import type {
  AiModelConfig,
  AiProviderConfig,
  PersonaSummary,
} from "@/lib/ai/admin/control-plane-contract";
import { AiAgentLabSurface } from "./AiAgentLabSurface";
import {
  buildCandidateStageFromResolvedRows,
  buildCandidateStage,
  buildModeState,
  buildInitialModes,
  buildSelectorStage,
  filterLabModels,
} from "./lab-data";
import type {
  AgentLabOpportunityRow,
  AgentLabCandidateRow,
  AgentLabSelectorStage,
  AgentLabTaskRow,
} from "./types";
import type { AdminPublicCandidateBatchResult } from "@/lib/ai/agent/intake/opportunity-pipeline-service";

const STAGE_BATCH_SIZE = 10;

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
    if (seen.has(key)) {
      return false;
    }
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
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function applyAdminBatchTaskOutcome(input: {
  row: AgentLabTaskRow;
  taskOutcomes: Map<
    string,
    {
      inserted: boolean;
      taskId: string | null;
      skipReason: string | null;
      status: string;
      errorMessage: string | null;
    }
  >;
}) {
  const outcome = input.taskOutcomes.get(`${input.row.opportunityKey}:${input.row.persona.id}`);
  if (!outcome) {
    return input.row;
  }

  return {
    ...input.row,
    taskId: outcome.taskId ?? input.row.taskId,
    status: outcome.status,
    saveState: outcome.inserted ? "success" : "failed",
    errorMessage: outcome.errorMessage ?? outcome.skipReason,
    saveResult: {
      candidateIndex: input.row.candidateIndex,
      inserted: outcome.inserted,
      skipReason: outcome.skipReason,
      taskId: outcome.taskId,
    },
    actions: {
      canSave: !outcome.inserted,
    },
  } satisfies AgentLabTaskRow;
}

type Props = {
  runtimePreviews: {
    notification: AiAgentRuntimeSourceSnapshot | null;
    public: AiAgentRuntimeSourceSnapshot | null;
  };
  models: AiModelConfig[];
  providers: AiProviderConfig[];
  personas: PersonaSummary[];
  selectorReferenceBatchSize: number;
};

export function AdminAiAgentLabClient({
  runtimePreviews,
  models,
  providers,
  personas,
  selectorReferenceBatchSize,
}: Props) {
  const labModels = filterLabModels(models);

  return (
    <AiAgentLabSurface
      dataSource="runtime"
      titleEyebrow="Admin"
      title="AI Agent Lab"
      description="Live runtime inspection and manual task insertion surface for public and notification intake."
      sourceModeOptions={[
        { value: "public", label: "Public Runtime" },
        { value: "notification", label: "Notification Runtime" },
      ]}
      initialSourceMode="public"
      models={labModels}
      providers={providers}
      initialModelId={labModels[0]?.id ?? ""}
      initialModes={buildInitialModes({
        ...runtimePreviews,
        personaSummaries: personas,
        selectorReferenceBatchSize,
        usePersistedOpportunityState: true,
      })}
      onRunSelector={async ({ sourceMode, personaGroup, currentOpportunities, onProgress }) => {
        await apiPost<{ snapshot: AiAgentRuntimeSourceSnapshot | null }>(
          `/api/admin/ai/agent/lab/source-mode/${sourceMode}`,
          {
            batchSize: personaGroup.batchSize,
            groupIndex: sourceMode === "notification" ? 0 : personaGroup.groupIndex,
            score: false,
          },
        );
        const unscoredRows = currentOpportunities.filter(
          (row) => row.recordId && row.probability === null,
        );
        const batch = unscoredRows.slice(0, STAGE_BATCH_SIZE);
        if (batch.length > 0) {
          await apiPost<{ ok: true }>(`/api/admin/ai/agent/lab/opportunities/${sourceMode}`, {
            opportunityIds: batch.flatMap((row) => (row.recordId ? [row.recordId] : [])),
          });
        }

        const refreshed = await apiPost<{ snapshot: AiAgentRuntimeSourceSnapshot | null }>(
          `/api/admin/ai/agent/lab/source-mode/${sourceMode}`,
          {
            batchSize: personaGroup.batchSize,
            groupIndex: sourceMode === "notification" ? 0 : personaGroup.groupIndex,
            score: false,
          },
        );

        const nextStage = buildSelectorStage({
          snapshot: refreshed.snapshot,
          personaGroup,
        });
        onProgress?.(nextStage);
        return nextStage;
      }}
      onRunCandidate={async ({
        sourceMode,
        personaGroup,
        selectorStage,
        currentCandidateStage,
        currentTaskRows,
        onProgress,
      }) => {
        const response = await apiPost<{ snapshot: AiAgentRuntimeSourceSnapshot | null }>(
          `/api/admin/ai/agent/lab/source-mode/${sourceMode}`,
          {
            batchSize: personaGroup.batchSize,
            groupIndex: sourceMode === "notification" ? 0 : personaGroup.groupIndex,
            score: false,
          },
        );
        const completedOpportunityKeys = findCompletedOpportunityKeys({
          selectorStage,
          currentTaskRows,
        });
        const retrySelectorStage = filterSelectorStageForRetry({
          selectorStage,
          completedOpportunityKeys,
        });
        const result = buildCandidateStage({
          kind: sourceMode,
          snapshot: response.snapshot,
          selectorStage: retrySelectorStage,
          personaGroup,
          personaSummaries: personas,
        });

        if (sourceMode === "notification" || result.taskRows.length === 0) {
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

        const opportunityKeyByRecordId = new Map(
          retrySelectorStage.rows.flatMap((row) =>
            row.recordId ? [[row.recordId, row.opportunityKey] as const] : [],
          ),
        );
        const selectedRowsToRun = retrySelectorStage.rows.filter(
          (row) =>
            row.selected && row.recordId && !completedOpportunityKeys.has(row.opportunityKey),
        );
        const resolvedRows: Array<{
          opportunityKey: string;
          referenceName: string;
          probability: number;
          personaId: string;
        }> = [];
        const taskOutcomes = new Map<
          string,
          {
            inserted: boolean;
            taskId: string | null;
            skipReason: string | null;
            status: string;
            errorMessage: string | null;
          }
        >();
        const buildProgressState = () => {
          const explicitResult = buildCandidateStageFromResolvedRows({
            kind: sourceMode,
            snapshot: response.snapshot,
            selectorStage: retrySelectorStage,
            resolvedRows,
            personaGroup,
            personaSummaries: personas,
          });
          const nextTaskRows = explicitResult.taskRows.map((row) =>
            applyAdminBatchTaskOutcome({
              row,
              taskOutcomes,
            }),
          );

          return {
            candidateStage: {
              ...explicitResult.candidateStage,
              rows: mergeCandidateRows({
                existingRows: currentCandidateStage.rows,
                nextRows: explicitResult.candidateStage.rows,
                completedOpportunityKeys,
              }),
            },
            taskRows: mergeTaskRows({
              existingRows: currentTaskRows,
              nextRows: nextTaskRows,
              completedOpportunityKeys,
            }),
          };
        };

        const batch = selectedRowsToRun.slice(0, STAGE_BATCH_SIZE);
        if (batch.length > 0) {
          const batchResponse = await apiPost<AdminPublicCandidateBatchResult>(
            "/api/admin/ai/agent/lab/candidates/public",
            {
              opportunityIds: batch.flatMap((row) => (row.recordId ? [row.recordId] : [])),
              groupIndex: personaGroup.groupIndex,
              batchSize: personaGroup.batchSize,
            },
          );

          batchResponse.resolvedRows.forEach((row) => {
            const opportunityKey = opportunityKeyByRecordId.get(row.opportunityId);
            if (!opportunityKey) {
              return;
            }
            resolvedRows.push({
              opportunityKey,
              referenceName: row.referenceName,
              probability: row.probability,
              personaId: row.personaId,
            });
          });

          batchResponse.taskOutcomes.forEach((outcome) => {
            const opportunityKey = opportunityKeyByRecordId.get(outcome.opportunityId);
            if (!opportunityKey) {
              return;
            }
            taskOutcomes.set(`${opportunityKey}:${outcome.personaId}`, {
              inserted: outcome.inserted,
              taskId: outcome.taskId,
              skipReason: outcome.skipReason,
              status: outcome.status,
              errorMessage: outcome.errorMessage,
            });
          });
        }
        const nextState = buildProgressState();
        onProgress?.(nextState);
        return nextState;
      }}
      onSavePersonaGroup={async ({ sourceMode, personaGroup, selectorStage }) => {
        const sourceResponse = await apiPost<{ snapshot: AiAgentRuntimeSourceSnapshot | null }>(
          `/api/admin/ai/agent/lab/source-mode/${sourceMode}`,
          {
            batchSize: personaGroup.batchSize,
            groupIndex: sourceMode === "notification" ? 0 : personaGroup.groupIndex,
            score: false,
          },
        );
        const snapshot = sourceResponse.snapshot;
        const nextModeState = buildModeState({
          snapshot,
          sourceMode,
          personaSummaries: personas,
          usePersistedOpportunityState: true,
          personaGroup: {
            batchSize: personaGroup.batchSize,
            groupIndex: sourceMode === "notification" ? 0 : personaGroup.groupIndex,
          },
        });

        if (selectorStage.status !== "success") {
          return {
            personaGroup: nextModeState.personaGroup,
            candidateStage: nextModeState.candidateStage,
            taskRows: [],
          };
        }

        const result = buildCandidateStage({
          kind: sourceMode,
          snapshot,
          selectorStage,
          personaGroup: {
            batchSize: personaGroup.batchSize,
            groupIndex: sourceMode === "notification" ? 0 : personaGroup.groupIndex,
          },
          personaSummaries: personas,
        });

        return {
          personaGroup: nextModeState.personaGroup,
          candidateStage: result.candidateStage,
          taskRows: result.taskRows,
        };
      }}
      onSaveTask={async ({ row }) => {
        if (!row.candidate) {
          throw new Error("Task row is missing candidate payload.");
        }

        const response = await apiPost<AiAgentTaskInjectionExecutedResponse>(
          "/api/admin/ai/agent/lab/save-task",
          {
            candidates: [row.candidate],
          },
        );
        const result = response.injectionPreview.results[0] ?? null;
        const insertedTask = response.insertedTasks[0] ?? null;

        return {
          inserted: result?.inserted ?? false,
          skipReason: result?.skipReason ?? null,
          taskId: result?.taskId ?? null,
          errorMessage: result?.skipReason ?? insertedTask?.errorMessage ?? null,
          status: insertedTask?.status ?? (result?.inserted ? "PENDING" : "FAILED"),
        };
      }}
    />
  );
}
