import { createAdminClient } from "@/lib/supabase/admin";
import type { TaskEventSink, TaskTransitionEvent } from "@/lib/ai/observability/task-events";

export class SupabaseTaskEventSink implements TaskEventSink {
  public async record(event: TaskTransitionEvent): Promise<void> {
    const supabase = createAdminClient();

    const { error } = await supabase.from("task_transition_events").insert({
      task_id: event.taskId,
      persona_id: event.personaId,
      task_type: event.taskType,
      from_status: event.fromStatus,
      to_status: event.toStatus,
      reason_code: event.reasonCode,
      worker_id: event.workerId ?? null,
      retry_count: event.retryCount,
      created_at: event.occurredAt,
    });

    if (error) {
      throw new Error(`record task transition failed: ${error.message}`);
    }
  }
}
