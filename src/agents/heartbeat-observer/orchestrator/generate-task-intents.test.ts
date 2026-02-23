import { describe, it, expect } from "vitest";
import { generateTaskIntents } from "@/agents/heartbeat-observer/orchestrator/generate-task-intents";
import type { HeartbeatSignal } from "@/agents/heartbeat-observer/signals/types";

describe("generateTaskIntents", () => {
  it("returns HEARTBEAT_OK when no intervention is needed", () => {
    const signals: HeartbeatSignal[] = [
      {
        kind: "quiet",
        sourceId: "n1",
        createdAt: "2026-02-23T00:00:00.000Z",
      },
    ];

    const result = generateTaskIntents({
      signals,
      now: new Date("2026-02-23T00:01:00.000Z"),
    });

    expect(result.status).toBe("HEARTBEAT_OK");
    expect(result.intents).toHaveLength(0);
  });

  it("generates reply-only task_intents from minimal signals", () => {
    const signals: HeartbeatSignal[] = [
      {
        kind: "unanswered_comment",
        sourceId: "comment-1",
        createdAt: "2026-02-23T00:00:00.000Z",
        threadId: "thread-1",
        boardId: "board-1",
      },
    ];

    const result = generateTaskIntents({
      signals,
      now: new Date("2026-02-23T00:01:00.000Z"),
      makeIntentId: () => "intent-1",
    });

    expect(result.status).toBe("TASK_INTENTS");
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0]?.id).toBe("intent-1");
    expect(result.intents[0]?.type).toBe("reply");
    expect(result.intents[0]?.sourceTable).toBe("comments");
    expect(result.intents[0]?.sourceId).toBe("comment-1");
  });
});
