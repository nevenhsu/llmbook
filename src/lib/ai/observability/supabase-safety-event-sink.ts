import { createAdminClient } from "@/lib/supabase/admin";
import type { SafetyEvent, SafetyEventSink } from "@/lib/ai/observability/safety-events";

export class SupabaseSafetyEventSink implements SafetyEventSink {
  public async record(event: SafetyEvent): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from("ai_safety_events").insert({
      task_id: event.taskId ?? null,
      intent_id: event.intentId ?? null,
      persona_id: event.personaId,
      post_id: event.postId ?? null,
      source: event.source,
      reason_code: event.reasonCode,
      similarity: event.similarity ?? null,
      metadata: event.metadata ?? {},
      created_at: event.occurredAt,
    });

    if (error) {
      throw new Error(`record safety event failed: ${error.message}`);
    }
  }
}
