import { describe, it, expect } from "vitest";
import { dispatchNewIntents } from "@/agents/task-dispatcher/orchestrator/dispatch-new-intents";

describe("dispatchNewIntents", () => {
  it("marks intents as DISPATCHED when active persona exists", async () => {
    const markDispatchedCalls: Array<{ intentId: string; personaId: string; reasons: string[] }> =
      [];
    const markSkippedCalls: Array<{ intentId: string; reasons: string[] }> = [];
    const createdTasks: Array<{
      id: string;
      personaId: string;
      taskType: string;
      payload: Record<string, unknown>;
    }> = [];

    const repo = {
      async listNewIntents() {
        return [
          {
            id: "intent-1",
            type: "reply",
            sourceTable: "posts",
            sourceId: "post-1",
            createdAt: "2026-02-23T00:00:00.000Z",
            payload: { postId: "post-1" },
            status: "NEW" as const,
            decisionReasonCodes: [],
          },
        ];
      },
      async markDispatched(input: { intentId: string; personaId: string; reasons: string[] }) {
        markDispatchedCalls.push(input);
      },
      async markSkipped(input: { intentId: string; reasons: string[] }) {
        markSkippedCalls.push(input);
      },
    };

    const summary = await dispatchNewIntents({
      intentRepo: repo as any,
      policy: {
        replyEnabled: true,
        precheckEnabled: false,
        perPersonaHourlyReplyLimit: 8,
        perPostCooldownSeconds: 180,
        precheckSimilarityThreshold: 0.9,
      },
      listPersonas: async () => [{ id: "persona-1", status: "active" }],
      createTask: async (task) => {
        createdTasks.push(task as any);
      },
    });

    expect(summary).toEqual({ scanned: 1, dispatched: 1, skipped: 0 });
    expect(createdTasks).toHaveLength(1);
    expect(createdTasks[0]?.personaId).toBe("persona-1");
    expect(markDispatchedCalls).toHaveLength(1);
    expect(markSkippedCalls).toHaveLength(0);
  });

  it("marks intents as SKIPPED when no active persona", async () => {
    const markDispatchedCalls: Array<{ intentId: string; personaId: string; reasons: string[] }> =
      [];
    const markSkippedCalls: Array<{ intentId: string; reasons: string[] }> = [];

    const repo = {
      async listNewIntents() {
        return [
          {
            id: "intent-1",
            type: "reply",
            sourceTable: "posts",
            sourceId: "post-1",
            createdAt: "2026-02-23T00:00:00.000Z",
            payload: { postId: "post-1" },
            status: "NEW" as const,
            decisionReasonCodes: [],
          },
        ];
      },
      async markDispatched(input: { intentId: string; personaId: string; reasons: string[] }) {
        markDispatchedCalls.push(input);
      },
      async markSkipped(input: { intentId: string; reasons: string[] }) {
        markSkippedCalls.push(input);
      },
    };

    const summary = await dispatchNewIntents({
      intentRepo: repo as any,
      policy: {
        replyEnabled: true,
        precheckEnabled: false,
        perPersonaHourlyReplyLimit: 8,
        perPostCooldownSeconds: 180,
        precheckSimilarityThreshold: 0.9,
      },
      listPersonas: async () => [],
      createTask: async () => {
        throw new Error("createTask should not be called");
      },
    });

    expect(summary).toEqual({ scanned: 1, dispatched: 0, skipped: 1 });
    expect(markDispatchedCalls).toHaveLength(0);
    expect(markSkippedCalls).toHaveLength(1);
  });
});
