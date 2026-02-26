import { describe, expect, it } from "vitest";
import { generateReplyTextWithPromptRuntime } from "@/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime";
import { MockModelAdapter, type ModelAdapter } from "@/lib/ai/prompt-runtime/model-adapter";
import type { RuntimeSoulContext } from "@/lib/ai/soul/runtime-soul-profile";
import type { RuntimeMemoryContext } from "@/lib/ai/memory/runtime-memory-context";
import { DEFAULT_DISPATCHER_POLICY } from "@/agents/task-dispatcher/policy/reply-only-policy";

function sampleSoul(): RuntimeSoulContext {
  return {
    profile: {
      identityCore: "A pragmatic operator",
      valueHierarchy: [{ value: "clarity", priority: 1 }],
      decisionPolicy: {
        evidenceStandard: "high",
        tradeoffStyle: "balanced",
        uncertaintyHandling: "state assumptions",
        antiPatterns: ["overclaim"],
        riskPreference: "balanced",
      },
      interactionDoctrine: {
        askVsTellRatio: "balanced",
        feedbackPrinciples: ["tradeoff"],
        collaborationStance: "support",
      },
      languageSignature: {
        rhythm: "direct",
        preferredStructures: ["context"],
        lexicalTaboos: [],
      },
      guardrails: {
        hardNo: ["unsafe"],
        deescalationRules: ["de-risk"],
      },
    },
    summary: {
      identity: "A pragmatic operator",
      topValues: ["clarity"],
      tradeoffStyle: "balanced",
      riskPreference: "balanced",
      collaborationStance: "support",
      rhythm: "direct",
      guardrailCount: 2,
    },
    normalized: false,
    source: "db",
  };
}

function sampleMemory(): RuntimeMemoryContext {
  return {
    policyRefs: { policyVersion: 1 },
    memoryRefs: { communityMemoryVersion: "c1", safetyMemoryVersion: "s1" },
    personaLongMemory: {
      id: "long-1",
      content: "prefers concise discussion",
      updatedAt: "2026-02-26T00:00:00.000Z",
    },
    threadShortMemory: {
      threadId: "thread-1",
      boardId: "board-1",
      taskType: "reply",
      ttlSeconds: 3600,
      maxItems: 10,
      entries: [
        {
          id: "m-1",
          key: "recent",
          value: "we already compared options",
          metadata: {},
          ttlSeconds: 3600,
          maxItems: 10,
          expiresAt: "2026-02-26T01:00:00.000Z",
          updatedAt: "2026-02-26T00:00:00.000Z",
        },
      ],
    },
  };
}

async function runWithAdapter(modelAdapter: ModelAdapter) {
  return generateReplyTextWithPromptRuntime({
    entityId: "task-1",
    personaId: "persona-1",
    postId: "post-1",
    title: "Roadmap",
    postBodySnippet: "Need a practical next step.",
    focusActor: "user:abcd1234",
    focusSnippet: "which option is safer?",
    participantCount: 3,
    soul: sampleSoul(),
    memoryContext: sampleMemory(),
    policy: DEFAULT_DISPATCHER_POLICY,
    modelAdapter,
  });
}

describe("generateReplyTextWithPromptRuntime", () => {
  it("uses model output when model returns text", async () => {
    const result = await runWithAdapter(
      new MockModelAdapter({ mode: "success", fixedText: "llm text" }),
    );
    expect(result.usedFallback).toBe(false);
    expect(result.text).toBe("llm text");
  });

  it("falls back when model returns empty output", async () => {
    const result = await runWithAdapter(new MockModelAdapter({ mode: "empty" }));
    expect(result.usedFallback).toBe(true);
    expect(result.text).toBe("");
  });

  it("falls back when adapter throws", async () => {
    const throwingAdapter: ModelAdapter = {
      generateText: async () => {
        throw new Error("model failed");
      },
    };
    const result = await runWithAdapter(throwingAdapter);
    expect(result.usedFallback).toBe(true);
    expect(result.text).toBe("");
  });

  it("includes policy/soul/memory blocks in built prompt structure", async () => {
    const result = await runWithAdapter(new MockModelAdapter({ mode: "success", fixedText: "ok" }));
    const blockNames = result.promptBlocks.map((block) => block.name);
    expect(blockNames).toContain("policy");
    expect(blockNames).toContain("soul");
    expect(blockNames).toContain("memory");
    expect(result.promptBlocks.find((block) => block.name === "policy")?.content).toContain(
      "replyEnabled",
    );
    expect(result.promptBlocks.find((block) => block.name === "soul")?.content).toContain(
      "Identity:",
    );
    expect(result.promptBlocks.find((block) => block.name === "memory")?.content).toContain(
      "Memory refs",
    );
  });

  it("keeps main flow with empty fallback when tool loop hits max iterations", async () => {
    const previousEnabled = process.env.AI_TOOL_RUNTIME_ENABLED;
    const previousTimeout = process.env.AI_TOOL_LOOP_TIMEOUT_MS;
    const previousMaxIterations = process.env.AI_TOOL_LOOP_MAX_ITERATIONS;
    process.env.AI_TOOL_RUNTIME_ENABLED = "true";
    process.env.AI_TOOL_LOOP_TIMEOUT_MS = "2000";
    process.env.AI_TOOL_LOOP_MAX_ITERATIONS = "1";

    const toolLoopAdapter = new MockModelAdapter({
      scriptedOutputs: [
        {
          text: "",
          finishReason: "tool-calls",
          toolCalls: [{ name: "create_reply", arguments: {} }],
        },
      ],
    });

    try {
      const result = await runWithAdapter(toolLoopAdapter);
      expect(result.usedFallback).toBe(true);
      expect(result.text).toBe("");
    } finally {
      process.env.AI_TOOL_RUNTIME_ENABLED = previousEnabled;
      process.env.AI_TOOL_LOOP_TIMEOUT_MS = previousTimeout;
      process.env.AI_TOOL_LOOP_MAX_ITERATIONS = previousMaxIterations;
    }
  });
});
