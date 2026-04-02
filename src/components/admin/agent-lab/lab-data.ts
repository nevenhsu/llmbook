"use client";

import type {
  AiAgentRuntimeIntakeKind,
  AiAgentRuntimeSourceSnapshot,
} from "@/lib/ai/agent/intake/intake-read-model";
import {
  buildReferenceWindow,
  resolvePersonasForReferences,
  type TaskCandidatePreview,
} from "@/lib/ai/agent/intake/intake-preview";
import {
  buildAiAgentIntakeTrace,
  type AiAgentIntakeTraceOverrides,
  type AiAgentIntakeTrace,
} from "@/lib/ai/agent/intake/intake-trace";
import type { AiModelConfig, PersonaSummary } from "@/lib/ai/admin/control-plane-contract";
import type {
  AgentLabCandidateRow,
  AgentLabCandidateStage,
  AgentLabModeState,
  AgentLabPersonaInfo,
  AgentLabPersonaGroupInput,
  AgentLabSelectorStage,
  AgentLabSourceMode,
  AgentLabTaskRow,
} from "./types";

const DEFAULT_PERSONA_REFERENCE_BATCH_SIZE = 10;

function buildOpportunityLink(input: {
  source: string;
  sourceId: string;
  metadata?: Record<string, unknown>;
}): string | null {
  const boardSlug = typeof input.metadata?.boardSlug === "string" ? input.metadata.boardSlug : null;
  const postId = typeof input.metadata?.postId === "string" ? input.metadata.postId : null;
  const commentId = typeof input.metadata?.commentId === "string" ? input.metadata.commentId : null;

  if (input.source === "notification") {
    if (boardSlug && postId && commentId) {
      return `/r/${boardSlug}/posts/${postId}#comment-${commentId}`;
    }
    if (boardSlug && postId) {
      return `/r/${boardSlug}/posts/${postId}`;
    }
    return null;
  }

  if (input.source === "public-post" && boardSlug && postId) {
    return `/r/${boardSlug}/posts/${postId}`;
  }

  if (input.source === "public-comment" && boardSlug && postId && commentId) {
    return `/r/${boardSlug}/posts/${postId}#comment-${commentId}`;
  }

  return null;
}

function buildLookupMaps(trace: AiAgentIntakeTrace) {
  const lookupByKey = new Map(
    trace.opportunities.input.selectorInput?.opportunityLookup.map((item) => [
      item.opportunityKey,
      item,
    ]) ?? [],
  );
  const sourceByKey = new Map(
    trace.opportunities.input.selectorInput?.opportunities.map((item) => [
      item.opportunityKey,
      item,
    ]) ?? [],
  );

  return {
    lookupByKey,
    sourceByKey,
  };
}

function buildPersonaMap(
  trace: AiAgentIntakeTrace,
  personaSummaries?: PersonaSummary[],
): Map<string, AgentLabPersonaInfo> {
  const summaryById = new Map((personaSummaries ?? []).map((persona) => [persona.id, persona]));
  const personaInfoById = new Map<string, AgentLabPersonaInfo>();

  for (const persona of trace.resolvedPersonas.result.resolvedPersonas) {
    const summary = summaryById.get(persona.personaId);
    personaInfoById.set(persona.personaId, {
      id: persona.personaId,
      displayName: summary?.display_name ?? persona.displayName,
      username: summary?.username ?? persona.username,
      avatarUrl: summary?.avatar_url ?? null,
      href: `/u/${summary?.username ?? persona.username}`,
      status: summary?.status === "inactive" ? "inactive" : persona.active ? "active" : "inactive",
    });
  }

  for (const candidate of trace.tasks.result.taskCandidates) {
    if (personaInfoById.has(candidate.personaId)) {
      continue;
    }

    const summary = summaryById.get(candidate.personaId);
    personaInfoById.set(candidate.personaId, {
      id: candidate.personaId,
      displayName: summary?.display_name ?? candidate.username,
      username: summary?.username ?? candidate.username,
      avatarUrl: summary?.avatar_url ?? null,
      href: `/u/${summary?.username ?? candidate.username}`,
      status: summary?.status === "inactive" ? "inactive" : "active",
    });
  }

  return personaInfoById;
}

