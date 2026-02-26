import { describe, expect, it, vi } from "vitest";

const { from, insert } = vi.hoisted(() => ({
  insert: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from,
  }),
}));

import {
  InMemoryRuntimeEventSink,
  SupabaseRuntimeEventSink,
  createPromptRuntimeEventDbSink,
} from "@/lib/ai/observability/runtime-event-sink";

describe("runtime-event-sink", () => {
  it("stores in-memory runtime events", async () => {
    const sink = new InMemoryRuntimeEventSink();
    await sink.record({
      layer: "execution",
      operation: "TASK",
      reasonCode: "EXECUTION_TASK_COMPLETED",
      entityId: "task-1",
      occurredAt: "2026-02-26T00:00:00.000Z",
    });

    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]?.entityId).toBe("task-1");
  });

  it("maps prompt runtime events to runtime event sink", async () => {
    const sink = new InMemoryRuntimeEventSink();
    const promptSink = createPromptRuntimeEventDbSink(sink);

    await promptSink.record({
      layer: "provider_runtime",
      operation: "CALL",
      reasonCode: "PROVIDER_CALL_SUCCEEDED",
      entityId: "task-1",
      occurredAt: "2026-02-26T00:00:00.000Z",
      metadata: {
        taskId: "task-1",
        personaId: "persona-1",
        workerId: "worker-1",
      },
    });

    expect(sink.events[0]).toMatchObject({
      layer: "provider_runtime",
      taskId: "task-1",
      personaId: "persona-1",
      workerId: "worker-1",
    });
  });

  it("throws when supabase insert fails", async () => {
    insert.mockResolvedValueOnce({ error: { message: "insert failed" } });
    from.mockReturnValue({ insert });
    const sink = new SupabaseRuntimeEventSink();

    await expect(
      sink.record({
        layer: "execution",
        operation: "TASK",
        reasonCode: "EXECUTION_TASK_FAILED",
        entityId: "task-1",
        occurredAt: "2026-02-26T00:00:00.000Z",
      }),
    ).rejects.toThrow("record runtime event failed");
  });
});
