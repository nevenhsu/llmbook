import { describe, it, expect } from "vitest";
import { dispatchNewIntents } from "@/agents/task-dispatcher/orchestrator/dispatch-new-intents";

const allowPrecheck = async () => ({ allowed: true, reasons: [] as string[] });

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
      precheck: allowPrecheck as any,
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
      precheck: allowPrecheck as any,
      createTask: async () => {
        throw new Error("createTask should not be called");
      },
    });

    expect(summary).toEqual({ scanned: 1, dispatched: 0, skipped: 1 });
    expect(markDispatchedCalls).toHaveLength(0);
    expect(markSkippedCalls).toHaveLength(1);
  });

  it("persists task + intent decision through atomic callback when provided", async () => {
    const persisted: Array<"DISPATCHED" | "SKIPPED"> = [];
    const createdTasks: Array<{ id: string; personaId: string }> = [];

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
      async markDispatched() {
        throw new Error("markDispatched should not be called when atomic callback is provided");
      },
      async markSkipped() {
        throw new Error("markSkipped should not be called when atomic callback is provided");
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
      precheck: allowPrecheck as any,
      createTask: async (task) => {
        createdTasks.push({ id: task.id, personaId: task.personaId });
      },
      persistDecisionAtomic: async ({ decision, task }) => {
        expect(decision.dispatched).toBe(true);
        expect(task?.personaId).toBe("persona-1");
        persisted.push("DISPATCHED");
        return "DISPATCHED";
      },
    });

    expect(summary).toEqual({ scanned: 1, dispatched: 1, skipped: 0 });
    expect(createdTasks).toHaveLength(1);
    expect(persisted).toEqual(["DISPATCHED"]);
  });

  it("loads policy from policyProvider when policy is not explicitly provided", async () => {
    const markSkippedCalls: Array<{ intentId: string; reasons: string[] }> = [];
    const policyProvider = {
      getReplyPolicy: async () => ({
        replyEnabled: false,
        precheckEnabled: false,
        perPersonaHourlyReplyLimit: 8,
        perPostCooldownSeconds: 180,
        precheckSimilarityThreshold: 0.9,
      }),
    };

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
      async markDispatched() {
        throw new Error("markDispatched should not be called");
      },
      async markSkipped(input: { intentId: string; reasons: string[] }) {
        markSkippedCalls.push(input);
      },
    };

    const summary = await dispatchNewIntents({
      intentRepo: repo as any,
      policyProvider: policyProvider as any,
      listPersonas: async () => [{ id: "persona-1", status: "active" }],
      precheck: allowPrecheck as any,
      createTask: async () => {
        throw new Error("createTask should not be called");
      },
    });

    expect(summary).toEqual({ scanned: 1, dispatched: 0, skipped: 1 });
    expect(markSkippedCalls).toHaveLength(1);
    expect(markSkippedCalls[0]?.reasons).toContain("POLICY_DISABLED");
  });
});
