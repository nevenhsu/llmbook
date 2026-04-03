import { createAdminClient } from "@/lib/supabase/admin";

export type AiOppKind = "public" | "notification";
export type AiOppSourceTable = "posts" | "comments" | "notifications";
export type AiOppContentType = "post" | "comment" | "reply" | "notification";

export type AiOppRow = {
  id: string;
  kind: AiOppKind;
  source_table: AiOppSourceTable;
  source_id: string;
  board_id: string | null;
  board_slug: string | null;
  post_id: string | null;
  comment_id: string | null;
  parent_comment_id: string | null;
  notification_id: string | null;
  recipient_persona_id: string | null;
  content_type: AiOppContentType;
  summary: string;
  probability: number | null;
  selected: boolean | null;
  matched_persona_count: number;
  notification_context: string | null;
  notification_type: string | null;
  notification_processed_at: string | null;
  probability_model_key: string | null;
  probability_prompt_version: string | null;
  probability_evaluated_at: string | null;
  source_created_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AiOppUpsertInput = {
  kind: AiOppKind;
  sourceTable: AiOppSourceTable;
  sourceId: string;
  boardId: string | null;
  boardSlug: string | null;
  postId: string | null;
  commentId: string | null;
  parentCommentId: string | null;
  notificationId: string | null;
  recipientPersonaId: string | null;
  contentType: AiOppContentType;
  summary: string;
  notificationContext: string | null;
  notificationType: string | null;
  sourceCreatedAt: string | null;
};

export type AiOppProbabilityUpdateInput = {
  opportunityId: string;
  probability: number;
  probabilityModelKey: string | null;
  probabilityPromptVersion: string | null;
  evaluatedAt: string;
};

export type AiOppGroupRow = {
  oppId: string;
  candidateEpoch: number;
  groupIndex: number;
  batchSize: number;
  selectedSpeakers: Array<{ name: string; probability: number }>;
  resolvedPersonaIds: string[];
};

export type OpportunityMatchedPersonaCountUpdate = {
  opportunityId: string;
  matchedPersonaCount: number;
};

type OpportunityStoreDeps = {
  insertIgnoreExisting: (rows: AiOppUpsertInput[]) => Promise<number>;
  listOpportunitiesByIds: (opportunityIds: string[]) => Promise<AiOppRow[]>;
  listUnscoredOpportunities: (kind: AiOppKind) => Promise<AiOppRow[]>;
  listEligiblePublicCandidateOpportunities: (input: {
    candidateEpoch: number;
    groupIndex: number;
    batchSize: number;
  }) => Promise<AiOppRow[]>;
  listSelectedNotificationOpportunities: () => Promise<AiOppRow[]>;
  listAdminLabOpportunities: (kind: AiOppKind) => Promise<AiOppRow[]>;
  updateOpportunityProbabilities: (rows: AiOppProbabilityUpdateInput[]) => Promise<void>;
  listResolvedPersonaIdsByOpportunityIds: (
    opportunityIds: string[],
  ) => Promise<Record<string, string[]>>;
  insertOppGroups: (rows: AiOppGroupRow[]) => Promise<void>;
  updateMatchedPersonaCounts: (rows: OpportunityMatchedPersonaCountUpdate[]) => Promise<void>;
  markNotificationsProcessed: (opportunityIds: string[]) => Promise<void>;
  now: () => Date;
};

const AI_OPP_SELECT =
  "id, kind, source_table, source_id, board_id, board_slug, post_id, comment_id, parent_comment_id, notification_id, recipient_persona_id, content_type, summary, probability, selected, matched_persona_count, notification_context, notification_type, notification_processed_at, probability_model_key, probability_prompt_version, probability_evaluated_at, source_created_at, created_at, updated_at";

function mapUpsertRow(row: AiOppUpsertInput) {
  return {
    kind: row.kind,
    source_table: row.sourceTable,
    source_id: row.sourceId,
    board_id: row.boardId,
    board_slug: row.boardSlug,
    post_id: row.postId,
    comment_id: row.commentId,
    parent_comment_id: row.parentCommentId,
    notification_id: row.notificationId,
    recipient_persona_id: row.recipientPersonaId,
    content_type: row.contentType,
    summary: row.summary,
    notification_context: row.notificationContext,
    notification_type: row.notificationType,
    source_created_at: row.sourceCreatedAt,
  };
}

async function updateMatchedPersonaCountsDb(rows: OpportunityMatchedPersonaCountUpdate[]) {
  if (rows.length === 0) {
    return;
  }

  const supabase = createAdminClient();
  await Promise.all(
    rows.map(async (row) => {
      const { error: updateError } = await supabase
        .from("ai_opps")
        .update({
          matched_persona_count: row.matchedPersonaCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.opportunityId)
        .lt("matched_persona_count", row.matchedPersonaCount);

      if (updateError) {
        throw new Error(`update ai_opps.matched_persona_count failed: ${updateError.message}`);
      }
    }),
  );
}

export class AiOpportunityStore {
  private readonly deps: OpportunityStoreDeps;

  public constructor(options?: { deps?: Partial<OpportunityStoreDeps> }) {
    this.deps = {
      insertIgnoreExisting:
        options?.deps?.insertIgnoreExisting ??
        (async (rows) => {
          if (rows.length === 0) {
            return 0;
          }

          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("ai_opps")
            .upsert(rows.map(mapUpsertRow), {
              onConflict: "kind,source_table,source_id",
              ignoreDuplicates: true,
            })
            .select("id")
            .returns<Array<{ id: string }>>();

          if (error) {
            throw new Error(`insert ai_opps failed: ${error.message}`);
          }

          return data?.length ?? 0;
        }),
      listOpportunitiesByIds:
        options?.deps?.listOpportunitiesByIds ??
        (async (opportunityIds) => {
          if (opportunityIds.length === 0) {
            return [];
          }

          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("ai_opps")
            .select(AI_OPP_SELECT)
            .in("id", opportunityIds)
            .returns<AiOppRow[]>();

          if (error) {
            throw new Error(`load ai_opps by id failed: ${error.message}`);
          }

          return data ?? [];
        }),
      listUnscoredOpportunities:
        options?.deps?.listUnscoredOpportunities ??
        (async (kind) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("ai_opps")
            .select(AI_OPP_SELECT)
            .eq("kind", kind)
            .is("probability", null)
            .order("created_at", { ascending: false })
            .returns<AiOppRow[]>();

          if (error) {
            throw new Error(`load unscored ai_opps failed: ${error.message}`);
          }

          return data ?? [];
        }),
      listEligiblePublicCandidateOpportunities:
        options?.deps?.listEligiblePublicCandidateOpportunities ??
        (async (input) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("ai_opps")
            .select(AI_OPP_SELECT)
            .eq("kind", "public")
            .eq("selected", true)
            .lt("matched_persona_count", 3)
            .order("created_at", { ascending: false })
            .returns<AiOppRow[]>();

          if (error) {
            throw new Error(`load public candidate ai_opps failed: ${error.message}`);
          }

          const rows = data ?? [];
          if (rows.length === 0) {
            return [];
          }

          const { data: processedRows, error: processedError } = await supabase
            .from("ai_opp_groups")
            .select("opp_id")
            .eq("candidate_epoch", input.candidateEpoch)
            .eq("group_index", input.groupIndex)
            .eq("batch_size", input.batchSize)
            .returns<Array<{ opp_id: string }>>();

          if (processedError) {
            throw new Error(`load ai_opp_groups failed: ${processedError.message}`);
          }

          const processed = new Set((processedRows ?? []).map((row) => row.opp_id));
          return rows.filter((row) => !processed.has(row.id));
        }),
      listSelectedNotificationOpportunities:
        options?.deps?.listSelectedNotificationOpportunities ??
        (async () => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("ai_opps")
            .select(AI_OPP_SELECT)
            .eq("kind", "notification")
            .eq("selected", true)
            .is("notification_processed_at", null)
            .order("created_at", { ascending: false })
            .returns<AiOppRow[]>();

          if (error) {
            throw new Error(`load selected notification ai_opps failed: ${error.message}`);
          }

          return data ?? [];
        }),
      listAdminLabOpportunities:
        options?.deps?.listAdminLabOpportunities ??
        (async (kind) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("ai_opps")
            .select(AI_OPP_SELECT)
            .eq("kind", kind)
            .or(
              kind === "public"
                ? "probability.is.null,and(selected.eq.true,matched_persona_count.lt.3)"
                : "probability.is.null,and(selected.eq.true,notification_processed_at.is.null)",
            )
            .order("source_created_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .returns<AiOppRow[]>();

          if (error) {
            throw new Error(`load admin lab ai_opps failed: ${error.message}`);
          }

          return data ?? [];
        }),
      updateOpportunityProbabilities:
        options?.deps?.updateOpportunityProbabilities ??
        (async (rows) => {
          if (rows.length === 0) {
            return;
          }

          const supabase = createAdminClient();
          await Promise.all(
            rows.map(async (row) => {
              const { error } = await supabase
                .from("ai_opps")
                .update({
                  probability: row.probability,
                  selected: row.probability > 0.5,
                  probability_model_key: row.probabilityModelKey,
                  probability_prompt_version: row.probabilityPromptVersion,
                  probability_evaluated_at: row.evaluatedAt,
                  updated_at: row.evaluatedAt,
                })
                .eq("id", row.opportunityId);

              if (error) {
                throw new Error(`update ai_opps probability failed: ${error.message}`);
              }
            }),
          );
        }),
      listResolvedPersonaIdsByOpportunityIds:
        options?.deps?.listResolvedPersonaIdsByOpportunityIds ??
        (async (opportunityIds) => {
          if (opportunityIds.length === 0) {
            return {};
          }

          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("ai_opp_groups")
            .select("opp_id, resolved_persona_ids")
            .in("opp_id", opportunityIds)
            .returns<Array<{ opp_id: string; resolved_persona_ids: unknown }>>();

          if (error) {
            throw new Error(`load ai_opp_groups resolved personas failed: ${error.message}`);
          }

          const idsByOpportunityId: Record<string, string[]> = {};
          for (const row of data ?? []) {
            const personaIds = Array.isArray(row.resolved_persona_ids)
              ? row.resolved_persona_ids.filter(
                  (value): value is string => typeof value === "string" && value.length > 0,
                )
              : [];
            idsByOpportunityId[row.opp_id] = Array.from(
              new Set([...(idsByOpportunityId[row.opp_id] ?? []), ...personaIds]),
            );
          }

          return idsByOpportunityId;
        }),
      insertOppGroups:
        options?.deps?.insertOppGroups ??
        (async (rows) => {
          if (rows.length === 0) {
            return;
          }

          const supabase = createAdminClient();
          const { error } = await supabase.from("ai_opp_groups").insert(
            rows.map((row) => ({
              opp_id: row.oppId,
              candidate_epoch: row.candidateEpoch,
              group_index: row.groupIndex,
              batch_size: row.batchSize,
              selected_speakers: row.selectedSpeakers,
              resolved_persona_ids: row.resolvedPersonaIds,
            })),
          );

          if (error) {
            throw new Error(`insert ai_opp_groups failed: ${error.message}`);
          }
        }),
      updateMatchedPersonaCounts:
        options?.deps?.updateMatchedPersonaCounts ?? updateMatchedPersonaCountsDb,
      markNotificationsProcessed:
        options?.deps?.markNotificationsProcessed ??
        (async (opportunityIds) => {
          if (opportunityIds.length === 0) {
            return;
          }

          const nowIso = new Date().toISOString();
          const supabase = createAdminClient();
          const { error } = await supabase
            .from("ai_opps")
            .update({
              notification_processed_at: nowIso,
              updated_at: nowIso,
            })
            .in("id", opportunityIds);

          if (error) {
            throw new Error(`mark notification ai_opps processed failed: ${error.message}`);
          }
        }),
      now: options?.deps?.now ?? (() => new Date()),
    };
  }

  public async ingestOpportunities(rows: AiOppUpsertInput[]): Promise<number> {
    return this.deps.insertIgnoreExisting(rows);
  }

  public async listOpportunitiesByIds(opportunityIds: string[]): Promise<AiOppRow[]> {
    return this.deps.listOpportunitiesByIds(opportunityIds);
  }

  public async listUnscoredOpportunities(kind: AiOppKind): Promise<AiOppRow[]> {
    return this.deps.listUnscoredOpportunities(kind);
  }

  public async listEligiblePublicCandidateOpportunities(input: {
    candidateEpoch: number;
    groupIndex: number;
    batchSize: number;
  }): Promise<AiOppRow[]> {
    return this.deps.listEligiblePublicCandidateOpportunities(input);
  }

  public async listSelectedNotificationOpportunities(): Promise<AiOppRow[]> {
    return this.deps.listSelectedNotificationOpportunities();
  }

  public async listAdminLabOpportunities(kind: AiOppKind): Promise<AiOppRow[]> {
    return this.deps.listAdminLabOpportunities(kind);
  }

  public async updateOpportunityProbabilities(rows: AiOppProbabilityUpdateInput[]): Promise<void> {
    return this.deps.updateOpportunityProbabilities(rows);
  }

  public async listResolvedPersonaIdsByOpportunityIds(
    opportunityIds: string[],
  ): Promise<Record<string, string[]>> {
    return this.deps.listResolvedPersonaIdsByOpportunityIds(opportunityIds);
  }

  public async recordPublicCandidateResults(input: {
    groups: AiOppGroupRow[];
    matchedPersonaCounts: OpportunityMatchedPersonaCountUpdate[];
  }): Promise<void> {
    await this.deps.insertOppGroups(input.groups);
    await this.deps.updateMatchedPersonaCounts(input.matchedPersonaCounts);
  }

  public async markNotificationsProcessed(opportunityIds: string[]): Promise<void> {
    return this.deps.markNotificationsProcessed(opportunityIds);
  }
}
