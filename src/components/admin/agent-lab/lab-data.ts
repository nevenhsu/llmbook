"use client";

import type {
  AiAgentRuntimeIntakeKind,
  AiAgentRuntimeSourceSnapshot,
} from "@/lib/ai/agent/intake/intake-read-model";
import {
  buildReferenceWindow,
  type TaskCandidatePreview,
} from "@/lib/ai/agent/intake/intake-preview";
import {
  buildAiAgentIntakeTrace,
  type AiAgentIntakeTrace,
} from "@/lib/ai/agent/intake/intake-trace";
import type { AiModelConfig } from "@/lib/ai/admin/control-plane-contract";
import type {
  AgentLabCandidateRow,
  AgentLabCandidateStage,
  AgentLabModeState,
  AgentLabSelectorRow,
  AgentLabSelectorStage,
  AgentLabSourceMode,
  AgentLabTaskRow,
} from "./types";

const DEFAULT_PERSONA_REFERENCE_BATCH_SIZE = 10;

function buildOpportunityLink(source: string, sourceId: string): string | null {
  if (source === "notification") {
    return null;
  }

  return source === "public-post" ? `/posts/${sourceId}` : `/comments/${sourceId}`;
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

function buildTaskRows(candidates: TaskCandidatePreview[], candidateRows: AgentLabCandidateRow[]) {
  const rowMap = new Map(candidateRows.map((row) => [row.targetPersona.id, row] as const));

  return candidates.map((candidate) => {
    const candidateRow = rowMap.get(candidate.personaId);
    return {
      taskId: null,
      candidateIndex: candidate.candidateIndex,
      opportunityKey: candidate.sourceId,
      persona: {
        id: candidate.personaId,
        displayName: candidateRow?.targetPersona.displayName ?? candidate.username,
        href: candidateRow?.targetPersona.href ?? `/personas/${candidate.personaId}`,
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
    } satisfies AgentLabTaskRow;
  });
}

export function filterLabModels(models: AiModelConfig[]) {
  return models.filter(
    (model) => model.capability === "text_generation" && model.status === "active",
  );
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
  };
}

export function buildModeStateFromTrace(
  trace: AiAgentIntakeTrace | null,
  sourceMode: AgentLabSourceMode,
): AgentLabModeState {
  if (!trace?.opportunities.input.selectorInput) {
    return buildEmptyModeState(sourceMode);
  }

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
    opportunities: trace.opportunities.input.sourceItems.map((item) => ({
      opportunityKey: item.sourceId,
      source: item.source as "public-post" | "public-comment" | "notification",
      link: buildOpportunityLink(item.source, item.sourceId),
      content: item.summary,
      createdAt: item.createdAt,
    })),
    selectorStage: {
      status: "idle",
      prompt: null,
      inputData: trace.opportunities.input,
      outputData: null,
      rows: [],
    },
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
  };
}

export function buildInitialModes(input: {
  notification: AiAgentRuntimeSourceSnapshot | null;
  public: AiAgentRuntimeSourceSnapshot | null;
}) {
  return {
    public: buildModeStateFromTrace(
      input.public ? buildAiAgentIntakeTrace(input.public) : null,
      "public",
    ),
    notification: buildModeStateFromTrace(
      input.notification ? buildAiAgentIntakeTrace(input.notification) : null,
      "notification",
    ),
  } satisfies Record<AgentLabSourceMode, AgentLabModeState>;
}

function buildSelectorRows(
  trace: AiAgentIntakeTrace,
  status: AgentLabSelectorStage["status"],
  errorMessage: string | null,
): AgentLabSelectorRow[] {
  const selectedReasons =
    trace.opportunities.result.selectorOutput?.selectedReferences.map((item) => item.reason) ?? [];

  return trace.opportunities.input.sourceItems.map((item, index) => ({
    opportunityKey: item.sourceId,
    source: item.source as "public-post" | "public-comment" | "notification",
    link: buildOpportunityLink(item.source, item.sourceId),
    content: item.summary,
    reason: status === "success" ? (selectedReasons[index % selectedReasons.length] ?? null) : null,
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
        ? (trace.opportunities.result.selectorOutput?.promptPreview ?? null)
        : null,
    inputData: trace.opportunities.input,
    outputData:
      status === "success"
        ? trace.opportunities.result
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
}): AgentLabSelectorStage {
  return buildSelectorStageFromTrace(
    input.snapshot ? buildAiAgentIntakeTrace(input.snapshot) : null,
    input,
  );
}

export function buildCandidateStageFromTrace(
  trace: AiAgentIntakeTrace | null,
  input?: {
    kind: AiAgentRuntimeIntakeKind;
    status?: Extract<AgentLabCandidateStage["status"], "success" | "error" | "auto-routed">;
    errorMessage?: string | null;
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
        selectedReferences: [],
        rows: [],
      } satisfies AgentLabCandidateStage,
      taskRows: [] satisfies AgentLabTaskRow[],
    };
  }

  const candidateRows = trace.candidates.result.taskCandidates.map((candidate) => {
    const persona =
      trace.candidates.result.resolvedPersonas.find(
        (item) => item.personaId === candidate.personaId,
      ) ?? null;
    return {
      opportunityKey: candidate.sourceId,
      referenceName: persona?.referenceSource ?? candidate.username,
      targetPersona: {
        id: candidate.personaId,
        displayName: persona?.displayName ?? candidate.username,
        href: `/personas/${candidate.personaId}`,
      },
      dispatchKind: candidate.dispatchKind,
      reason: candidate.decisionReason,
      dedupeKey: candidate.dedupeKey,
      errorMessage:
        resolvedInput.status === "error"
          ? (resolvedInput.errorMessage ?? "Candidate run failed.")
          : null,
    } satisfies AgentLabCandidateRow;
  });

  const selectedReferences =
    trace.opportunities.result.selectorOutput?.selectedReferences.map((reference) => {
      const persona = trace.candidates.result.resolvedPersonas.find(
        (item) => item.referenceSource === reference.referenceName,
      );
      return {
        referenceName: reference.referenceName,
        referenceId: reference.referenceName,
        personaId: persona?.personaId,
        personaDisplayName: persona?.displayName,
      };
    }) ?? [];

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
          : (trace.opportunities.result.selectorOutput?.promptPreview ?? null),
      inputData: trace.candidates.input,
      outputData:
        status === "error"
          ? {
              error: resolvedInput.errorMessage ?? "Candidate run failed.",
              candidatesInput: trace.candidates.input,
            }
          : trace.candidates.result,
      selectedReferences,
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
}) {
  return buildCandidateStageFromTrace(
    input.snapshot ? buildAiAgentIntakeTrace(input.snapshot) : null,
    input,
  );
}
