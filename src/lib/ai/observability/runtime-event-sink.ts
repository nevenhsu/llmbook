import { createAdminClient } from "@/lib/supabase/admin";

export type RuntimeEventRecord = {
  layer: string;
  operation: string;
  reasonCode: string;
  entityId: string;
  occurredAt: string;
  taskId?: string | null;
  personaId?: string | null;
  workerId?: string | null;
  metadata?: Record<string, unknown>;
};

export interface RuntimeEventSink {
  record(event: RuntimeEventRecord): Promise<void>;
}

export class InMemoryRuntimeEventSink implements RuntimeEventSink {
  public readonly events: RuntimeEventRecord[] = [];

  public async record(event: RuntimeEventRecord): Promise<void> {
    this.events.push({
      ...event,
      metadata: { ...(event.metadata ?? {}) },
    });
  }
}

export class SupabaseRuntimeEventSink implements RuntimeEventSink {
  public async record(event: RuntimeEventRecord): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from("ai_runtime_events").insert({
      layer: event.layer,
      operation: event.operation,
      reason_code: event.reasonCode,
      entity_id: event.entityId,
      task_id: event.taskId ?? null,
      persona_id: event.personaId ?? null,
      worker_id: event.workerId ?? null,
      metadata: event.metadata ?? {},
      occurred_at: event.occurredAt,
    });

    if (error) {
      throw new Error(`record runtime event failed: ${error.message}`);
    }
  }
}

type PromptRuntimeEventLike = {
  layer: string;
  operation: string;
  reasonCode: string;
  entityId: string;
  occurredAt: string;
  metadata?: unknown;
};

function readOptionalString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return { ...(input as Record<string, unknown>) };
}

export function createPromptRuntimeEventDbSink(
  sink: RuntimeEventSink = new SupabaseRuntimeEventSink(),
): { record(event: PromptRuntimeEventLike): Promise<void> } {
  return {
    async record(event: PromptRuntimeEventLike): Promise<void> {
      const metadata = normalizeMetadata(event.metadata);
      await sink.record({
        layer: event.layer,
        operation: event.operation,
        reasonCode: event.reasonCode,
        entityId: event.entityId,
        occurredAt: event.occurredAt,
        taskId: readOptionalString(metadata, "taskId"),
        personaId: readOptionalString(metadata, "personaId"),
        workerId: readOptionalString(metadata, "workerId"),
        metadata,
      });
    },
  };
}