function toTaskType(candidate: TaskCandidatePreview): "comment" | "post" | "reply" {
  if (candidate.payload.contentType === "post") {
    return "post";
  }

  if (candidate.dispatchKind === "notification" && candidate.payload.contentType === "reply") {
    return "reply";
  }

  return "comment";
}

function toInjectPersonaTasksCandidate(candidate: TaskCandidatePreview) {
  return {
    candidate_index: candidate.candidateIndex,
    persona_id: candidate.personaId,
    task_type: toTaskType(candidate),
    dispatch_kind: candidate.dispatchKind,
    source_table: candidate.sourceTable,
    source_id: candidate.sourceId,
    dedupe_key: candidate.dedupeKey,
    cooldown_until: candidate.cooldownUntil,
    decision_reason: candidate.decisionReason,
    payload: candidate.payload,
  };
}

function buildTaskRows(candidates: TaskCandidatePreview[], candidateRows: AgentLabCandidateRow[]) {
  const candidateMap = new Map(
    candidates.map((candidate) => [
      `${candidate.opportunityKey}:${candidate.personaId}`,
      candidate,
    ]),
  );

  return candidateRows
    .filter((row) => row.opportunityKey && row.persona)
    .flatMap((row) => {
      const candidate = candidateMap.get(`${row.opportunityKey}:${row.persona!.id}`);
      if (!candidate) {
        return [];
      }

      return [
        {
          taskId: null,
          candidateIndex: candidate.candidateIndex,
          opportunityKey: candidate.opportunityKey,
          persona: {
            id: candidate.personaId,
            displayName: row.persona!.displayName,
            username: row.persona!.username,
            avatarUrl: row.persona!.avatarUrl,
            href: row.persona!.href,
            status: row.persona!.status,
          },
          taskType: toTaskType(candidate),
          status: "PENDING",
          saveState: "idle",
          errorMessage: null,
          saveResult: null,
          data: {
            candidateIndex: candidate.candidateIndex,
            dispatchKind: candidate.dispatchKind,
            sourceTable: candidate.sourceTable,
            sourceId: candidate.sourceId,
            dedupeKey: candidate.dedupeKey,
            payload: candidate.payload,
          },
          candidate,
          actions: {
            canSave: true,
          },
        } satisfies AgentLabTaskRow,
      ];
    });
}

function buildParsedOpportunityOutput(trace: AiAgentIntakeTrace) {
  return {
    opportunity_probabilities:
      trace.opportunities.result.selectedOpportunities?.opportunityProbabilities.map((item) => ({
        opportunity_key: item.opportunityKey,
        probability: item.probability,
      })) ?? [],
  };
}

export function filterLabModels(models: AiModelConfig[]) {
  return models.filter(
    (model) => model.capability === "text_generation" && model.status === "active",
  );
}

export function buildTaskSavePayloadData(taskRows: AgentLabTaskRow[]) {
  return {
    injectPersonaTasksCandidates: taskRows.flatMap((row) =>
      row.candidate ? [toInjectPersonaTasksCandidate(row.candidate)] : [],
    ),
  };
}

