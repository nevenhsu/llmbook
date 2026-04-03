import { buildPersonaReferenceMatchKey } from "@/lib/ai/admin/persona-reference-normalization";
import { loadAiAgentConfig } from "@/lib/ai/agent/config/agent-config";
import {
  AiAgentIntakePreviewStore,
  type AiAgentRuntimeIntakeKind,
  type AiAgentRuntimeSourceSnapshot,
} from "@/lib/ai/agent/intake/intake-read-model";
import {
  AiAgentIntakeStageLlmService,
  type CandidateSelectionResult,
} from "@/lib/ai/agent/intake/intake-stage-llm-service";
import {
  AiOpportunityStore,
  type AiOppContentType,
  type AiOppProbabilityUpdateInput,
  type AiOppRow,
  type AiOppSourceTable,
  type AiOppUpsertInput,
} from "@/lib/ai/agent/intake/opportunity-store";
import {
  AiAgentTaskInjectionService,
  type AiAgentTaskInjectionExecutedResponse,
} from "@/lib/ai/agent/intake/task-injection-service";
import type { TaskInjectionPreview } from "@/lib/ai/agent/intake/intake-preview";
import { createAdminClient } from "@/lib/supabase/admin";

export type AiAgentOpportunityPipelineExecutedResponse = AiAgentTaskInjectionExecutedResponse;

type RuntimeConfigSnapshot = {
  selectorReferenceBatchSize: number;
  postOpportunityCooldownMinutes: number;
  commentOpportunityCooldownMinutes: number;
};

type RuntimeCursor = {
  groupIndex: number;
  candidateEpoch: number;
};

type ReferenceBatchSnapshot = {
  referenceNames: string[];
  totalReferences: number;
  effectiveGroupIndex: number;
  batchSize: number;
};

type ResolvedSpeakerPersona = {
  referenceName: string;
  personaId: string;
  username: string;
  active: boolean;
};

type PersonaIdentity = {
  personaId: string;
  username: string;
};

const OPPORTUNITY_SCORE_BATCH_SIZE = 10;
const PUBLIC_CANDIDATE_BATCH_SIZE = 10;
const MAX_PUBLIC_SCORE_ROWS_PER_SYNC = 100;

type PipelineTaskCandidate = {
  candidateIndex: number;
  opportunityKey: string;
  personaId: string;
  username: string;
  dispatchKind: "notification" | "public";
  sourceTable: "notifications" | "posts" | "comments";
  sourceId: string;
  dedupeKey: string;
  cooldownUntil: string;
  decisionReason: string;
  payload: {
    contentType: string;
    source: string;
    summary: string;
    fixtureMode: "mixed-public-opportunity" | "notification-intake";
    boardId: string | null;
    postId: string | null;
    commentId: string | null;
    parentCommentId: string | null;
    context: string | null;
    notificationType: string | null;
  };
};

type OpportunityPipelineServiceDeps = {
  loadRuntimePreviewSet: () => Promise<{
    notification: AiAgentRuntimeSourceSnapshot;
    public: AiAgentRuntimeSourceSnapshot;
  }>;
  loadRuntimeConfig: () => Promise<RuntimeConfigSnapshot>;
  ingestOpportunities: (rows: AiOppUpsertInput[]) => Promise<number>;
  listOpportunitiesByIds: (opportunityIds: string[]) => Promise<AiOppRow[]>;
  listUnscoredOpportunities: (kind: AiAgentRuntimeIntakeKind) => Promise<AiOppRow[]>;
  scoreOpportunityProbabilities: (input: {
    kind: AiAgentRuntimeIntakeKind;
    rows: AiOppRow[];
  }) => Promise<AiOppProbabilityUpdateInput[]>;
  updateOpportunityProbabilities: (rows: AiOppProbabilityUpdateInput[]) => Promise<void>;
  loadPersonaActivity: (personaIds: string[]) => Promise<Record<string, boolean>>;
  listSelectedNotificationOpportunities: () => Promise<AiOppRow[]>;
  listEligiblePublicCandidateOpportunities: (input: {
    candidateEpoch: number;
    groupIndex: number;
    batchSize: number;
  }) => Promise<AiOppRow[]>;
  listResolvedPersonaIdsByOpportunityIds: (
    opportunityIds: string[],
  ) => Promise<Record<string, string[]>>;
  selectPublicSpeakerCandidates: (input: {
    rows: AiOppRow[];
    referenceBatch: string[];
  }) => Promise<CandidateSelectionResult[]>;
  recordPublicCandidateResults: (input: {
    groups: Array<{
      oppId: string;
      candidateEpoch: number;
      groupIndex: number;
      batchSize: number;
      selectedSpeakers: Array<{ name: string; probability: number }>;
      resolvedPersonaIds: string[];
    }>;
    matchedPersonaCounts: Array<{
      opportunityId: string;
      matchedPersonaCount: number;
    }>;
  }) => Promise<void>;
  executeCandidates: (input: {
    candidates: PipelineTaskCandidate[];
    kind?: AiAgentRuntimeIntakeKind | "manual";
  }) => Promise<AiAgentOpportunityPipelineExecutedResponse>;
  markNotificationsProcessed: (opportunityIds: string[]) => Promise<void>;
  loadPublicRuntimeCursor: () => Promise<RuntimeCursor>;
  advancePublicRuntimeCursor: () => Promise<void>;
  loadReferenceBatch: (input: {
    requestedGroupIndex: number;
    batchSize: number;
  }) => Promise<ReferenceBatchSnapshot>;
  resolveSpeakerPersonas: (referenceNames: string[]) => Promise<ResolvedSpeakerPersona[]>;
  loadPersonaIdentities: (personaIds: string[]) => Promise<Record<string, PersonaIdentity>>;
  random: () => number;
  now: () => Date;
};

