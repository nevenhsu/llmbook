import { describe, it, expect } from "vitest";
import { collectTaskIntents } from "@/agents/heartbeat-observer/orchestrator/collect-task-intents";

describe("collectTaskIntents", () => {
  it("creates reply intents from posts/comments and updates checkpoints", async () => {
    const checkpoints = new Map<string, { lastCapturedAt: Date; safetyOverlapSeconds: number }>([
      ["posts", { lastCapturedAt: new Date("1970-01-01T00:00:00.000Z"), safetyOverlapSeconds: 10 }],
      [
        "comments",
        { lastCapturedAt: new Date("1970-01-01T00:00:00.000Z"), safetyOverlapSeconds: 10 },
      ],
    ]);

    const source = {
      async fetchRecentEvents(sourceName: "posts" | "comments") {
        if (sourceName === "posts") {
          return [
            {
              sourceName,
              sourceId: "post-1",
              createdAt: "2026-02-23T00:00:10.000Z",
              payload: { authorId: "user-1" },
            },
          ];
        }

        return [
          {
            sourceName,
            sourceId: "comment-1",
            createdAt: "2026-02-23T00:00:11.000Z",
            payload: { authorId: "user-2", postId: "post-1" },
          },
        ];
      },
      async getCheckpoint(sourceName: "posts" | "comments") {
        return {
          sourceName,
          lastCapturedAt:
            checkpoints.get(sourceName)?.lastCapturedAt ?? new Date("1970-01-01T00:00:00.000Z"),
          safetyOverlapSeconds: checkpoints.get(sourceName)?.safetyOverlapSeconds ?? 10,
        };
      },
      async upsertCheckpoint(input: {
        sourceName: "posts" | "comments";
        lastCapturedAt: Date;
        safetyOverlapSeconds: number;
      }) {
        checkpoints.set(input.sourceName, {
          lastCapturedAt: input.lastCapturedAt,
          safetyOverlapSeconds: input.safetyOverlapSeconds,
        });
        return input;
      },
    };

    const created: Array<{ intentType: string; sourceTable: string; sourceId: string }> = [];
    const intentRepo = {
      async upsertIntent(input: { intentType: string; sourceTable: string; sourceId: string }) {
        created.push(input);
        return {
          id: `${input.sourceTable}-${input.sourceId}`,
          type: input.intentType,
          sourceTable: input.sourceTable,
          sourceId: input.sourceId,
          createdAt: new Date().toISOString(),
          payload: {},
          status: "NEW" as const,
          decisionReasonCodes: [],
        };
      },
    };

    const summary = await collectTaskIntents({
      source: source as any,
      intentRepo: intentRepo as any,
      sources: ["posts", "comments"],
      isPostInteractable: async () => true,
    });

    expect(summary.createdIntents).toBe(2);
    expect(created).toHaveLength(2);
    expect(created[0]?.sourceTable).toBe("posts");
    expect(created[1]?.sourceTable).toBe("comments");
    expect(checkpoints.get("posts")?.lastCapturedAt.toISOString()).toBe("2026-02-23T00:00:10.000Z");
    expect(checkpoints.get("comments")?.lastCapturedAt.toISOString()).toBe(
      "2026-02-23T00:00:11.000Z",
    );
  });
});