export function buildEmptyModeState(sourceMode: AgentLabSourceMode): AgentLabModeState {
  return {
    personaGroup: {
      totalReferenceCount: 0,
      batchSize: DEFAULT_PERSONA_REFERENCE_BATCH_SIZE,
      groupIndex: 0,
      maxGroupIndex: 0,
    },
    opportunities: [],
    selectorStage: {
      status: "idle",
      prompt: null,
      inputData: null,
      outputData: null,
      rows: [],
    },
    candidateStage: {
      status: sourceMode === "notification" ? "auto-routed" : "idle",
      prompt: null,
      inputData: null,
      outputData: null,
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
  };
}

export function buildModeStateFromTrace(
  trace: AiAgentIntakeTrace | null,
  sourceMode: AgentLabSourceMode,
  personaSummaries?: PersonaSummary[],
): AgentLabModeState {
  if (!trace?.opportunities.input.selectorInput) {
    return buildEmptyModeState(sourceMode);
  }

  const candidateStageFromTrace = buildCandidateStageFromTrace(trace, {
    kind: trace.kind,
    status: trace.kind === "notification" ? "auto-routed" : "success",
    personaSummaries,
  }).candidateStage;
  const seededCandidateRows = candidateStageFromTrace.rows.map((row) => ({
    ...row,
    opportunityKey: null,
  }));

  const referenceWindow = buildReferenceWindow({
    batchSize:
      trace.opportunities.input.selectorInput.referenceWindow.batchSize > 0
        ? trace.opportunities.input.selectorInput.referenceWindow.batchSize
        : DEFAULT_PERSONA_REFERENCE_BATCH_SIZE,
    groupIndex: trace.opportunities.input.selectorInput.referenceWindow.groupIndex,
  });
  const resolvedBatchSize =
    trace.opportunities.input.selectorInput.referenceWindow.batchSize > 0
      ? trace.opportunities.input.selectorInput.referenceWindow.batchSize
      : DEFAULT_PERSONA_REFERENCE_BATCH_SIZE;
  const maxGroupIndex =
    resolvedBatchSize > 0
      ? Math.max(0, Math.ceil(referenceWindow.totalReferences / resolvedBatchSize) - 1)
      : 0;

  return {
    personaGroup: {
      totalReferenceCount: referenceWindow.totalReferences,
      batchSize: resolvedBatchSize,
      groupIndex: trace.opportunities.input.selectorInput.referenceWindow.groupIndex,
      maxGroupIndex,
    },
    opportunities: buildSelectorRows(trace, "idle", null),
    selectorStage: {
      status: "idle",
      prompt: trace.opportunities.result.selectedOpportunities?.promptPreview ?? null,
      inputData: null,
      outputData: null,
      rows: [],
    },
    candidateStage: {
      status: sourceMode === "notification" ? "auto-routed" : "idle",
      prompt: candidateStageFromTrace.prompt,
      inputData: candidateStageFromTrace.inputData,
      outputData: candidateStageFromTrace.outputData,
      rows: seededCandidateRows,
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
  };
}

export function buildInitialModes(input: {
  notification: AiAgentRuntimeSourceSnapshot | null;
  public: AiAgentRuntimeSourceSnapshot | null;
  personaSummaries?: PersonaSummary[];
}) {
  return {
    public: buildModeStateFromTrace(
      input.public ? buildAiAgentIntakeTrace(input.public) : null,
      "public",
      input.personaSummaries,
    ),
    notification: buildModeStateFromTrace(
      input.notification ? buildAiAgentIntakeTrace(input.notification) : null,
      "notification",
      input.personaSummaries,
    ),
  } satisfies Record<AgentLabSourceMode, AgentLabModeState>;
}

function buildSelectorRows(
  trace: AiAgentIntakeTrace,
  status: AgentLabSelectorStage["status"],
  errorMessage: string | null,
): AgentLabModeState["opportunities"] {
  const probabilities = new Map(
    trace.opportunities.result.selectedOpportunities?.opportunityProbabilities.map((item) => [
      item.opportunityKey,
      item.probability,
    ]) ?? [],
  );
  return (trace.opportunities.input.selectorInput?.opportunityLookup ?? []).map((item) => ({
    opportunityKey: item.opportunityKey,
    source: item.source as "public-post" | "public-comment" | "notification",
    link: buildOpportunityLink({
      source: item.source,
      sourceId: item.sourceId,
      metadata: item.metadata,
    }),
    content: item.summary,
    createdAt:
      trace.opportunities.input.sourceItems.find((source) => source.sourceId === item.sourceId)
        ?.createdAt ?? null,
    probability: status === "success" ? (probabilities.get(item.opportunityKey) ?? null) : null,
    selected: status === "success" ? (probabilities.get(item.opportunityKey) ?? 0) > 0.5 : false,
    errorMessage: status === "error" ? errorMessage : null,
  }));
}

export function buildSelectorStageFromTrace(
  trace: AiAgentIntakeTrace | null,
  input?: {
    status?: AgentLabSelectorStage["status"];
    errorMessage?: string | null;
  },
): AgentLabSelectorStage {
  if (!trace?.opportunities.input.selectorInput) {
    return {
      status: "error",
      prompt: null,
      inputData: null,
      outputData: {
        error: "No opportunities available.",
      },
      rows: [],
    };
  }

  const status = input?.status ?? "success";
  const errorMessage = input?.errorMessage ?? "Selector run failed.";

  return {
    status,
    prompt:
      status === "success"
        ? (trace.opportunities.result.selectedOpportunities?.promptPreview ?? null)
        : null,
    inputData: trace.opportunities.input,
    outputData:
      status === "success"
        ? buildParsedOpportunityOutput(trace)
        : {
            error: errorMessage,
            opportunitiesInput: trace.opportunities.input,
          },
    rows: buildSelectorRows(trace, status, errorMessage),
  };
}

export function buildSelectorStage(input: {
  snapshot: AiAgentRuntimeSourceSnapshot | null;
  status?: AgentLabSelectorStage["status"];
  errorMessage?: string | null;
  personaGroup?: AgentLabPersonaGroupInput;
}): AgentLabSelectorStage {
  return buildSelectorStageFromTrace(
    input.snapshot
      ? buildAiAgentIntakeTrace(input.snapshot, {
          selectorReferenceBatchSize: input.personaGroup?.batchSize,
          groupIndexOverride: input.personaGroup?.groupIndex,
        } satisfies AiAgentIntakeTraceOverrides)
      : null,
    input,
  );
}

export function buildCandidateStageFromTrace(
  trace: AiAgentIntakeTrace | null,
  input?: {
    kind: AiAgentRuntimeIntakeKind;
    status?: Extract<AgentLabCandidateStage["status"], "success" | "error" | "auto-routed">;
    errorMessage?: string | null;
    personaSummaries?: PersonaSummary[];
  },
): {
  candidateStage: AgentLabCandidateStage;
  taskRows: AgentLabTaskRow[];
} {
  const resolvedInput = input ?? { kind: trace?.kind ?? "public" };

  if (!trace?.opportunities.input.selectorInput) {
    return {
      candidateStage: {
        status: resolvedInput.kind === "notification" ? "auto-routed" : "error",
        prompt: null,
        inputData: null,
        outputData: {
          error: "No selector input available.",
        },
        rows: [],
      } satisfies AgentLabCandidateStage,
      taskRows: [] satisfies AgentLabTaskRow[],
    };
  }

  const referenceBatch =
    trace.candidates.result.candidateSelection?.actualModelPayload.compactContext.referenceBatch ??
    buildReferenceWindow({
      batchSize: trace.opportunities.input.selectorInput.referenceWindow.batchSize,
      groupIndex: trace.opportunities.input.selectorInput.referenceWindow.groupIndex,
    }).window;

  const previewResolvedPersonas = resolvePersonasForReferences({
    selectedReferences: referenceBatch.map((referenceName) => ({
      referenceName,
    })),
  });
  const previewResolvedPersonaByReference = new Map(
    previewResolvedPersonas.map((persona) => [persona.referenceSource, persona] as const),
  );
  const personaInfoById = buildPersonaMap(trace, resolvedInput.personaSummaries);
  const personaByReference = new Map(
    referenceBatch.map((referenceName) => {
      const resolvedPersona =
        trace.resolvedPersonas.result.resolvedPersonas.find(
          (persona) => persona.referenceSource === referenceName,
        ) ?? previewResolvedPersonaByReference.get(referenceName);
      return [
        referenceName,
        resolvedPersona
          ? (personaInfoById.get(resolvedPersona.personaId) ??
            ({
              id: resolvedPersona.personaId,
              displayName: resolvedPersona.displayName,
              username: resolvedPersona.username,
              avatarUrl: null,
              href: `/u/${resolvedPersona.username}`,
              status: resolvedPersona.active ? "active" : "inactive",
            } satisfies AgentLabPersonaInfo))
          : null,
      ] as const;
    }),
  );

  const selectedAssignments =
    resolvedInput.kind === "notification"
      ? trace.tasks.result.taskCandidates.map((candidate) => ({
          opportunityKey: candidate.opportunityKey,
          referenceName:
            trace.resolvedPersonas.result.resolvedPersonas.find(
              (persona) => persona.personaId === candidate.personaId,
            )?.referenceSource ?? candidate.username,
          persona: personaInfoById.get(candidate.personaId) ?? null,
        }))
      : (trace.candidates.result.candidateSelection?.candidateSelections.flatMap((selection) =>
          selection.selectedReferences.map((referenceName) => ({
            opportunityKey: selection.opportunityKey,
            referenceName,
            persona: personaByReference.get(referenceName) ?? null,
          })),
        ) ?? []);

  const unselectedRows =
    resolvedInput.kind === "notification"
      ? []
      : referenceBatch
          .filter(
            (referenceName) =>
              !selectedAssignments.some((assignment) => assignment.referenceName === referenceName),
          )
          .map((referenceName) => ({
            opportunityKey: null,
            referenceName,
            persona: personaByReference.get(referenceName) ?? null,
            errorMessage: null,
          }));

  const candidateRows = [...selectedAssignments, ...unselectedRows]
    .map((row) => ({
      opportunityKey: row.opportunityKey,
      referenceName: row.referenceName,
      persona: row.persona,
      errorMessage:
        resolvedInput.status === "error"
          ? (resolvedInput.errorMessage ?? "Candidate run failed.")
          : null,
    }))
    .sort((a, b) => {
      if (a.opportunityKey && !b.opportunityKey) return -1;
      if (!a.opportunityKey && b.opportunityKey) return 1;
      if (a.opportunityKey && b.opportunityKey) {
        const keyCompare = a.opportunityKey.localeCompare(b.opportunityKey);
        if (keyCompare !== 0) return keyCompare;
      }
      return a.referenceName.localeCompare(b.referenceName);
    }) satisfies AgentLabCandidateRow[];

  const status =
    resolvedInput.status ?? (resolvedInput.kind === "notification" ? "auto-routed" : "success");
  const taskRows =
    status === "error" ? [] : buildTaskRows(trace.tasks.result.taskCandidates, candidateRows);

  return {
    candidateStage: {
      status,
      prompt:
        resolvedInput.kind === "notification" || status === "error"
          ? null
          : (trace.candidates.result.candidateSelection?.promptPreview ?? null),
      inputData: trace.candidates.input,
      outputData:
        status === "error"
          ? {
              error: resolvedInput.errorMessage ?? "Candidate run failed.",
              candidatesInput: trace.candidates.input,
            }
          : trace.candidates.result,
      rows: candidateRows,
    } satisfies AgentLabCandidateStage,
    taskRows,
  };
}

export function buildCandidateStage(input: {
  kind: AiAgentRuntimeIntakeKind;
  snapshot: AiAgentRuntimeSourceSnapshot | null;
  status?: Extract<AgentLabCandidateStage["status"], "success" | "error" | "auto-routed">;
  errorMessage?: string | null;
  personaGroup?: AgentLabPersonaGroupInput;
  personaSummaries?: PersonaSummary[];
}) {
  return buildCandidateStageFromTrace(
    input.snapshot
      ? buildAiAgentIntakeTrace(input.snapshot, {
          selectorReferenceBatchSize: input.personaGroup?.batchSize,
          groupIndexOverride: input.personaGroup?.groupIndex,
        } satisfies AiAgentIntakeTraceOverrides)
      : null,
    input,
  );
}