export type AdminPublicCandidateResolvedRow = {
  opportunityId: string;
  referenceName: string;
  probability: number;
  personaId: string;
  active: boolean;
};

export type AdminPublicCandidateTaskOutcome = {
  opportunityId: string;
  personaId: string;
  inserted: boolean;
  taskId: string | null;
  skipReason: string | null;
  status: string;
  errorMessage: string | null;
};

export type AdminPublicCandidateBatchResult = {
  taskResponse: AiAgentOpportunityPipelineExecutedResponse;
  resolvedRows: AdminPublicCandidateResolvedRow[];
  taskOutcomes: AdminPublicCandidateTaskOutcome[];
};

const NOTIFICATION_INACTIVE_PROBABILITY_MODEL_KEY = "system:notification-recipient-inactive";
const NOTIFICATION_INACTIVE_PROBABILITY_PROMPT_VERSION = "notification-recipient-active-v1";

function deriveNotificationContentType(input: {
  context: string | null;
  rawType: string;
}): AiOppContentType {
  if (input.context === "comment") {
    return "reply";
  }

  if (input.context === "post") {
    return "comment";
  }

  if (input.rawType === "reply") {
    return "reply";
  }

  return "notification";
}

function mapSnapshotItemToOppRow(input: {
  kind: AiAgentRuntimeIntakeKind;
  item: AiAgentRuntimeSourceSnapshot["items"][number];
}): AiOppUpsertInput {
  const { item, kind } = input;
  const sourceTable: AiOppSourceTable =
    kind === "notification" ? "notifications" : item.contentType === "post" ? "posts" : "comments";
  const notificationContext =
    typeof item.metadata?.context === "string" ? item.metadata.context : null;
  const notificationType =
    typeof item.metadata?.notificationType === "string" ? item.metadata.notificationType : null;
  const contentType: AiOppContentType =
    kind === "notification"
      ? deriveNotificationContentType({
          context: notificationContext,
          rawType: item.contentType,
        })
      : item.contentType === "post"
        ? "post"
        : item.contentType === "reply"
          ? "reply"
          : "comment";

  return {
    kind,
    sourceTable,
    sourceId: item.sourceId,
    boardId: typeof item.metadata?.boardId === "string" ? item.metadata.boardId : null,
    boardSlug: typeof item.metadata?.boardSlug === "string" ? item.metadata.boardSlug : null,
    postId: typeof item.metadata?.postId === "string" ? item.metadata.postId : null,
    commentId: typeof item.metadata?.commentId === "string" ? item.metadata.commentId : null,
    parentCommentId:
      typeof item.metadata?.parentCommentId === "string" ? item.metadata.parentCommentId : null,
    notificationId: kind === "notification" ? item.sourceId : null,
    recipientPersonaId:
      typeof item.metadata?.recipientPersonaId === "string"
        ? item.metadata.recipientPersonaId
        : null,
    contentType,
    summary: item.summary,
    notificationContext,
    notificationType,
    sourceCreatedAt: item.createdAt,
  };
}

function mapSnapshotToOppRows(snapshot: AiAgentRuntimeSourceSnapshot): AiOppUpsertInput[] {
  return snapshot.items.map((item) =>
    mapSnapshotItemToOppRow({
      kind: snapshot.kind,
      item,
    }),
  );
}

function buildEmptyExecutedResponse(
  kind: AiAgentRuntimeIntakeKind,
): AiAgentOpportunityPipelineExecutedResponse {
  return {
    mode: "executed",
    kind,
    message: `Inserted 0 persona_tasks rows for ${kind} intake.`,
    injectionPreview: {
      rpcName: "inject_persona_tasks",
      summary: {
        candidateCount: 0,
        insertedCount: 0,
        skippedCount: 0,
        insertedTaskIds: [],
        skippedReasonCounts: {},
      },
      results: [],
    },
    insertedTasks: [],
  };
}

