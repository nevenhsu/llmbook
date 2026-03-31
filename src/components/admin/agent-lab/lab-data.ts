"use client";

import type {
  AiAgentRuntimeIntakeKind,
  AiAgentRuntimeSourceSnapshot,
} from "@/lib/ai/agent/intake/intake-read-model";
import {
  buildReferenceWindow,
  buildResolvedPersonasPreview,
  buildSelectorOutputPreview,
  buildTaskCandidatePreview,
  type SelectorInputPreview,
  type TaskCandidatePreview,
} from "@/lib/ai/agent/intake/intake-preview";
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
      batchSize: 0,
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

export function buildModeStateFromSnapshot(
  snapshot: AiAgentRuntimeSourceSnapshot | null,
  sourceMode: AgentLabSourceMode,
): AgentLabModeState {
  if (!snapshot?.selectorInput) {
    return buildEmptyModeState(sourceMode);
  }

  const referenceWindow = buildReferenceWindow({
    batchSize: snapshot.selectorInput.referenceWindow.batchSize,
    groupIndex: snapshot.selectorInput.referenceWindow.groupIndex,
  });
  const maxGroupIndex =
    snapshot.selectorInput.referenceWindow.batchSize > 0
      ? Math.max(
          0,
          Math.ceil(
            referenceWindow.totalReferences / snapshot.selectorInput.referenceWindow.batchSize,
          ) - 1,
        )
      : 0;

  return {
    personaGroup: {
      totalReferenceCount: referenceWindow.totalReferences,
      batchSize: snapshot.selectorInput.referenceWindow.batchSize,
      groupIndex: snapshot.selectorInput.referenceWindow.groupIndex,
      maxGroupIndex,
    },
    opportunities: snapshot.selectorInput.opportunities.map((opportunity) => ({
      opportunityKey: opportunity.opportunityKey,
      source: opportunity.source as "public-post" | "public-comment" | "notification",
      link: buildOpportunityLink(opportunity.source, opportunity.opportunityKey),
      content: opportunity.summary,
      createdAt: null,
    })),
    selectorStage: {
      status: "idle",
      prompt: null,
      inputData: snapshot.selectorInput,
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
    public: buildModeStateFromSnapshot(input.public, "public"),
    notification: buildModeStateFromSnapshot(input.notification, "notification"),
  } satisfies Record<AgentLabSourceMode, AgentLabModeState>;
}

function buildSelectorRows(
  selectorInput: SelectorInputPreview,
  status: AgentLabSelectorStage["status"],
  errorMessage: string | null,
): AgentLabSelectorRow[] {
  const selectorOutput = buildSelectorOutputPreview(selectorInput);
  const selectedReasons = selectorOutput.selectedReferences.map((item) => item.reason);

  return selectorInput.opportunities.map((opportunity, index) => ({
    opportunityKey: opportunity.opportunityKey,
    source: opportunity.source as "public-post" | "public-comment" | "notification",
    link: buildOpportunityLink(opportunity.source, opportunity.opportunityKey),
    content: opportunity.summary,
    reason: status === "success" ? (selectedReasons[index % selectedReasons.length] ?? null) : null,
    errorMessage: status === "error" ? errorMessage : null,
  }));
}

export function buildSelectorStage(input: {
  snapshot: AiAgentRuntimeSourceSnapshot | null;
  status?: AgentLabSelectorStage["status"];
  errorMessage?: string | null;
}): AgentLabSelectorStage {
  if (!input.snapshot?.selectorInput) {
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

  const status = input.status ?? "success";
  const errorMessage = input.errorMessage ?? "Selector run failed.";
  const selectorOutput = buildSelectorOutputPreview(input.snapshot.selectorInput);

  return {
    status,
    prompt: status === "success" ? selectorOutput.promptPreview : null,
    inputData: input.snapshot.selectorInput,
    outputData:
      status === "success"
        ? selectorOutput
        : {
            error: errorMessage,
            selectorInput: input.snapshot.selectorInput,
          },
    rows: buildSelectorRows(input.snapshot.selectorInput, status, errorMessage),
  };
}

export function buildCandidateStage(input: {
  kind: AiAgentRuntimeIntakeKind;
  snapshot: AiAgentRuntimeSourceSnapshot | null;
  status?: Extract<AgentLabCandidateStage["status"], "success" | "error" | "auto-routed">;
  errorMessage?: string | null;
}) {
  if (!input.snapshot?.selectorInput) {
    return {
      candidateStage: {
        status: input.kind === "notification" ? "auto-routed" : "error",
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

  const selectorOutput = buildSelectorOutputPreview(input.snapshot.selectorInput);
  const resolvedPersonas = buildResolvedPersonasPreview(selectorOutput);
  const candidates = buildTaskCandidatePreview({
    selectorInput: input.snapshot.selectorInput,
    resolvedPersonas,
  });

  const candidateRows = candidates.map((candidate) => {
    const persona = resolvedPersonas.find((item) => item.personaId === candidate.personaId) ?? null;
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
        input.status === "error" ? (input.errorMessage ?? "Candidate run failed.") : null,
    } satisfies AgentLabCandidateRow;
  });

  const selectedReferences = selectorOutput.selectedReferences.map((reference) => {
    const persona = resolvedPersonas.find(
      (item) => item.referenceSource === reference.referenceName,
    );
    return {
      referenceName: reference.referenceName,
      referenceId: reference.referenceName,
      personaId: persona?.personaId,
      personaDisplayName: persona?.displayName,
    };
  });

  const status = input.status ?? (input.kind === "notification" ? "auto-routed" : "success");
  const taskRows = status === "error" ? [] : buildTaskRows(candidates, candidateRows);

  return {
    candidateStage: {
      status,
      prompt:
        input.kind === "notification" || status === "error" ? null : selectorOutput.promptPreview,
      inputData: {
        selectorInput: input.snapshot.selectorInput,
        selectedReferences,
      },
      outputData:
        status === "error"
          ? {
              error: input.errorMessage ?? "Candidate run failed.",
            }
          : {
              resolvedPersonas,
              candidates,
            },
      selectedReferences,
      rows: candidateRows,
    } satisfies AgentLabCandidateStage,
    taskRows,
  };
}
