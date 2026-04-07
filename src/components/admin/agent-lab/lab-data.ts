"use client";

import type {
  AiAgentRuntimeIntakeKind,
  AiAgentRuntimeSourceSnapshot,
} from "@/lib/ai/agent/intake/intake-read-model";
import {
  DEFAULT_REFERENCE_LIBRARY,
  buildCandidateStagePrompt,
  buildOpportunityStagePrompt,
  buildSelectorInputPreview,
  resolvePersonasForReferences,
  type SelectorInputPreview,
  type TaskCandidatePreview,
} from "@/lib/ai/agent/intake/intake-preview";
import type { AiModelConfig, PersonaSummary } from "@/lib/ai/admin/control-plane-contract";
import type {
  AgentLabCandidateRow,
  AgentLabCandidateStage,
  AgentLabModeState,
  AgentLabOpportunityRow,
  AgentLabPersonaGroupInput,
  AgentLabPersonaInfo,
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

function buildSelectorInput(input: {
  snapshot: AiAgentRuntimeSourceSnapshot;
  personaGroup?: AgentLabPersonaGroupInput;
}): SelectorInputPreview | null {
  const selectorInput =
    input.snapshot.selectorInput ??
    (input.snapshot.items.length > 0
      ? buildSelectorInputPreview({
          fixtureMode:
            input.snapshot.kind === "notification"
              ? "notification-intake"
              : "mixed-public-opportunity",
          groupIndexOverride: input.personaGroup?.groupIndex ?? 0,
          selectorReferenceBatchSize:
            input.personaGroup?.batchSize ?? DEFAULT_PERSONA_REFERENCE_BATCH_SIZE,
          items: input.snapshot.items,
        })
      : null);

  if (!selectorInput) {
    return null;
  }

  const batchSize = input.personaGroup?.batchSize ?? selectorInput.referenceWindow.batchSize;
  const groupIndex = input.personaGroup?.groupIndex ?? selectorInput.referenceWindow.groupIndex;

  return {
    ...selectorInput,
    groupIndexOverride: groupIndex,
    selectorReferenceBatchSize: batchSize,
    referenceWindow: {
      batchSize,
      groupIndex,
    },
  };
}

function buildReferenceBatch(input: {
  referenceNames?: string[];
  batchSize: number;
  groupIndex: number;
}) {
  const references = input.referenceNames ?? DEFAULT_REFERENCE_LIBRARY;
  const totalReferenceCount = references.length;
  const batchSize = Math.max(1, input.batchSize);
  const totalGroups = totalReferenceCount > 0 ? Math.ceil(totalReferenceCount / batchSize) : 0;
  const effectiveGroupIndex = totalGroups > 0 ? input.groupIndex % totalGroups : 0;
  const start = effectiveGroupIndex * batchSize;
  const window = references.slice(start, start + batchSize);

  return {
    totalReferenceCount,
    batchSize,
    effectiveGroupIndex,
    maxGroupIndex: Math.max(0, totalGroups - 1),
    window,
  };
}

function buildFallbackPersonaInfo(personaId: string): AgentLabPersonaInfo {
  const suffix = personaId.replace(/^persona-/, "");
  const displayName = suffix
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
  const username = `ai_${suffix.replace(/-/g, "_")}`;

  return {
    id: personaId,
    displayName: displayName || personaId,
    username,
    avatarUrl: null,
    href: `/u/${username}`,
    status: "active",
  };
}

function buildPersonaInfoById(personaSummaries?: PersonaSummary[]) {
  return new Map(
    (personaSummaries ?? []).map((persona) => [
      persona.id,
      {
        id: persona.id,
        displayName: persona.display_name,
        username: persona.username,
        avatarUrl: persona.avatar_url,
        href: `/u/${persona.username}`,
        status: persona.status === "inactive" ? "inactive" : "active",
      } satisfies AgentLabPersonaInfo,
    ]),
  );
}

function buildPersonaInfoForReference(input: {
  referenceName: string;
  personaSummaries?: PersonaSummary[];
}): AgentLabPersonaInfo | null {
  const personaInfoById = buildPersonaInfoById(input.personaSummaries);
  const resolved = resolvePersonasForReferences({
    selectedReferences: [{ referenceName: input.referenceName }],
  })[0];

  if (!resolved) {
    return null;
  }

  return (
    personaInfoById.get(resolved.personaId) ?? {
      ...buildFallbackPersonaInfo(resolved.personaId),
      displayName: resolved.displayName,
      username: resolved.username,
      href: `/u/${resolved.username}`,
      status: resolved.active ? "active" : "inactive",
    }
  );
}

function buildPersonaInfoForId(input: {
  personaId: string;
  personaSummaries?: PersonaSummary[];
}): AgentLabPersonaInfo {
  const personaInfoById = buildPersonaInfoById(input.personaSummaries);
  return personaInfoById.get(input.personaId) ?? buildFallbackPersonaInfo(input.personaId);
}

function buildNotificationPersonaInfo(input: {
  snapshot: AiAgentRuntimeSourceSnapshot;
  personaSummaries?: PersonaSummary[];
}) {
  const personaByOpportunityKey = new Map<string, AgentLabPersonaInfo>();
  const selectorInput = input.snapshot.selectorInput;
  if (!selectorInput) {
    return personaByOpportunityKey;
  }

  selectorInput.opportunityLookup.forEach((lookup) => {
    const recipientPersonaId =
      typeof lookup.metadata?.recipientPersonaId === "string"
        ? lookup.metadata.recipientPersonaId
        : null;
    if (!recipientPersonaId) {
      return;
    }
    personaByOpportunityKey.set(
      lookup.opportunityKey,
      buildPersonaInfoForId({
        personaId: recipientPersonaId,
        personaSummaries: input.personaSummaries,
      }),
    );
  });

  return personaByOpportunityKey;
}

function buildOpportunityRows(input: {
  selectorInput: SelectorInputPreview;
  snapshot: AiAgentRuntimeSourceSnapshot;
  probabilities?: Map<string, number>;
  usePersistedState?: boolean;
  errorMessage?: string | null;
  status: AgentLabSelectorStage["status"];
}): AgentLabOpportunityRow[] {
  const createdAtBySourceId = new Map(
    input.snapshot.items.map((item) => [item.sourceId, item.createdAt]),
  );
  const metadataBySourceId = new Map(
    input.snapshot.items.map((item) => [item.sourceId, item.metadata ?? {}] as const),
  );

  return input.selectorInput.opportunityLookup.map((item) => {
    const mergedMetadata = {
      ...(metadataBySourceId.get(item.sourceId) ?? {}),
      ...(item.metadata ?? {}),
    };
    const persistedProbability =
      typeof mergedMetadata.probability === "number" ? mergedMetadata.probability : null;
    const probability =
      input.status === "success"
        ? (input.probabilities?.get(item.opportunityKey) ?? persistedProbability)
        : input.usePersistedState
          ? persistedProbability
          : null;
    return {
      recordId:
        typeof mergedMetadata.opportunityId === "string" ? mergedMetadata.opportunityId : null,
      opportunityKey: item.opportunityKey,
      source: item.source as AgentLabOpportunityRow["source"],
      link: buildOpportunityLink({
        source: item.source,
        sourceId: item.sourceId,
        metadata: mergedMetadata,
      }),
      content: item.summary,
      createdAt: createdAtBySourceId.get(item.sourceId) ?? null,
      probability,
      selected:
        probability !== null
          ? probability > 0.5
          : input.usePersistedState
            ? mergedMetadata.selected === true
            : false,
      errorMessage:
        input.status === "error" ? (input.errorMessage ?? "Opportunities run failed.") : null,
    };
  });
}

export type AdminResolvedCandidateRow = {
  opportunityKey: string;
  referenceName: string;
  probability: number;
  personaId: string;
};

function buildOpportunityOutput(rows: AgentLabOpportunityRow[]) {
  return {
    scores: rows.map((row) => ({
      opportunity_key: row.opportunityKey,
      probability: row.probability ?? 0,
    })),
  };
}

function buildSeedCandidateRows(input: {
  kind: AiAgentRuntimeIntakeKind;
  selectorInput: SelectorInputPreview;
  snapshot: AiAgentRuntimeSourceSnapshot;
  personaSummaries?: PersonaSummary[];
  referenceNames?: string[];
}) {
  if (input.kind === "notification") {
    const personaByOpportunityKey = buildNotificationPersonaInfo({
      snapshot: input.snapshot,
      personaSummaries: input.personaSummaries,
    });
    return input.selectorInput.opportunityLookup.map((lookup) => ({
      opportunityKey: null,
      referenceName: "Direct recipient",
      persona: personaByOpportunityKey.get(lookup.opportunityKey) ?? null,
      errorMessage: null,
    })) satisfies AgentLabCandidateRow[];
  }

  const referenceBatch = buildReferenceBatch({
    referenceNames: input.referenceNames,
    batchSize: input.selectorInput.referenceWindow.batchSize,
    groupIndex: input.selectorInput.referenceWindow.groupIndex,
  });

  return referenceBatch.window.map((referenceName) => ({
    opportunityKey: null,
    referenceName,
    persona: buildPersonaInfoForReference({
      referenceName,
      personaSummaries: input.personaSummaries,
    }),
    errorMessage: null,
  })) satisfies AgentLabCandidateRow[];
}

function buildCandidateInputData(input: {
  selectorInput: SelectorInputPreview;
  selectedRows: AgentLabOpportunityRow[];
  referenceNames?: string[];
}) {
  const referenceBatch = buildReferenceBatch({
    referenceNames: input.referenceNames,
    batchSize: input.selectorInput.referenceWindow.batchSize,
    groupIndex: input.selectorInput.referenceWindow.groupIndex,
  });

  return {
    selected_opportunities: input.selectedRows.map((row) => ({
      opportunity_key: row.opportunityKey,
      content_type:
        row.source === "public-post"
          ? "post"
          : row.source === "notification"
            ? "mention"
            : "comment",
      summary: row.content,
    })),
    speaker_batch: referenceBatch.window,
  };
}

function buildSelectedSpeakersForPublic(input: {
  selectedRows: AgentLabOpportunityRow[];
  referenceBatch: string[];
}) {
  const assignments = new Map<string, Array<{ name: string; probability: number }>>();
  if (input.selectedRows.length === 0) {
    return assignments;
  }

  const activeReferences = input.referenceBatch.filter((referenceName) =>
    resolvePersonasForReferences({
      selectedReferences: [{ referenceName }],
    }).some((persona) => persona.active),
  );
  const inactiveReference =
    input.referenceBatch.find((referenceName) =>
      resolvePersonasForReferences({
        selectedReferences: [{ referenceName }],
      }).some((persona) => !persona.active),
    ) ?? null;
  const duplicatePersonaReferences = ["David Bowie", "Laurie Anderson"].filter((referenceName) =>
    input.referenceBatch.includes(referenceName),
  );

  input.selectedRows.forEach((row, index) => {
    if (index === 0 && duplicatePersonaReferences.length === 2) {
      assignments.set(row.opportunityKey, [
        { name: duplicatePersonaReferences[0]!, probability: 0.82 },
        { name: duplicatePersonaReferences[1]!, probability: 0.71 },
      ]);
      return;
    }

    if (index === 1 && inactiveReference) {
      const activeFallback =
        activeReferences.find(
          (referenceName) => !duplicatePersonaReferences.includes(referenceName),
        ) ??
        activeReferences[0] ??
        input.referenceBatch[0];
      assignments.set(row.opportunityKey, [
        { name: inactiveReference, probability: 0.64 },
        ...(activeFallback && activeFallback !== inactiveReference
          ? [{ name: activeFallback, probability: 0.58 }]
          : []),
      ]);
      return;
    }

    const activeFallback =
      activeReferences.find(
        (referenceName) => !duplicatePersonaReferences.includes(referenceName),
      ) ?? input.referenceBatch[0];
    assignments.set(
      row.opportunityKey,
      activeFallback ? [{ name: activeFallback, probability: 0.68 }] : [],
    );
  });

  return assignments;
}

function buildPublicCandidateRows(input: {
  selectedRows: AgentLabOpportunityRow[];
  selectorInput: SelectorInputPreview;
  personaSummaries?: PersonaSummary[];
  referenceNames?: string[];
  status: Extract<AgentLabCandidateStage["status"], "success" | "error">;
  errorMessage?: string | null;
}) {
  const referenceBatch = buildReferenceBatch({
    referenceNames: input.referenceNames,
    batchSize: input.selectorInput.referenceWindow.batchSize,
    groupIndex: input.selectorInput.referenceWindow.groupIndex,
  });
  const selectedSpeakersByOpportunity = buildSelectedSpeakersForPublic({
    selectedRows: input.selectedRows,
    referenceBatch: referenceBatch.window,
  });

  const selectedRowsFlattened = input.selectedRows.flatMap((opportunityRow) =>
    (selectedSpeakersByOpportunity.get(opportunityRow.opportunityKey) ?? []).map((speaker) => ({
      opportunityKey: opportunityRow.opportunityKey,
      referenceName: speaker.name,
      persona: buildPersonaInfoForReference({
        referenceName: speaker.name,
        personaSummaries: input.personaSummaries,
      }),
      errorMessage:
        input.status === "error" ? (input.errorMessage ?? "Candidates run failed.") : null,
      probability: speaker.probability,
    })),
  );

  const selectedReferenceNames = new Set(selectedRowsFlattened.map((row) => row.referenceName));
  const unselectedRows = referenceBatch.window
    .filter((referenceName) => !selectedReferenceNames.has(referenceName))
    .map((referenceName) => ({
      opportunityKey: null,
      referenceName,
      persona: buildPersonaInfoForReference({
        referenceName,
        personaSummaries: input.personaSummaries,
      }),
      errorMessage:
        input.status === "error" ? (input.errorMessage ?? "Candidates run failed.") : null,
      probability: null,
    }));

  const rows = [...selectedRowsFlattened, ...unselectedRows]
    .map((row) => ({
      opportunityKey: row.opportunityKey,
      referenceName: row.referenceName,
      persona: row.persona,
      errorMessage: row.errorMessage,
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

  return {
    rows,
    outputData:
      input.status === "error"
        ? {
            error: input.errorMessage ?? "Candidates run failed.",
          }
        : {
            speaker_candidates: input.selectedRows.map((row) => ({
              opportunity_key: row.opportunityKey,
              selected_speakers: selectedRowsFlattened
                .filter((candidateRow) => candidateRow.opportunityKey === row.opportunityKey)
                .map((candidateRow) => ({
                  name: candidateRow.referenceName,
                  probability:
                    (selectedSpeakersByOpportunity.get(row.opportunityKey) ?? []).find(
                      (speaker) => speaker.name === candidateRow.referenceName,
                    )?.probability ?? 0.55,
                })),
            })),
          },
  };
}

function buildNotificationCandidateRows(input: {
  snapshot: AiAgentRuntimeSourceSnapshot;
  selectorInput: SelectorInputPreview;
  selectedRows: AgentLabOpportunityRow[];
  personaSummaries?: PersonaSummary[];
  status: Extract<AgentLabCandidateStage["status"], "success" | "auto-routed" | "error">;
  errorMessage?: string | null;
}) {
  const personaByOpportunityKey = buildNotificationPersonaInfo({
    snapshot: input.snapshot,
    personaSummaries: input.personaSummaries,
  });

  const rows = input.selectorInput.opportunityLookup
    .map((lookup) => ({
      opportunityKey:
        input.selectedRows.find((row) => row.opportunityKey === lookup.opportunityKey)
          ?.opportunityKey ?? null,
      referenceName: "Direct recipient",
      persona: personaByOpportunityKey.get(lookup.opportunityKey) ?? null,
      errorMessage:
        input.status === "error" ? (input.errorMessage ?? "Candidates run failed.") : null,
    }))
    .sort((a, b) => {
      if (a.opportunityKey && !b.opportunityKey) return -1;
      if (!a.opportunityKey && b.opportunityKey) return 1;
      if (a.opportunityKey && b.opportunityKey) {
        return a.opportunityKey.localeCompare(b.opportunityKey);
      }
      return 0;
    }) satisfies AgentLabCandidateRow[];

  return {
    rows,
    outputData:
      input.status === "error" ? { error: input.errorMessage ?? "Candidates run failed." } : null,
  };
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

function buildTaskCandidatePayloads(input: {
  kind: AiAgentRuntimeIntakeKind;
  selectorInput: SelectorInputPreview;
  candidateRows: AgentLabCandidateRow[];
}): TaskCandidatePreview[] {
  const lookupByOpportunityKey = new Map(
    input.selectorInput.opportunityLookup.map((lookup) => [lookup.opportunityKey, lookup] as const),
  );
  const taskCandidates: TaskCandidatePreview[] = [];
  const dedupeKeys = new Set<string>();

  input.candidateRows.forEach((row) => {
    if (!row.opportunityKey || !row.persona || row.persona.status !== "active") {
      return;
    }

    const lookup = lookupByOpportunityKey.get(row.opportunityKey);
    if (!lookup) {
      return;
    }

    const taskDedupeKey = `${row.opportunityKey}:${row.persona.id}`;
    if (dedupeKeys.has(taskDedupeKey)) {
      return;
    }
    dedupeKeys.add(taskDedupeKey);

    const dispatchKind = input.kind === "notification" ? "notification" : "public";
    const sourceTable =
      lookup.sourceTable === "notifications"
        ? "notifications"
        : lookup.sourceTable === "posts"
          ? "posts"
          : "comments";
    const boardId = typeof lookup.metadata?.boardId === "string" ? lookup.metadata.boardId : null;
    const postId = typeof lookup.metadata?.postId === "string" ? lookup.metadata.postId : null;
    const commentId =
      typeof lookup.metadata?.commentId === "string" ? lookup.metadata.commentId : null;
    const parentCommentId =
      typeof lookup.metadata?.parentCommentId === "string" ? lookup.metadata.parentCommentId : null;
    const contentType =
      lookup.contentType === "post" ? "post" : lookup.contentType === "reply" ? "reply" : "comment";

    taskCandidates.push({
      candidateIndex: taskCandidates.length,
      opportunityKey: row.opportunityKey,
      personaId: row.persona.id,
      username: row.persona.username,
      dispatchKind,
      sourceTable,
      sourceId: lookup.sourceId,
      dedupeKey: `${row.persona.username}:${lookup.sourceId}:${contentType}`,
      cooldownUntil: new Date(0).toISOString(),
      payload: {
        contentType,
        source: lookup.source,
        summary: lookup.summary,
        fixtureMode: input.selectorInput.fixtureMode,
        boardId,
        postId,
        commentId,
        parentCommentId,
        context: typeof lookup.metadata?.context === "string" ? lookup.metadata.context : null,
        notificationType:
          typeof lookup.metadata?.notificationType === "string"
            ? lookup.metadata.notificationType
            : null,
      },
    });
  });

  return taskCandidates;
}

function buildTaskRows(input: {
  candidates: TaskCandidatePreview[];
  candidateRows: AgentLabCandidateRow[];
}): AgentLabTaskRow[] {
  const candidateByOpportunityPersona = new Map<string, TaskCandidatePreview>(
    input.candidates.map(
      (candidate) => [`${candidate.opportunityKey}:${candidate.personaId}`, candidate] as const,
    ),
  );
  const emittedKeys = new Set<string>();

  return input.candidateRows.flatMap((row) => {
    if (!row.opportunityKey || !row.persona || row.persona.status !== "active") {
      return [];
    }
    const key = `${row.opportunityKey}:${row.persona.id}`;
    if (emittedKeys.has(key)) {
      return [];
    }
    const candidate = candidateByOpportunityPersona.get(key);
    if (!candidate) {
      return [];
    }
    emittedKeys.add(key);
    return [
      {
        taskId: null,
        candidateIndex: candidate.candidateIndex,
        opportunityKey: candidate.opportunityKey,
        persona: row.persona,
        taskType: toTaskType(candidate),
        status: "PENDING",
        saveState: "idle",
        errorMessage: null,
        saveResult: null,
        data: {
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

function toInjectPersonaTasksCandidate(candidate: TaskCandidatePreview) {
  return {
    persona_id: candidate.personaId,
    task_type: toTaskType(candidate),
    dispatch_kind: candidate.dispatchKind,
    source_table: candidate.sourceTable,
    source_id: candidate.sourceId,
    dedupe_key: candidate.dedupeKey,
    cooldown_until: candidate.cooldownUntil,
    payload: {
      summary: candidate.payload.summary,
      boardId: candidate.payload.boardId,
      postId: candidate.payload.postId,
      commentId: candidate.payload.commentId,
      parentCommentId: candidate.payload.parentCommentId,
      context: candidate.payload.context,
      notificationType: candidate.payload.notificationType,
    },
  };
}

export function filterLabModels(models: AiModelConfig[]) {
  return models.filter(
    (model) => model.capability === "text_generation" && model.status === "active",
  );
}

export function buildTaskSavePayloadData(taskRows: AgentLabTaskRow[]) {
  return {
    persona_tasks_rows: taskRows.flatMap((row) =>
      row.candidate ? [toInjectPersonaTasksCandidate(row.candidate)] : [],
    ),
  };
}

export function buildEmptyModeState(
  sourceMode: AgentLabSourceMode,
  input?: Partial<Pick<AgentLabModeState["personaGroup"], "batchSize" | "groupIndex">>,
): AgentLabModeState {
  const batchSize = input?.batchSize ?? DEFAULT_PERSONA_REFERENCE_BATCH_SIZE;
  const groupIndex = input?.groupIndex ?? 0;

  return {
    personaGroup: {
      totalReferenceCount: 0,
      batchSize,
      groupIndex,
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

export function buildModeState(input: {
  snapshot: AiAgentRuntimeSourceSnapshot | null;
  sourceMode: AgentLabSourceMode;
  personaSummaries?: PersonaSummary[];
  personaGroup?: AgentLabPersonaGroupInput;
  referenceNames?: string[];
  usePersistedOpportunityState?: boolean;
}): AgentLabModeState {
  if (!input.snapshot) {
    return buildEmptyModeState(input.sourceMode, input.personaGroup);
  }

  const selectorInput = buildSelectorInput({
    snapshot: input.snapshot,
    personaGroup: input.personaGroup,
  });
  if (!selectorInput) {
    return buildEmptyModeState(input.sourceMode, input.personaGroup);
  }

  const referenceBatch = buildReferenceBatch({
    referenceNames: input.referenceNames,
    batchSize: selectorInput.referenceWindow.batchSize,
    groupIndex: selectorInput.referenceWindow.groupIndex,
  });
  const opportunities = buildOpportunityRows({
    selectorInput,
    snapshot: input.snapshot,
    status: "idle",
    usePersistedState: input.usePersistedOpportunityState,
  });
  const candidateRows = buildSeedCandidateRows({
    kind: input.snapshot.kind,
    selectorInput,
    snapshot: input.snapshot,
    personaSummaries: input.personaSummaries,
    referenceNames: input.referenceNames,
  });

  return {
    personaGroup: {
      totalReferenceCount: referenceBatch.totalReferenceCount,
      batchSize: selectorInput.referenceWindow.batchSize,
      groupIndex: selectorInput.referenceWindow.groupIndex,
      maxGroupIndex: referenceBatch.maxGroupIndex,
    },
    opportunities,
    selectorStage: {
      status: "idle",
      prompt: buildOpportunityStagePrompt(selectorInput),
      inputData: null,
      outputData: null,
      rows: [],
    },
    candidateStage: {
      status: input.sourceMode === "notification" ? "auto-routed" : "idle",
      prompt:
        input.sourceMode === "notification"
          ? null
          : buildCandidateStagePrompt({
              selectedOpportunities: [],
              referenceBatch: referenceBatch.window,
            }),
      inputData: buildCandidateInputData({
        selectorInput,
        selectedRows: opportunities.filter((row) => row.selected),
        referenceNames: input.referenceNames,
      }),
      outputData: null,
      rows: candidateRows,
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
  selectorReferenceBatchSize?: number;
  referenceNames?: string[];
  usePersistedOpportunityState?: boolean;
}) {
  return {
    public: buildModeState({
      snapshot: input.public,
      sourceMode: "public",
      personaSummaries: input.personaSummaries,
      referenceNames: input.referenceNames,
      usePersistedOpportunityState: input.usePersistedOpportunityState,
      personaGroup: {
        batchSize: input.selectorReferenceBatchSize ?? DEFAULT_PERSONA_REFERENCE_BATCH_SIZE,
        groupIndex: 0,
      },
    }),
    notification: buildModeState({
      snapshot: input.notification,
      sourceMode: "notification",
      personaSummaries: input.personaSummaries,
      referenceNames: input.referenceNames,
      usePersistedOpportunityState: input.usePersistedOpportunityState,
      personaGroup: {
        batchSize: input.selectorReferenceBatchSize ?? DEFAULT_PERSONA_REFERENCE_BATCH_SIZE,
        groupIndex: 0,
      },
    }),
  } satisfies Record<AgentLabSourceMode, AgentLabModeState>;
}

export function buildSelectorStage(input: {
  snapshot: AiAgentRuntimeSourceSnapshot | null;
  status?: AgentLabSelectorStage["status"];
  errorMessage?: string | null;
  personaGroup?: AgentLabPersonaGroupInput;
}): AgentLabSelectorStage {
  if (!input.snapshot) {
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

  const selectorInput = buildSelectorInput({
    snapshot: input.snapshot,
    personaGroup: input.personaGroup,
  });
  if (!selectorInput) {
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
  const idleRows = buildOpportunityRows({
    selectorInput,
    snapshot: input.snapshot,
    status: "idle",
    usePersistedState: true,
  });
  const probabilities = new Map<string, number>();
  idleRows.forEach((row) => {
    if (typeof row.probability === "number") {
      probabilities.set(row.opportunityKey, row.probability);
    }
  });
  const rows =
    status === "success"
      ? buildOpportunityRows({
          selectorInput,
          snapshot: input.snapshot,
          probabilities,
          status: "success",
        })
      : buildOpportunityRows({
          selectorInput,
          snapshot: input.snapshot,
          status: "error",
          errorMessage: input.errorMessage,
        });

  return {
    status,
    prompt: buildOpportunityStagePrompt(selectorInput),
    inputData: null,
    outputData:
      status === "success"
        ? buildOpportunityOutput(rows)
        : {
            error: input.errorMessage ?? "Opportunities run failed.",
          },
    rows,
  };
}

export function buildCandidateStage(input: {
  kind: AiAgentRuntimeIntakeKind;
  snapshot: AiAgentRuntimeSourceSnapshot | null;
  selectorStage?: AgentLabSelectorStage;
  status?: Extract<AgentLabCandidateStage["status"], "success" | "error" | "auto-routed">;
  errorMessage?: string | null;
  personaGroup?: AgentLabPersonaGroupInput;
  personaSummaries?: PersonaSummary[];
  referenceNames?: string[];
}) {
  if (!input.snapshot) {
    return {
      candidateStage: {
        status: input.kind === "notification" ? "auto-routed" : "error",
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

  const selectorInput = buildSelectorInput({
    snapshot: input.snapshot,
    personaGroup: input.personaGroup,
  });
  if (!selectorInput) {
    return {
      candidateStage: {
        status: input.kind === "notification" ? "auto-routed" : "error",
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

  const selectedRows = input.selectorStage?.rows.filter((row) => row.selected) ?? [];
  const candidateInputData = buildCandidateInputData({
    selectorInput,
    selectedRows,
    referenceNames: input.referenceNames,
  });

  if (input.kind === "notification") {
    const notificationRows = buildNotificationCandidateRows({
      snapshot: input.snapshot,
      selectorInput,
      selectedRows,
      personaSummaries: input.personaSummaries,
      status: input.status ?? "auto-routed",
      errorMessage: input.errorMessage,
    });
    const taskCandidates = buildTaskCandidatePayloads({
      kind: input.kind,
      selectorInput,
      candidateRows: notificationRows.rows,
    });
    return {
      candidateStage: {
        status: input.status ?? "auto-routed",
        prompt: null,
        inputData: candidateInputData,
        outputData: input.selectorStage?.status === "success" ? notificationRows.outputData : null,
        rows: notificationRows.rows,
      } satisfies AgentLabCandidateStage,
      taskRows: buildTaskRows({
        candidates: taskCandidates,
        candidateRows: notificationRows.rows,
      }),
    };
  }

  const status = input.status === "error" ? "error" : "success";
  const publicCandidateRows =
    status === "error"
      ? {
          rows: buildSeedCandidateRows({
            kind: input.kind,
            selectorInput,
            snapshot: input.snapshot,
            personaSummaries: input.personaSummaries,
            referenceNames: input.referenceNames,
          }).map((row) => ({
            ...row,
            errorMessage: input.errorMessage ?? "Candidates run failed.",
          })),
          outputData: {
            error: input.errorMessage ?? "Candidates run failed.",
          },
        }
      : buildPublicCandidateRows({
          selectedRows,
          selectorInput,
          personaSummaries: input.personaSummaries,
          referenceNames: input.referenceNames,
          status,
          errorMessage: input.errorMessage,
        });

  const taskCandidates =
    status === "success"
      ? buildTaskCandidatePayloads({
          kind: input.kind,
          selectorInput,
          candidateRows: publicCandidateRows.rows,
        })
      : [];

  return {
    candidateStage: {
      status,
      prompt: buildCandidateStagePrompt({
        selectedOpportunities: selectedRows.map((row) => ({
          opportunityKey: row.opportunityKey,
          contentType:
            row.source === "public-post"
              ? "post"
              : row.source === "notification"
                ? "mention"
                : "comment",
          summary: row.content,
        })),
        referenceBatch: candidateInputData.speaker_batch,
      }),
      inputData: candidateInputData,
      outputData:
        status === "success" ? publicCandidateRows.outputData : publicCandidateRows.outputData,
      rows: publicCandidateRows.rows,
    } satisfies AgentLabCandidateStage,
    taskRows: buildTaskRows({
      candidates: taskCandidates,
      candidateRows: publicCandidateRows.rows,
    }),
  };
}

export function buildCandidateStageFromResolvedRows(input: {
  kind: AiAgentRuntimeIntakeKind;
  snapshot: AiAgentRuntimeSourceSnapshot | null;
  selectorStage: AgentLabSelectorStage;
  resolvedRows: AdminResolvedCandidateRow[];
  personaGroup?: AgentLabPersonaGroupInput;
  personaSummaries?: PersonaSummary[];
  referenceNames?: string[];
}) {
  if (!input.snapshot) {
    return {
      candidateStage: {
        status: input.kind === "notification" ? "auto-routed" : "error",
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

  const selectorInput = buildSelectorInput({
    snapshot: input.snapshot,
    personaGroup: input.personaGroup,
  });
  if (!selectorInput) {
    return {
      candidateStage: {
        status: input.kind === "notification" ? "auto-routed" : "error",
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

  const selectedRows = input.selectorStage.rows.filter((row) => row.selected);
  const candidateInputData = buildCandidateInputData({
    selectorInput,
    selectedRows,
    referenceNames: input.referenceNames,
  });
  const candidateRows = input.resolvedRows
    .map((row) => ({
      opportunityKey: row.opportunityKey,
      referenceName: row.referenceName,
      persona: buildPersonaInfoForId({
        personaId: row.personaId,
        personaSummaries: input.personaSummaries,
      }),
      errorMessage: null,
    }))
    .sort((a, b) => {
      const keyCompare = a.opportunityKey.localeCompare(b.opportunityKey);
      if (keyCompare !== 0) {
        return keyCompare;
      }
      return a.referenceName.localeCompare(b.referenceName);
    }) satisfies AgentLabCandidateRow[];

  const taskCandidates = buildTaskCandidatePayloads({
    kind: input.kind,
    selectorInput,
    candidateRows,
  });
  const outputData = {
    speaker_candidates: selectedRows.map((row) => ({
      opportunity_key: row.opportunityKey,
      selected_speakers: input.resolvedRows
        .filter((candidateRow) => candidateRow.opportunityKey === row.opportunityKey)
        .map((candidateRow) => ({
          name: candidateRow.referenceName,
          probability: candidateRow.probability,
        })),
    })),
  };

  return {
    candidateStage: {
      status: "success",
      prompt: buildCandidateStagePrompt({
        selectedOpportunities: selectedRows.map((row) => ({
          opportunityKey: row.opportunityKey,
          contentType:
            row.source === "public-post"
              ? "post"
              : row.source === "notification"
                ? "mention"
                : "comment",
          summary: row.content,
        })),
        referenceBatch: candidateInputData.speaker_batch,
      }),
      inputData: candidateInputData,
      outputData,
      rows: candidateRows,
    } satisfies AgentLabCandidateStage,
    taskRows: buildTaskRows({
      candidates: taskCandidates,
      candidateRows,
    }),
  };
}
