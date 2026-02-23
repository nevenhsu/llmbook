import { describe, it, expect, vi } from "vitest";
import { generateTaskIntents } from "@/agents/heartbeat-observer/orchestrator/generate-task-intents";
import { dispatchIntents } from "@/agents/task-dispatcher/orchestrator/dispatch-intents";
import { InMemoryTaskQueueStore, TaskQueue } from "@/lib/ai/task-queue/task-queue";
import { InMemoryTaskEventSink } from "@/lib/ai/observability/task-events";
import {
  InMemoryIdempotencyStore,
  ReplyExecutionAgent,
} from "@/agents/phase-1-reply-vote/orchestrator/reply-execution-agent";

describe("Phase1 reply-only flow", () => {
  it("runs intent -> dispatch -> run -> safety -> write -> done", async () => {
    const now = new Date("2026-02-23T00:00:00.000Z");

    const heartbeat = generateTaskIntents({
      signals: [
        {
          kind: "unanswered_comment",
          sourceId: "comment-1",
          createdAt: now.toISOString(),
          threadId: "thread-1",
          boardId: "board-1",
        },
      ],
      now,
      makeIntentId: () => "intent-1",
    });

    expect(heartbeat.status).toBe("TASK_INTENTS");

    const store = new InMemoryTaskQueueStore();
    const sink = new InMemoryTaskEventSink();
    const queue = new TaskQueue({ store, eventSink: sink, leaseMs: 30_000 });

    const dispatch = await dispatchIntents({
      intents: heartbeat.intents,
      personas: [{ id: "persona-1", status: "active" }],
      policy: { replyEnabled: true },
      now,
      makeTaskId: () => "task-1",
      createTask: async (task) => {
        store.upsert(task);
      },
    });

    expect(dispatch[0]?.dispatched).toBe(true);
    expect(store.snapshot()).toHaveLength(1);

    const writer = {
      write: vi.fn().mockResolvedValue({ resultId: "comment-created-1" }),
    };

    const agent = new ReplyExecutionAgent({
      queue,
      idempotency: new InMemoryIdempotencyStore(),
      generator: { generate: vi.fn().mockResolvedValue({ text: "thanks for sharing" }) },
      safetyGate: { check: vi.fn().mockResolvedValue({ allowed: true }) },
      writer,
    });

    const run = await agent.runOnce({
      workerId: "worker-1",
      now: new Date("2026-02-23T00:00:10.000Z"),
    });

    expect(run).toBe("DONE");
    expect(writer.write).toHaveBeenCalledTimes(1);

    const task = store.snapshot()[0];
    expect(task?.status).toBe("DONE");
    expect(task?.resultId).toBe("comment-created-1");

    expect(
      sink.events.some((event) => event.fromStatus === "PENDING" && event.toStatus === "RUNNING"),
    ).toBe(true);
    expect(
      sink.events.some((event) => event.fromStatus === "RUNNING" && event.toStatus === "DONE"),
    ).toBe(true);
  });
});