function chunkRows<T>(rows: T[], chunkSize: number): T[][] {
  if (rows.length === 0 || chunkSize <= 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
}

function buildNotificationTaskCandidates(input: {
  rows: AiOppRow[];
  personasById: Record<string, PersonaIdentity>;
}): PipelineTaskCandidate[] {
  return input.rows.flatMap((row, candidateIndex) => {
    if (!row.recipient_persona_id) {
      return [];
    }

    const persona = input.personasById[row.recipient_persona_id];
    if (!persona) {
      return [];
    }

    return [
      {
        candidateIndex,
        opportunityKey: row.id,
        personaId: row.recipient_persona_id,
        username: persona.username,
        dispatchKind: "notification" as const,
        sourceTable: "notifications" as const,
        sourceId: row.source_id,
        dedupeKey: `${persona.username}:${row.source_id}:${row.content_type}`,
        cooldownUntil: new Date(0).toISOString(),
        decisionReason: "Notification selected for direct recipient handling.",
        payload: {
          contentType: row.content_type,
          source: "notification",
          summary: row.summary,
          fixtureMode: "notification-intake" as const,
          boardId: row.board_id,
          postId: row.post_id,
          commentId: row.comment_id,
          parentCommentId: row.parent_comment_id,
          context: row.notification_context,
          notificationType: row.notification_type,
        },
      },
    ];
  });
}

function mergeInjectionPreviews(
  previews: Array<TaskInjectionPreview | null | undefined>,
): TaskInjectionPreview {
  const safePreviews = previews.filter((preview): preview is TaskInjectionPreview =>
    Boolean(preview),
  );
  const results = safePreviews.flatMap((preview) => preview.results);
  const skippedReasonCounts = safePreviews.reduce<Record<string, number>>((counts, preview) => {
    for (const [reason, count] of Object.entries(preview.summary.skippedReasonCounts)) {
      counts[reason] = (counts[reason] ?? 0) + count;
    }
    return counts;
  }, {});

  return {
    rpcName: "inject_persona_tasks",
    summary: {
      candidateCount: results.length,
      insertedCount: results.filter((result) => result.inserted).length,
      skippedCount: results.filter((result) => !result.inserted).length,
      insertedTaskIds: safePreviews.flatMap((preview) => preview.summary.insertedTaskIds),
      skippedReasonCounts,
    },
    results,
  };
}

function mergeExecutedResponses(input: {
  kind: AiAgentRuntimeIntakeKind;
  responses: AiAgentOpportunityPipelineExecutedResponse[];
}): AiAgentOpportunityPipelineExecutedResponse {
  if (input.responses.length === 0) {
    return buildEmptyExecutedResponse(input.kind);
  }

  return {
    mode: "executed",
    kind: input.kind,
    message: `Inserted ${input.responses.flatMap((response) => response.insertedTasks).length} persona_tasks rows for ${input.kind} intake.`,
    injectionPreview: mergeInjectionPreviews(
      input.responses.map((response) => response.injectionPreview),
    ),
    insertedTasks: input.responses.flatMap((response) => response.insertedTasks),
  };
}

function buildPublicCooldownUntil(input: {
  now: Date;
  row: AiOppRow;
  config: RuntimeConfigSnapshot;
}): string {
  const minutes =
    input.row.source_table === "posts"
      ? input.config.postOpportunityCooldownMinutes
      : input.config.commentOpportunityCooldownMinutes;
  return new Date(input.now.getTime() + minutes * 60_000).toISOString();
}

function partitionNotificationRowsByActiveRecipient(input: {
  rows: AiOppRow[];
  personaActivityById: Record<string, boolean>;
}) {
  const activeRows: AiOppRow[] = [];
  const inactiveRows: AiOppRow[] = [];

  for (const row of input.rows) {
    const recipientPersonaId = row.recipient_persona_id;
    if (!recipientPersonaId) {
      inactiveRows.push(row);
      continue;
    }

    if (input.personaActivityById[recipientPersonaId] === true) {
      activeRows.push(row);
      continue;
    }

    inactiveRows.push(row);
  }

  return {
    activeRows,
    inactiveRows,
  };
}

function buildInactiveNotificationProbabilityUpdates(input: {
  rows: AiOppRow[];
  evaluatedAt: string;
}): AiOppProbabilityUpdateInput[] {
  return input.rows.map((row) => ({
    opportunityId: row.id,
    probability: 0,
    probabilityModelKey: NOTIFICATION_INACTIVE_PROBABILITY_MODEL_KEY,
    probabilityPromptVersion: NOTIFICATION_INACTIVE_PROBABILITY_PROMPT_VERSION,
    evaluatedAt: input.evaluatedAt,
  }));
}

type PublicSelectionResult = {
  oppId: string;
  selectedSpeakers: Array<{ name: string; probability: number }>;
  resolvedPersonas: Array<ResolvedSpeakerPersona & { active: true }>;
  matchedPersonaCount: number;
};

function listAvailableFallbackPersonas(input: {
  referenceBatch: string[];
  speakerPersonasByName: Record<string, ResolvedSpeakerPersona[]>;
  existingPersonaIds: Set<string>;
  selectedPersonaIds: Set<string>;
}): Array<ResolvedSpeakerPersona & { active: true }> {
  const seenPersonaIds = new Set<string>();
  const available: Array<ResolvedSpeakerPersona & { active: true }> = [];

  for (const referenceName of input.referenceBatch) {
    const personas = (input.speakerPersonasByName[referenceName] ?? []).filter(
      (persona): persona is ResolvedSpeakerPersona & { active: true } => persona.active,
    );
    for (const persona of personas) {
      if (
        input.existingPersonaIds.has(persona.personaId) ||
        input.selectedPersonaIds.has(persona.personaId) ||
        seenPersonaIds.has(persona.personaId)
      ) {
        continue;
      }

      seenPersonaIds.add(persona.personaId);
      available.push(persona);
    }
  }

  return available;
}

function pickRandomFallbackPersona(input: {
  personas: Array<ResolvedSpeakerPersona & { active: true }>;
  random: () => number;
}): (ResolvedSpeakerPersona & { active: true }) | null {
  if (input.personas.length === 0) {
    return null;
  }

  const rawIndex = Math.floor(input.random() * input.personas.length);
  const index = Math.min(input.personas.length - 1, Math.max(0, rawIndex));
  return input.personas[index] ?? null;
}

function buildPublicSelectionResults(input: {
  rows: AiOppRow[];
  llmSelections: CandidateSelectionResult[];
  referenceBatch: string[];
  existingPersonaIdsByOppId: Record<string, string[]>;
  speakerPersonasByName: Record<string, ResolvedSpeakerPersona[]>;
  random: () => number;
}): PublicSelectionResult[] {
  const selectionByOppId = new Map(input.llmSelections.map((row) => [row.oppId, row] as const));

  return input.rows.map((row) => {
    const existingPersonaIds = new Set(input.existingPersonaIdsByOppId[row.id] ?? []);
    const selectedPersonaIds = new Set<string>();
    const selectedSpeakers = selectionByOppId.get(row.id)?.selectedSpeakers ?? [];
    const resolvedPersonas: Array<ResolvedSpeakerPersona & { active: true }> = [];

    for (const selectedSpeaker of selectedSpeakers) {
      const activePersonas = (input.speakerPersonasByName[selectedSpeaker.name] ?? []).filter(
        (persona): persona is ResolvedSpeakerPersona & { active: true } => persona.active,
      );
      const nextPersonas = activePersonas.filter(
        (persona) =>
          !existingPersonaIds.has(persona.personaId) && !selectedPersonaIds.has(persona.personaId),
      );
      for (const persona of nextPersonas) {
        selectedPersonaIds.add(persona.personaId);
        resolvedPersonas.push(persona);
      }
    }

    if (resolvedPersonas.length === 0) {
      const fallbackPersona = pickRandomFallbackPersona({
        personas: listAvailableFallbackPersonas({
          referenceBatch: input.referenceBatch,
          speakerPersonasByName: input.speakerPersonasByName,
          existingPersonaIds,
          selectedPersonaIds,
        }),
        random: input.random,
      });

      if (fallbackPersona) {
        selectedPersonaIds.add(fallbackPersona.personaId);
        resolvedPersonas.push(fallbackPersona);
      }
    }

    return {
      oppId: row.id,
      selectedSpeakers,
      resolvedPersonas,
      matchedPersonaCount: existingPersonaIds.size + selectedPersonaIds.size,
    };
  });
}

function buildPublicTaskCandidates(input: {
  rows: AiOppRow[];
  selections: PublicSelectionResult[];
  config: RuntimeConfigSnapshot;
  now: Date;
  candidateIndexStart?: number;
}): PipelineTaskCandidate[] {
  const rowById = new Map(input.rows.map((row) => [row.id, row] as const));
  const candidates: PipelineTaskCandidate[] = [];
  let nextCandidateIndex = input.candidateIndexStart ?? 0;

  for (const selection of input.selections) {
    const row = rowById.get(selection.oppId);
    if (!row) {
      continue;
    }

    for (const persona of selection.resolvedPersonas) {
      candidates.push({
        candidateIndex: nextCandidateIndex,
        opportunityKey: row.id,
        personaId: persona.personaId,
        username: persona.username,
        dispatchKind: "public",
        sourceTable: row.source_table === "posts" ? "posts" : "comments",
        sourceId: row.source_id,
        dedupeKey: `${persona.username}:${row.source_id}:${row.content_type}`,
        cooldownUntil: buildPublicCooldownUntil({
          now: input.now,
          row,
          config: input.config,
        }),
        decisionReason: `${persona.referenceName} matched ${row.content_type} opportunity`,
        payload: {
          contentType: row.content_type,
          source: row.source_table === "posts" ? "public-post" : "public-comment",
          summary: row.summary,
          fixtureMode: "mixed-public-opportunity",
          boardId: row.board_id,
          postId: row.post_id,
          commentId: row.comment_id,
          parentCommentId: row.parent_comment_id,
          context: null,
          notificationType: null,
        },
      });
      nextCandidateIndex += 1;
    }
  }

  return candidates;
}

export class AiAgentOpportunityPipelineService {
  private readonly deps: OpportunityPipelineServiceDeps;

  public constructor(options?: { deps?: Partial<OpportunityPipelineServiceDeps> }) {
    const previewStore = new AiAgentIntakePreviewStore();
    const opportunityStore = new AiOpportunityStore();
    const taskInjectionService = new AiAgentTaskInjectionService();
    const intakeStageLlmService = new AiAgentIntakeStageLlmService();

    this.deps = {
      loadRuntimePreviewSet:
        options?.deps?.loadRuntimePreviewSet ?? (() => previewStore.getRuntimePreviewSet()),
      loadRuntimeConfig:
        options?.deps?.loadRuntimeConfig ??
        (async () => {
          const values = (await loadAiAgentConfig()).values;
          return {
            selectorReferenceBatchSize: values.selectorReferenceBatchSize,
            postOpportunityCooldownMinutes: values.postOpportunityCooldownMinutes,
            commentOpportunityCooldownMinutes: values.commentOpportunityCooldownMinutes,
          };
        }),
      ingestOpportunities:
        options?.deps?.ingestOpportunities ??
        ((rows) => opportunityStore.ingestOpportunities(rows)),
      listUnscoredOpportunities:
        options?.deps?.listUnscoredOpportunities ??
        ((kind) => opportunityStore.listUnscoredOpportunities(kind)),
      listOpportunitiesByIds:
        options?.deps?.listOpportunitiesByIds ??
        ((opportunityIds) => opportunityStore.listOpportunitiesByIds(opportunityIds)),
      scoreOpportunityProbabilities:
        options?.deps?.scoreOpportunityProbabilities ??
        ((input) => intakeStageLlmService.scoreOpportunities(input)),
      updateOpportunityProbabilities:
        options?.deps?.updateOpportunityProbabilities ??
        ((rows) => opportunityStore.updateOpportunityProbabilities(rows)),
      loadPersonaActivity:
        options?.deps?.loadPersonaActivity ??
        (async (personaIds) => {
          const uniqueIds = Array.from(new Set(personaIds.filter((id) => id.length > 0)));
          if (uniqueIds.length === 0) {
            return {};
          }

          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("personas")
            .select("id, status")
            .in("id", uniqueIds)
            .returns<Array<{ id: string; status: string }>>();

          if (error) {
            throw new Error(`load persona activity failed: ${error.message}`);
          }

          return Object.fromEntries((data ?? []).map((row) => [row.id, row.status === "active"]));
        }),
      listSelectedNotificationOpportunities:
        options?.deps?.listSelectedNotificationOpportunities ??
        (() => opportunityStore.listSelectedNotificationOpportunities()),
      listEligiblePublicCandidateOpportunities:
        options?.deps?.listEligiblePublicCandidateOpportunities ??
        ((input) => opportunityStore.listEligiblePublicCandidateOpportunities(input)),
      listResolvedPersonaIdsByOpportunityIds:
        options?.deps?.listResolvedPersonaIdsByOpportunityIds ??
        ((opportunityIds) =>
          opportunityStore.listResolvedPersonaIdsByOpportunityIds(opportunityIds)),
      selectPublicSpeakerCandidates:
        options?.deps?.selectPublicSpeakerCandidates ??
        ((input) => intakeStageLlmService.selectPublicSpeakerCandidates(input)),
      recordPublicCandidateResults:
        options?.deps?.recordPublicCandidateResults ??
        ((input) => opportunityStore.recordPublicCandidateResults(input)),
      executeCandidates:
        options?.deps?.executeCandidates ??
        ((input) => taskInjectionService.executeCandidates(input)),
      markNotificationsProcessed:
        options?.deps?.markNotificationsProcessed ??
        ((opportunityIds) => opportunityStore.markNotificationsProcessed(opportunityIds)),
      loadPublicRuntimeCursor:
        options?.deps?.loadPublicRuntimeCursor ??
        (async () => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("orchestrator_runtime_state")
            .select("public_candidate_group_index, public_candidate_epoch")
            .eq("singleton_key", "global")
            .single<{ public_candidate_group_index: number; public_candidate_epoch: number }>();

          if (error) {
            throw new Error(`load public runtime cursor failed: ${error.message}`);
          }

          return {
            groupIndex: data.public_candidate_group_index,
            candidateEpoch: data.public_candidate_epoch,
          };
        }),
      advancePublicRuntimeCursor:
        options?.deps?.advancePublicRuntimeCursor ??
        (async () => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("orchestrator_runtime_state")
            .select("public_candidate_group_index")
            .eq("singleton_key", "global")
            .single<{ public_candidate_group_index: number }>();

          if (error) {
            throw new Error(`load public runtime cursor before advance failed: ${error.message}`);
          }

          const { error: updateError } = await supabase
            .from("orchestrator_runtime_state")
            .update({
              public_candidate_group_index: (data.public_candidate_group_index ?? 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("singleton_key", "global");

          if (updateError) {
            throw new Error(`advance public runtime cursor failed: ${updateError.message}`);
          }
        }),
      loadReferenceBatch:
        options?.deps?.loadReferenceBatch ??
        (async (input) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("persona_reference_sources")
            .select("source_name, match_key")
            .order("source_name", { ascending: true })
            .returns<Array<{ source_name: string; match_key: string }>>();

          if (error) {
            throw new Error(`load persona reference batch failed: ${error.message}`);
          }

          const deduped: Array<{ sourceName: string; matchKey: string }> = [];
          const seen = new Set<string>();
          for (const row of data ?? []) {
            if (!row.match_key || seen.has(row.match_key)) {
              continue;
            }
            seen.add(row.match_key);
            deduped.push({ sourceName: row.source_name, matchKey: row.match_key });
          }

          const totalReferences = deduped.length;
          const batchSize = Math.max(1, input.batchSize);
          const totalGroups = totalReferences > 0 ? Math.ceil(totalReferences / batchSize) : 0;
          const effectiveGroupIndex = totalGroups > 0 ? input.requestedGroupIndex % totalGroups : 0;
          const start = effectiveGroupIndex * batchSize;
          const referenceNames = deduped
            .slice(start, start + batchSize)
            .map((row) => row.sourceName);

          return {
            referenceNames,
            totalReferences,
            effectiveGroupIndex,
            batchSize,
          };
        }),
      resolveSpeakerPersonas:
        options?.deps?.resolveSpeakerPersonas ??
        (async (referenceNames) => {
          const uniqueNames = Array.from(
            new Set(referenceNames.map((name) => name.trim()).filter((name) => name.length > 0)),
          );
          if (uniqueNames.length === 0) {
            return [];
          }

          const matchKeys = Array.from(
            new Set(uniqueNames.map((name) => buildPersonaReferenceMatchKey(name))),
          );
          const supabase = createAdminClient();
          const { data: referenceRows, error: referenceError } = await supabase
            .from("persona_reference_sources")
            .select("persona_id, source_name, match_key")
            .in("match_key", matchKeys)
            .returns<Array<{ persona_id: string; source_name: string; match_key: string }>>();

          if (referenceError) {
            throw new Error(`load speaker persona references failed: ${referenceError.message}`);
          }

          const personaIds = Array.from(
            new Set((referenceRows ?? []).map((row) => row.persona_id)),
          );
          const { data: personas, error: personaError } = await supabase
            .from("personas")
            .select("id, username, status")
            .in("id", personaIds)
            .returns<Array<{ id: string; username: string | null; status: string }>>();

          if (personaError) {
            throw new Error(`load speaker personas failed: ${personaError.message}`);
          }

          const personaById = new Map(
            (personas ?? []).map((persona) => [
              persona.id,
              {
                username: persona.username ?? persona.id,
                active: persona.status === "active",
              },
            ]),
          );

          const rowsByMatchKey = new Map<string, Array<{ persona_id: string }>>();
          for (const row of referenceRows ?? []) {
            const bucket = rowsByMatchKey.get(row.match_key) ?? [];
            bucket.push({ persona_id: row.persona_id });
            rowsByMatchKey.set(row.match_key, bucket);
          }

          return uniqueNames.flatMap((referenceName) => {
            const matchKey = buildPersonaReferenceMatchKey(referenceName);
            return (rowsByMatchKey.get(matchKey) ?? []).flatMap((row) => {
              const persona = personaById.get(row.persona_id);
              return persona
                ? [
                    {
                      referenceName,
                      personaId: row.persona_id,
                      username: persona.username,
                      active: persona.active,
                    } satisfies ResolvedSpeakerPersona,
                  ]
                : [];
            });
          });
        }),
      loadPersonaIdentities:
        options?.deps?.loadPersonaIdentities ??
        (async (personaIds) => {
          if (personaIds.length === 0) {
            return {};
          }

          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("personas")
            .select("id, username")
            .in("id", personaIds)
            .returns<Array<{ id: string; username: string | null }>>();

          if (error) {
            throw new Error(`load persona identities failed: ${error.message}`);
          }

          return Object.fromEntries(
            (data ?? []).map((row) => [
              row.id,
              {
                personaId: row.id,
                username: row.username ?? row.id,
              } satisfies PersonaIdentity,
            ]),
          );
        }),
      random: options?.deps?.random ?? (() => Math.random()),
      now: options?.deps?.now ?? (() => new Date()),
    };
  }

  private async ingestAndScore(input: {
    kind: AiAgentRuntimeIntakeKind;
    snapshot: AiAgentRuntimeSourceSnapshot;
  }): Promise<void> {
    const upsertRows = mapSnapshotToOppRows(input.snapshot);
    if (upsertRows.length > 0) {
      await this.deps.ingestOpportunities(upsertRows);
    }

    const unscoredRows = await this.deps.listUnscoredOpportunities(input.kind);
    if (unscoredRows.length === 0) {
      return;
    }

    if (input.kind === "notification") {
      const personaActivityById = await this.deps.loadPersonaActivity(
        Array.from(
          new Set(
            unscoredRows.flatMap((row) =>
              row.recipient_persona_id ? [row.recipient_persona_id] : [],
            ),
          ),
        ),
      );
      const { activeRows, inactiveRows } = partitionNotificationRowsByActiveRecipient({
        rows: unscoredRows,
        personaActivityById,
      });

      if (inactiveRows.length > 0) {
        await this.deps.updateOpportunityProbabilities(
          buildInactiveNotificationProbabilityUpdates({
            rows: inactiveRows,
            evaluatedAt: this.deps.now().toISOString(),
          }),
        );
      }

      if (activeRows.length === 0) {
        return;
      }

      for (const rows of chunkRows(activeRows, OPPORTUNITY_SCORE_BATCH_SIZE)) {
        const scoredRows = await this.deps.scoreOpportunityProbabilities({
          kind: input.kind,
          rows,
        });
        await this.deps.updateOpportunityProbabilities(scoredRows);
      }
      return;
    }

    const scopedRows =
      input.kind === "public"
        ? unscoredRows.slice(0, MAX_PUBLIC_SCORE_ROWS_PER_SYNC)
        : unscoredRows;

    for (const rows of chunkRows(scopedRows, OPPORTUNITY_SCORE_BATCH_SIZE)) {
      const scoredRows = await this.deps.scoreOpportunityProbabilities({
        kind: input.kind,
        rows,
      });
      await this.deps.updateOpportunityProbabilities(scoredRows);
    }
  }

  public async ingestSnapshotOnly(input: {
    kind: AiAgentRuntimeIntakeKind;
    snapshot: AiAgentRuntimeSourceSnapshot;
  }): Promise<void> {
    const upsertRows = mapSnapshotToOppRows(input.snapshot);
    if (upsertRows.length > 0) {
      await this.deps.ingestOpportunities(upsertRows);
    }

    if (input.kind !== "notification") {
      return;
    }

    const unscoredRows = await this.deps.listUnscoredOpportunities("notification");
    if (unscoredRows.length === 0) {
      return;
    }

    const personaActivityById = await this.deps.loadPersonaActivity(
      Array.from(
        new Set(
          unscoredRows.flatMap((row) =>
            row.recipient_persona_id ? [row.recipient_persona_id] : [],
          ),
        ),
      ),
    );
    const { inactiveRows } = partitionNotificationRowsByActiveRecipient({
      rows: unscoredRows,
      personaActivityById,
    });

    if (inactiveRows.length > 0) {
      await this.deps.updateOpportunityProbabilities(
        buildInactiveNotificationProbabilityUpdates({
          rows: inactiveRows,
          evaluatedAt: this.deps.now().toISOString(),
        }),
      );
    }
  }

  public async syncOpportunities(input: { kind: AiAgentRuntimeIntakeKind }): Promise<void> {
    const runtimePreviews = await this.deps.loadRuntimePreviewSet();
    const snapshot =
      input.kind === "public" ? runtimePreviews.public : runtimePreviews.notification;
    await this.ingestAndScore({
      kind: input.kind,
      snapshot,
    });
  }

  private async executeNotificationFlow() {
    const selectedRows = await this.deps.listSelectedNotificationOpportunities();
    if (selectedRows.length === 0) {
      return buildEmptyExecutedResponse("notification");
    }

    const personaActivityById = await this.deps.loadPersonaActivity(
      Array.from(
        new Set(
          selectedRows.flatMap((row) =>
            row.recipient_persona_id ? [row.recipient_persona_id] : [],
          ),
        ),
      ),
    );
    const { activeRows, inactiveRows } = partitionNotificationRowsByActiveRecipient({
      rows: selectedRows,
      personaActivityById,
    });

    if (inactiveRows.length > 0) {
      await this.deps.updateOpportunityProbabilities(
        buildInactiveNotificationProbabilityUpdates({
          rows: inactiveRows,
          evaluatedAt: this.deps.now().toISOString(),
        }),
      );
    }

    if (activeRows.length === 0) {
      return buildEmptyExecutedResponse("notification");
    }

    const personaIds = Array.from(
      new Set(
        activeRows.flatMap((row) => (row.recipient_persona_id ? [row.recipient_persona_id] : [])),
      ),
    );
    const personasById = await this.deps.loadPersonaIdentities(personaIds);
    const taskCandidates = buildNotificationTaskCandidates({
      rows: activeRows,
      personasById,
    });

    if (taskCandidates.length === 0) {
      return buildEmptyExecutedResponse("notification");
    }

    const processedOpportunityIds = activeRows
      .filter((row) => taskCandidates.some((candidate) => candidate.sourceId === row.source_id))
      .map((row) => row.id);
    const result = await this.deps.executeCandidates({
      kind: "notification",
      candidates: taskCandidates,
    });

    if (processedOpportunityIds.length > 0) {
      await this.deps.markNotificationsProcessed(processedOpportunityIds);
    }

    return result;
  }

  public async scoreAdminOpportunityBatch(input: {
    kind: AiAgentRuntimeIntakeKind;
    opportunityIds: string[];
  }): Promise<void> {
    const rows = (await this.deps.listOpportunitiesByIds(input.opportunityIds)).filter(
      (row) => row.kind === input.kind && row.probability === null,
    );
    if (rows.length === 0) {
      return;
    }

    if (input.kind === "notification") {
      const personaActivityById = await this.deps.loadPersonaActivity(
        Array.from(
          new Set(
            rows.flatMap((row) => (row.recipient_persona_id ? [row.recipient_persona_id] : [])),
          ),
        ),
      );
      const { activeRows, inactiveRows } = partitionNotificationRowsByActiveRecipient({
        rows,
        personaActivityById,
      });
      if (inactiveRows.length > 0) {
        await this.deps.updateOpportunityProbabilities(
          buildInactiveNotificationProbabilityUpdates({
            rows: inactiveRows,
            evaluatedAt: this.deps.now().toISOString(),
          }),
        );
      }
      if (activeRows.length === 0) {
        return;
      }
      const scoredRows = await this.deps.scoreOpportunityProbabilities({
        kind: input.kind,
        rows: activeRows,
      });
      await this.deps.updateOpportunityProbabilities(scoredRows);
      return;
    }

    const scoredRows = await this.deps.scoreOpportunityProbabilities({
      kind: input.kind,
      rows,
    });
    await this.deps.updateOpportunityProbabilities(scoredRows);
  }

  public async executeAdminPublicCandidateBatch(input: {
    opportunityIds: string[];
    groupIndex: number;
    batchSize: number;
    candidateEpoch?: number;
  }): Promise<AdminPublicCandidateBatchResult> {
    const [config, rows] = await Promise.all([
      this.deps.loadRuntimeConfig(),
      this.deps.listOpportunitiesByIds(input.opportunityIds),
    ]);
    const eligibleRows = rows.filter(
      (row) => row.kind === "public" && row.selected === true && row.matched_persona_count < 3,
    );
    if (eligibleRows.length === 0) {
      return {
        taskResponse: buildEmptyExecutedResponse("public"),
        resolvedRows: [],
        taskOutcomes: [],
      };
    }

    const referenceBatch = await this.deps.loadReferenceBatch({
      requestedGroupIndex: input.groupIndex,
      batchSize: input.batchSize,
    });
    if (referenceBatch.referenceNames.length === 0) {
      return {
        taskResponse: buildEmptyExecutedResponse("public"),
        resolvedRows: [],
        taskOutcomes: [],
      };
    }

    const existingPersonaIdsByOppId = await this.deps.listResolvedPersonaIdsByOpportunityIds(
      eligibleRows.map((row) => row.id),
    );
    const llmSelections = await this.deps.selectPublicSpeakerCandidates({
      rows: eligibleRows,
      referenceBatch: referenceBatch.referenceNames,
    });
    const speakerPersonas = await this.deps.resolveSpeakerPersonas(referenceBatch.referenceNames);
    const speakerPersonasByName = speakerPersonas.reduce<Record<string, ResolvedSpeakerPersona[]>>(
      (acc, persona) => {
        acc[persona.referenceName] = [...(acc[persona.referenceName] ?? []), persona];
        return acc;
      },
      {},
    );
    const selections = buildPublicSelectionResults({
      rows: eligibleRows,
      llmSelections,
      referenceBatch: referenceBatch.referenceNames,
      existingPersonaIdsByOppId,
      speakerPersonasByName,
      random: this.deps.random,
    });
    const taskCandidates = buildPublicTaskCandidates({
      rows: eligibleRows,
      selections,
      config,
      now: this.deps.now(),
    });

    await this.deps.recordPublicCandidateResults({
      groups: selections.map((selection) => ({
        oppId: selection.oppId,
        candidateEpoch: input.candidateEpoch ?? 0,
        groupIndex: referenceBatch.effectiveGroupIndex,
        batchSize: referenceBatch.batchSize,
        selectedSpeakers: selection.selectedSpeakers,
        resolvedPersonaIds: selection.resolvedPersonas.map((persona) => persona.personaId),
      })),
      matchedPersonaCounts: selections.map((selection) => ({
        opportunityId: selection.oppId,
        matchedPersonaCount: selection.matchedPersonaCount,
      })),
    });

    const resolvedRows = selections.flatMap((selection) =>
      selection.resolvedPersonas.map((persona) => ({
        opportunityId: selection.oppId,
        referenceName: persona.referenceName,
        probability:
          selection.selectedSpeakers.find((speaker) => speaker.name === persona.referenceName)
            ?.probability ?? 0,
        personaId: persona.personaId,
        active: persona.active,
      })),
    );

    const taskResponse =
      taskCandidates.length > 0
        ? await this.deps.executeCandidates({
            kind: "public",
            candidates: taskCandidates,
          })
        : buildEmptyExecutedResponse("public");
    const insertedTaskById = new Map(
      taskResponse.insertedTasks.map((task) => [task.id, task] as const),
    );
    const candidateByIndex = new Map(
      taskCandidates.map((candidate) => [candidate.candidateIndex, candidate] as const),
    );
    const taskOutcomes = taskResponse.injectionPreview.results.flatMap((result) => {
      const candidate = candidateByIndex.get(result.candidateIndex);
      if (!candidate) {
        return [];
      }

      const insertedTask = result.taskId ? insertedTaskById.get(result.taskId) : null;
      return [
        {
          opportunityId: candidate.opportunityKey,
          personaId: candidate.personaId,
          inserted: result.inserted,
          taskId: result.taskId,
          skipReason: result.skipReason,
          status: insertedTask?.status ?? (result.inserted ? "PENDING" : "FAILED"),
          errorMessage: insertedTask?.errorMessage ?? result.skipReason,
        } satisfies AdminPublicCandidateTaskOutcome,
      ];
    });

    return {
      taskResponse,
      resolvedRows,
      taskOutcomes,
    };
  }

  private async executePublicFlow(input: {
    config: RuntimeConfigSnapshot;
  }): Promise<AiAgentOpportunityPipelineExecutedResponse> {
    const cursor = await this.deps.loadPublicRuntimeCursor();
    const referenceBatch = await this.deps.loadReferenceBatch({
      requestedGroupIndex: cursor.groupIndex,
      batchSize: input.config.selectorReferenceBatchSize,
    });

    const eligibleRows = await this.deps.listEligiblePublicCandidateOpportunities({
      candidateEpoch: cursor.candidateEpoch,
      groupIndex: referenceBatch.effectiveGroupIndex,
      batchSize: referenceBatch.batchSize,
    });

    if (eligibleRows.length === 0 || referenceBatch.referenceNames.length === 0) {
      await this.deps.advancePublicRuntimeCursor();
      return buildEmptyExecutedResponse("public");
    }

    const speakerPersonas = await this.deps.resolveSpeakerPersonas(referenceBatch.referenceNames);
    const speakerPersonasByName = speakerPersonas.reduce<Record<string, ResolvedSpeakerPersona[]>>(
      (acc, persona) => {
        acc[persona.referenceName] = [...(acc[persona.referenceName] ?? []), persona];
        return acc;
      },
      {},
    );
    const batchResponses: AiAgentOpportunityPipelineExecutedResponse[] = [];
    let candidateIndexStart = 0;

    for (const rows of chunkRows(eligibleRows, PUBLIC_CANDIDATE_BATCH_SIZE)) {
      const existingPersonaIdsByOppId = await this.deps.listResolvedPersonaIdsByOpportunityIds(
        rows.map((row) => row.id),
      );
      const llmSelections = await this.deps.selectPublicSpeakerCandidates({
        rows,
        referenceBatch: referenceBatch.referenceNames,
      });
      const selections = buildPublicSelectionResults({
        rows,
        llmSelections,
        referenceBatch: referenceBatch.referenceNames,
        existingPersonaIdsByOppId,
        speakerPersonasByName,
        random: this.deps.random,
      });
      const taskCandidates = buildPublicTaskCandidates({
        rows,
        selections,
        config: input.config,
        now: this.deps.now(),
        candidateIndexStart,
      });
      candidateIndexStart += taskCandidates.length;

      await this.deps.recordPublicCandidateResults({
        groups: selections.map((selection) => ({
          oppId: selection.oppId,
          candidateEpoch: cursor.candidateEpoch,
          groupIndex: referenceBatch.effectiveGroupIndex,
          batchSize: referenceBatch.batchSize,
          selectedSpeakers: selection.selectedSpeakers,
          resolvedPersonaIds: selection.resolvedPersonas.map((persona) => persona.personaId),
        })),
        matchedPersonaCounts: selections.map((selection) => ({
          opportunityId: selection.oppId,
          matchedPersonaCount: selection.matchedPersonaCount,
        })),
      });

      if (taskCandidates.length > 0) {
        batchResponses.push(
          await this.deps.executeCandidates({
            kind: "public",
            candidates: taskCandidates,
          }),
        );
      }
    }

    const result = mergeExecutedResponses({
      kind: "public",
      responses: batchResponses,
    });

    await this.deps.advancePublicRuntimeCursor();
    return result;
  }

  public async executeFlow(input: {
    kind: AiAgentRuntimeIntakeKind;
  }): Promise<AiAgentOpportunityPipelineExecutedResponse> {
    const [previewSet, config] = await Promise.all([
      this.deps.loadRuntimePreviewSet(),
      this.deps.loadRuntimeConfig(),
    ]);
    const snapshot = input.kind === "notification" ? previewSet.notification : previewSet.public;

    await this.ingestAndScore({
      kind: input.kind,
      snapshot,
    });

    return input.kind === "notification"
      ? this.executeNotificationFlow()
      : this.executePublicFlow({ config });
  }
}
