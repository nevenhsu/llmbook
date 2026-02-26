import { loadDispatcherPolicy } from "@/agents/task-dispatcher/policy/reply-only-policy";
import type { ReplayDataset, ReplayVariant } from "@/lib/ai/evaluation/contracts";
import { RuleBasedReplySafetyGate } from "@/lib/ai/safety/reply-safety-gate";

export const minimalReplayDataset: ReplayDataset = {
  contractVersion: "replay.v1",
  datasetVersion: "2026-02-26.minimal.v1",
  generatedAt: "2026-02-26T00:00:00.000Z",
  cases: [
    {
      id: "normal-execution",
      schemaVersion: "replay.v1",
      flow: "execution",
      taskType: "reply",
      personaId: "persona-1",
      threadId: "thread-1",
      boardId: "board-1",
      intent: {
        id: "intent-normal",
        sourceTable: "posts",
        sourceId: "post-1",
        payload: {
          postId: "post-1",
          threadId: "thread-1",
          boardId: "board-1",
        },
      },
      policyRefs: {
        policyVersion: "policy.v1",
        baselineRef: "baseline-policy",
        candidateRef: "candidate-policy",
      },
      memorySnapshot: {
        recentReplies: ["older contextual reply"],
      },
      expected: {
        decision: "SUCCEEDED",
        safety: { shouldBlock: false },
        reliability: { shouldSucceed: true },
      },
    },
    {
      id: "precheck-block",
      schemaVersion: "replay.v1",
      flow: "dispatch_precheck",
      taskType: "reply",
      personaId: "persona-1",
      threadId: "thread-2",
      boardId: "board-1",
      intent: {
        id: "intent-precheck-block",
        sourceTable: "comments",
        sourceId: "comment-1",
        payload: {
          postId: "post-2",
          threadId: "thread-2",
          boardId: "board-1",
        },
      },
      policyRefs: {
        policyVersion: "policy.v1",
        baselineRef: "baseline-policy",
        candidateRef: "candidate-policy",
      },
      memorySnapshot: {
        threadEntries: [
          {
            id: "m1",
            key: "recent",
            value: "same draft from memory",
            metadata: {},
            ttlSeconds: 7200,
            maxItems: 20,
            expiresAt: "2026-02-26T03:00:00.000Z",
            updatedAt: "2026-02-26T01:00:00.000Z",
          },
        ],
      },
      expected: {
        decision: "BLOCKED_PRECHECK",
        reasonCodes: ["PRECHECK_SAFETY_SIMILAR_TO_RECENT_REPLY"],
        safety: { shouldBlock: true },
      },
    },
    {
      id: "execution-safety-block",
      schemaVersion: "replay.v1",
      flow: "execution",
      taskType: "reply",
      personaId: "persona-1",
      threadId: "thread-3",
      boardId: "board-1",
      intent: {
        id: "intent-exec-safety",
        sourceTable: "posts",
        sourceId: "post-3",
        payload: {
          postId: "post-3",
          threadId: "thread-3",
          boardId: "board-1",
        },
      },
      policyRefs: {
        policyVersion: "policy.v1",
        baselineRef: "baseline-policy",
        candidateRef: "candidate-policy",
      },
      memorySnapshot: {
        recentReplies: [],
      },
      expected: {
        decision: "BLOCKED_SAFETY",
        reasonCodes: ["SAFETY_SPAM_PATTERN"],
        safety: { shouldBlock: true },
      },
    },
    {
      id: "memory-fallback-allow",
      schemaVersion: "replay.v1",
      flow: "dispatch_precheck",
      taskType: "reply",
      personaId: "persona-1",
      threadId: "thread-4",
      boardId: "board-1",
      intent: {
        id: "intent-memory-fallback",
        sourceTable: "comments",
        sourceId: "comment-2",
        payload: {
          postId: "post-4",
          threadId: "thread-4",
          boardId: "board-1",
        },
      },
      policyRefs: {
        policyVersion: "policy.v1",
        baselineRef: "baseline-policy",
        candidateRef: "candidate-policy",
      },
      memorySnapshot: {
        forceReadError: true,
      },
      expected: {
        decision: "ALLOWED",
        reasonCodes: ["MEMORY_READ_FAILED"],
        safety: { shouldBlock: false },
      },
    },
  ],
};

function buildTextByCaseId(caseId: string): string {
  if (caseId === "precheck-block") {
    return "same draft from memory";
  }
  if (caseId === "execution-safety-block") {
    return "zzzzzzzzzzzzzzzz";
  }
  if (caseId === "memory-fallback-allow") {
    return "Memory fallback still allows precheck to continue.";
  }
  return "Thanks for the useful context. Here is a concise follow-up.";
}

export function createBaselineReplayVariant(): ReplayVariant {
  const safetyGate = new RuleBasedReplySafetyGate();
  return {
    id: "baseline",
    version: "v1",
    describe: "Uses rule-based safety gate and current policy defaults.",
    resolvePolicy: () => ({
      ...loadDispatcherPolicy(),
      replyEnabled: true,
      precheckEnabled: true,
    }),
    generate: async ({ testCase }) => ({
      text: buildTextByCaseId(testCase.id),
      safetyContext: {
        recentPersonaReplies: testCase.memorySnapshot.recentReplies ?? [],
      },
    }),
    safetyCheck: async ({ text, context }) => safetyGate.check({ text, context }),
  };
}

export function createCandidateReplayVariant(): ReplayVariant {
  const baseline = createBaselineReplayVariant();
  return {
    ...baseline,
    id: "candidate",
    version: "v2-regression",
    describe: "Introduces a safety regression for labelled block cases.",
    safetyCheck: async ({ testCase, text, context }) => {
      if (testCase.id === "precheck-block" || testCase.id === "execution-safety-block") {
        return { allowed: true };
      }
      return new RuleBasedReplySafetyGate().check({ text, context });
    },
  };
}
