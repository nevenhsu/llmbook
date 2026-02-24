import { createAdminClient } from "@/lib/supabase/admin";
import type { TaskIntent, TaskIntentType } from "@/lib/ai/contracts/task-intents";

export type PersistIntentInput = {
  intentType: TaskIntentType;
  sourceTable: TaskIntent["sourceTable"];
  sourceId: string;
  sourceCreatedAt: string;
  payload: Record<string, unknown>;
};

export type StoredIntent = TaskIntent & {
  status: "NEW" | "DISPATCHED" | "SKIPPED";
  selectedPersonaId?: string;
  decisionReasonCodes: string[];
};

export class SupabaseTaskIntentRepository {
  public async upsertIntent(input: PersistIntentInput): Promise<StoredIntent> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("task_intents")
      .upsert(
        {
          intent_type: input.intentType,
          source_table: input.sourceTable,
          source_id: input.sourceId,
          source_created_at: input.sourceCreatedAt,
          payload: input.payload,
        },
        {
          onConflict: "intent_type,source_table,source_id",
        },
      )
      .select(
        "id, intent_type, source_table, source_id, source_created_at, payload, status, selected_persona_id, decision_reason_codes",
      )
      .single<any>();

    if (error) {
      throw new Error(`upsert task_intent failed: ${error.message}`);
    }

    return {
      id: data.id,
      type: data.intent_type,
      sourceTable: data.source_table,
      sourceId: data.source_id,
      createdAt: data.source_created_at,
      payload: data.payload ?? {},
      status: data.status,
      selectedPersonaId: data.selected_persona_id ?? undefined,
      decisionReasonCodes: data.decision_reason_codes ?? [],
    };
  }

  public async listNewIntents(limit = 100): Promise<StoredIntent[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("task_intents")
      .select(
        "id, intent_type, source_table, source_id, source_created_at, payload, status, selected_persona_id, decision_reason_codes",
      )
      .eq("status", "NEW")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`list NEW task_intents failed: ${error.message}`);
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      type: row.intent_type,
      sourceTable: row.source_table,
      sourceId: row.source_id,
      createdAt: row.source_created_at,
      payload: row.payload ?? {},
      status: row.status,
      selectedPersonaId: row.selected_persona_id ?? undefined,
      decisionReasonCodes: row.decision_reason_codes ?? [],
    }));
  }

  public async markDispatched(input: {
    intentId: string;
    personaId: string;
    reasons: string[];
  }): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("task_intents")
      .update({
        status: "DISPATCHED",
        selected_persona_id: input.personaId,
        decision_reason_codes: input.reasons,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.intentId);

    if (error) {
      throw new Error(`markDispatched failed: ${error.message}`);
    }
  }

  public async markSkipped(input: { intentId: string; reasons: string[] }): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("task_intents")
      .update({
        status: "SKIPPED",
        decision_reason_codes: input.reasons,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.intentId);

    if (error) {
      throw new Error(`markSkipped failed: ${error.message}`);
    }
  }
}
