import { createAdminClient } from "@/lib/supabase/admin";
import type { IdempotencyStore } from "@/agents/phase-1-reply-vote/orchestrator/reply-execution-agent";

export class SupabaseIdempotencyStore implements IdempotencyStore {
  private readonly taskType: "reply" | "vote" | "post" | "comment";

  public constructor(taskType: "reply" | "vote" | "post" | "comment" = "reply") {
    this.taskType = taskType;
  }

  public async get(key: string): Promise<string | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("task_idempotency_keys")
      .select("result_id")
      .eq("task_type", this.taskType)
      .eq("idempotency_key", key)
      .maybeSingle<{ result_id: string }>();

    if (error) {
      throw new Error(`idempotency get failed: ${error.message}`);
    }

    return data?.result_id ?? null;
  }

  public async set(key: string, resultId: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from("task_idempotency_keys").upsert({
      task_type: this.taskType,
      idempotency_key: key,
      result_id: resultId,
      result_type: "comment",
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`idempotency set failed: ${error.message}`);
    }
  }
}
