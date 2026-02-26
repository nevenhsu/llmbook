import { describe, expect, it } from "vitest";
import { createReplyDispatchPrecheck } from "@/agents/task-dispatcher/precheck/reply-dispatch-precheck";
import { SafetyReasonCode } from "@/lib/ai/reason-codes";

function buildPolicy() {
  return {
    replyEnabled: true,
    precheckEnabled: true,
    perPersonaHourlyReplyLimit: 99,
    perPostCooldownSeconds: 0,
    precheckSimilarityThreshold: 0.9,
  };
}

describe("createReplyDispatchPrecheck", () => {
  it("blocks when generated content is similar to recent replies", async () => {
    const precheck = createReplyDispatchPrecheck({
      policy: buildPolicy(),
      deps: {
        checkEligibility: async () => ({ allowed: true }),
        countRecentReplies: async () => 0,
        getLatestReplyAtOnPost: async () => null,
        buildRuntimeMemoryContext: async () => ({
          globalPolicyRefs: {
            policyVersion: null,
            communityMemoryVersion: null,
            safetyMemoryVersion: null,
          },
          personaLongMemory: null,
          threadShortMemory: {
            threadId: null,
            boardId: null,
            taskType: "reply",
            ttlSeconds: 0,
            maxItems: 0,
            entries: [],
          },
        }),
        generateDraft: async () => ({
          text: "same text",
          safetyContext: { recentPersonaReplies: ["same text"] },
        }),
        runSafetyCheck: async () => ({
          allowed: false,
          reasonCode: SafetyReasonCode.similarToRecentReply,
        }),
        recordSafetyEvent: async () => {},
      },
    });

    const result = await precheck({
      now: new Date("2026-02-24T00:00:00.000Z"),
      persona: { id: "persona-a", status: "active" },
      intent: {
        id: "intent-1",
        type: "reply",
        sourceTable: "posts",
        sourceId: "post-1",
        createdAt: "2026-02-24T00:00:00.000Z",
        payload: { postId: "post-1" },
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("PRECHECK_SAFETY_SIMILAR_TO_RECENT_REPLY");
  });

  it("allows slightly rewritten content", async () => {
    const precheck = createReplyDispatchPrecheck({
      policy: buildPolicy(),
      deps: {
        checkEligibility: async () => ({ allowed: true }),
        countRecentReplies: async () => 0,
        getLatestReplyAtOnPost: async () => null,
        buildRuntimeMemoryContext: async () => ({
          globalPolicyRefs: {
            policyVersion: null,
            communityMemoryVersion: null,
            safetyMemoryVersion: null,
          },
          personaLongMemory: null,
          threadShortMemory: {
            threadId: null,
            boardId: null,
            taskType: "reply",
            ttlSeconds: 0,
            maxItems: 0,
            entries: [],
          },
        }),
        generateDraft: async () => ({
          text: "new wording with extra details",
          safetyContext: { recentPersonaReplies: ["old wording baseline"] },
        }),
        runSafetyCheck: async () => ({
          allowed: true,
        }),
        recordSafetyEvent: async () => {},
      },
    });

    const result = await precheck({
      now: new Date("2026-02-24T00:00:00.000Z"),
      persona: { id: "persona-a", status: "active" },
      intent: {
        id: "intent-2",
        type: "reply",
        sourceTable: "posts",
        sourceId: "post-2",
        createdAt: "2026-02-24T00:00:00.000Z",
        payload: { postId: "post-2" },
      },
    });

    expect(result.allowed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("does not apply same-post cooldown across different posts", async () => {
    const precheck = createReplyDispatchPrecheck({
      policy: { ...buildPolicy(), perPostCooldownSeconds: 300 },
      deps: {
        checkEligibility: async () => ({ allowed: true }),
        countRecentReplies: async () => 0,
        getLatestReplyAtOnPost: async () => null,
        buildRuntimeMemoryContext: async () => ({
          globalPolicyRefs: {
            policyVersion: null,
            communityMemoryVersion: null,
            safetyMemoryVersion: null,
          },
          personaLongMemory: null,
          threadShortMemory: {
            threadId: null,
            boardId: null,
            taskType: "reply",
            ttlSeconds: 0,
            maxItems: 0,
            entries: [],
          },
        }),
        generateDraft: async () => ({
          text: "candidate",
          safetyContext: { recentPersonaReplies: [] },
        }),
        runSafetyCheck: async () => ({ allowed: true }),
        recordSafetyEvent: async () => {},
      },
    });

    const result = await precheck({
      now: new Date("2026-02-24T00:00:00.000Z"),
      persona: { id: "persona-a", status: "active" },
      intent: {
        id: "intent-3",
        type: "reply",
        sourceTable: "posts",
        sourceId: "post-B",
        createdAt: "2026-02-24T00:00:00.000Z",
        payload: { postId: "post-B" },
      },
    });

    expect(result.allowed).toBe(true);
  });

  it("applies hourly limit per persona independently", async () => {
    const precheck = createReplyDispatchPrecheck({
      policy: { ...buildPolicy(), perPersonaHourlyReplyLimit: 1 },
      deps: {
        checkEligibility: async () => ({ allowed: true }),
        countRecentReplies: async ({ personaId }) => (personaId === "persona-a" ? 1 : 0),
        getLatestReplyAtOnPost: async () => null,
        buildRuntimeMemoryContext: async () => ({
          globalPolicyRefs: {
            policyVersion: null,
            communityMemoryVersion: null,
            safetyMemoryVersion: null,
          },
          personaLongMemory: null,
          threadShortMemory: {
            threadId: null,
            boardId: null,
            taskType: "reply",
            ttlSeconds: 0,
            maxItems: 0,
            entries: [],
          },
        }),
        generateDraft: async () => ({
          text: "candidate",
          safetyContext: { recentPersonaReplies: [] },
        }),
        runSafetyCheck: async () => ({ allowed: true }),
        recordSafetyEvent: async () => {},
      },
    });

    const blocked = await precheck({
      now: new Date("2026-02-24T00:00:00.000Z"),
      persona: { id: "persona-a", status: "active" },
      intent: {
        id: "intent-4",
        type: "reply",
        sourceTable: "posts",
        sourceId: "post-1",
        createdAt: "2026-02-24T00:00:00.000Z",
        payload: { postId: "post-1" },
      },
    });

    const allowed = await precheck({
      now: new Date("2026-02-24T00:00:00.000Z"),
      persona: { id: "persona-b", status: "active" },
      intent: {
        id: "intent-5",
        type: "reply",
        sourceTable: "posts",
        sourceId: "post-1",
        createdAt: "2026-02-24T00:00:00.000Z",
        payload: { postId: "post-1" },
      },
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons).toContain("RATE_LIMIT_HOURLY");
    expect(allowed.allowed).toBe(true);
  });

  it("blocks when target post is not interactable", async () => {
    const precheck = createReplyDispatchPrecheck({
      policy: { ...buildPolicy(), precheckEnabled: false },
      deps: {
        checkEligibility: async () => ({
          allowed: false,
          reasonCode: "TARGET_POST_NOT_INTERACTABLE",
        }),
        countRecentReplies: async () => 0,
        getLatestReplyAtOnPost: async () => null,
        buildRuntimeMemoryContext: async () => ({
          globalPolicyRefs: {
            policyVersion: null,
            communityMemoryVersion: null,
            safetyMemoryVersion: null,
          },
          personaLongMemory: null,
          threadShortMemory: {
            threadId: null,
            boardId: null,
            taskType: "reply",
            ttlSeconds: 0,
            maxItems: 0,
            entries: [],
          },
        }),
        generateDraft: async () => ({ text: "n/a" }),
        runSafetyCheck: async () => ({ allowed: true }),
        recordSafetyEvent: async () => {},
      },
    });

    const result = await precheck({
      now: new Date("2026-02-24T00:00:00.000Z"),
      persona: { id: "persona-a", status: "active" },
      intent: {
        id: "intent-6",
        type: "reply",
        sourceTable: "posts",
        sourceId: "post-archived",
        createdAt: "2026-02-24T00:00:00.000Z",
        payload: { postId: "post-archived" },
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("TARGET_POST_NOT_INTERACTABLE");
  });

  it("blocks when persona is not active even if precheck is disabled", async () => {
    const precheck = createReplyDispatchPrecheck({
      policy: { ...buildPolicy(), precheckEnabled: false },
      deps: {
        checkEligibility: async () => ({
          allowed: false,
          reasonCode: "PERSONA_NOT_ACTIVE",
        }),
        countRecentReplies: async () => 0,
        getLatestReplyAtOnPost: async () => null,
        buildRuntimeMemoryContext: async () => ({
          globalPolicyRefs: {
            policyVersion: null,
            communityMemoryVersion: null,
            safetyMemoryVersion: null,
          },
          personaLongMemory: null,
          threadShortMemory: {
            threadId: null,
            boardId: null,
            taskType: "reply",
            ttlSeconds: 0,
            maxItems: 0,
            entries: [],
          },
        }),
        generateDraft: async () => ({ text: "n/a" }),
        runSafetyCheck: async () => ({ allowed: true }),
        recordSafetyEvent: async () => {},
      },
    });

    const result = await precheck({
      now: new Date("2026-02-24T00:00:00.000Z"),
      persona: { id: "persona-a", status: "active" },
      intent: {
        id: "intent-7",
        type: "reply",
        sourceTable: "posts",
        sourceId: "post-1",
        createdAt: "2026-02-24T00:00:00.000Z",
        payload: { postId: "post-1" },
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("PERSONA_NOT_ACTIVE");
  });

  it("falls back when memory read fails and remains dispatchable", async () => {
    const memoryFallbackCalls: Array<{ reasonCode: string; metadata?: Record<string, unknown> }> =
      [];

    const precheck = createReplyDispatchPrecheck({
      policy: buildPolicy(),
      deps: {
        checkEligibility: async () => ({ allowed: true }),
        countRecentReplies: async () => 0,
        getLatestReplyAtOnPost: async () => null,
        buildRuntimeMemoryContext: async () => {
          throw new Error("memory read failed");
        },
        generateDraft: async () => ({
          text: "candidate",
          safetyContext: { recentPersonaReplies: [] },
        }),
        runSafetyCheck: async () => ({ allowed: true }),
        recordSafetyEvent: async () => {},
        recordMemoryFallback: async (input) => {
          memoryFallbackCalls.push({ reasonCode: input.reasonCode, metadata: input.metadata });
        },
      },
    });

    const result = await precheck({
      now: new Date("2026-02-24T00:00:00.000Z"),
      persona: { id: "persona-a", status: "active" },
      intent: {
        id: "intent-8",
        type: "reply",
        sourceTable: "posts",
        sourceId: "post-2",
        createdAt: "2026-02-24T00:00:00.000Z",
        payload: { postId: "post-2", threadId: "thread-2" },
      },
    });

    expect(result.allowed).toBe(true);
    expect(memoryFallbackCalls).toHaveLength(1);
    expect(memoryFallbackCalls[0]?.reasonCode).toBe("MEMORY_READ_FAILED");
  });
});
