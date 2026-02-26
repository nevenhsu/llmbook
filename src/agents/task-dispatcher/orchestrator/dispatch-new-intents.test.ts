import { describe, it, expect } from "vitest";
import { dispatchNewIntents } from "@/agents/task-dispatcher/orchestrator/dispatch-new-intents";
import {
  CachedReplyPolicyProvider,
  type PolicyReleaseStore,
} from "@/lib/ai/policy/policy-control-plane";
import { PolicyControlPlaneReasonCode } from "@/lib/ai/reason-codes";

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

  it("applies hot-updated policy to new dispatches and falls back to last-known-good on failure", async () => {
    const now = { value: new Date("2026-02-26T00:00:00.000Z") };
    let fetchCount = 0;
    const store: PolicyReleaseStore = {
      async fetchLatestActive() {
        fetchCount += 1;
        if (fetchCount === 1) {
          return {
            version: 10,
            isActive: true,
            createdAt: "2026-02-26T00:00:00.000Z",
            policy: { global: { replyEnabled: false } },
          };
        }
        if (fetchCount === 2) {
          return {
            version: 11,
            isActive: true,
            createdAt: "2026-02-26T00:01:00.000Z",
            policy: { global: { replyEnabled: true } },
          };
        }
        throw new Error("db unavailable");
      },
    };

    const provider = new CachedReplyPolicyProvider({
      store,
      now: () => now.value,
      ttlMs: 10_000,
      fallbackPolicy: {
        replyEnabled: true,
        precheckEnabled: false,
        perPersonaHourlyReplyLimit: 8,
        perPostCooldownSeconds: 180,
        precheckSimilarityThreshold: 0.9,
      },
    });

    const dispatched: string[] = [];
    const skipped: string[] = [];
    let intentCursor = 0;
    const repo = {
      async listNewIntents() {
        intentCursor += 1;
        return [
          {
            id: `intent-${intentCursor}`,
            type: "reply",
            sourceTable: "posts",
            sourceId: `post-${intentCursor}`,
            createdAt: "2026-02-23T00:00:00.000Z",
            payload: { postId: `post-${intentCursor}` },
            status: "NEW" as const,
            decisionReasonCodes: [],
          },
        ];
      },
      async markDispatched(input: { intentId: string }) {
        dispatched.push(input.intentId);
      },
      async markSkipped(input: { intentId: string }) {
        skipped.push(input.intentId);
      },
    };

    const runOnce = async () =>
      dispatchNewIntents({
        intentRepo: repo as any,
        policyProvider: provider,
        listPersonas: async () => [{ id: "persona-1", status: "active" }],
        precheck: allowPrecheck as any,
        createTask: async () => {},
      });

    const first = await runOnce();
    now.value = new Date("2026-02-26T00:00:11.000Z");
    const second = await runOnce();
    now.value = new Date("2026-02-26T00:00:22.000Z");
    const third = await runOnce();

    expect(first).toEqual({ scanned: 1, dispatched: 0, skipped: 1 });
    expect(second).toEqual({ scanned: 1, dispatched: 1, skipped: 0 });
    expect(third).toEqual({ scanned: 1, dispatched: 1, skipped: 0 });
    expect(skipped).toEqual(["intent-1"]);
    expect(dispatched).toEqual(["intent-2", "intent-3"]);
    expect(provider.getStatus().lastFallbackReasonCode).toBe(
      PolicyControlPlaneReasonCode.fallbackLastKnownGood,
    );
  });
});
