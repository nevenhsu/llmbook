import { describe, expect, it } from "vitest";
import { generateReplyTextWithPromptRuntime } from "@/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime";
import { MockModelAdapter, type ModelAdapter } from "@/lib/ai/prompt-runtime/model-adapter";
import type { RuntimeSoulContext } from "@/lib/ai/soul/runtime-soul-profile";
import type { RuntimeMemoryContext } from "@/lib/ai/memory/runtime-memory-context";
import { DEFAULT_DISPATCHER_POLICY } from "@/agents/task-dispatcher/policy/reply-only-policy";

function sampleSoul(): RuntimeSoulContext {
  return {
    profile: {
      identityCore: {
        archetype: "A pragmatic operator",
        mbti: "INTJ",
        coreMotivation: "help people make practical decisions",
      },
      valueHierarchy: [{ value: "clarity", priority: 1 }],
      reasoningLens: {
        primary: ["risk", "clarity"],
        secondary: ["feasibility"],
        promptHint: "Assess the safest practical option first.",
      },
      responseStyle: {
        tone: ["direct", "conversational"],
        patterns: ["short_paragraphs"],
        avoid: ["tutorial_lists"],
      },
      relationshipTendencies: {
        defaultStance: "supportive_but_blunt",
        trustSignals: ["specificity"],
        frictionTriggers: ["hype"],
      },
      agentEnactmentRules: [
        "Form a genuine reaction before writing.",
        "Do not sound like a generic assistant.",
      ],
      inCharacterExamples: [
        {
          scenario: "Someone asks which option is safer.",
          response: "My first reaction is option B. It carries less hidden downside.",
        },
      ],
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
      mbti: "INTJ",
      topValues: ["clarity"],
      tradeoffStyle: "balanced",
      riskPreference: "balanced",
      collaborationStance: "support",
      rhythm: "direct",
      defaultRelationshipStance: "supportive_but_blunt",
      promptHint: "Assess the safest practical option first.",
      enactmentRuleCount: 2,
      exampleCount: 1,
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
    agentProfile: {
      displayName: "AI Planner",
      username: "ai_planner",
      bio: "Practical and blunt.",
    },
    postId: "post-1",
    title: "Roadmap",
    postBodySnippet: "Need a practical next step.",
    focusActor: "user:abcd1234",
    focusSnippet: "which option is safer?",
    participantCount: 3,
    soul: sampleSoul(),
    memoryContext: sampleMemory(),
    boardContext: {
      name: "Illustration Critique",
      description: "Share work and get concrete feedback",
      rules: [{ title: "Be specific", description: "Offer actionable critique" }],
    },
    policy: DEFAULT_DISPATCHER_POLICY,
    modelAdapter,
  });
}

describe("generateReplyTextWithPromptRuntime", () => {
  it("uses model output when model returns plain markdown text", async () => {
    const result = await runWithAdapter(
      new MockModelAdapter({ mode: "success", fixedText: "llm text" }),
    );
    expect(result.usedFallback).toBe(false);
    expect(result.text).toBe("llm text");
    expect(result.imageRequest).toEqual({
      needImage: false,
      imagePrompt: null,
      imageAlt: null,
    });
  });

  it("parses structured image request from model output", async () => {
    const result = await runWithAdapter(
      new MockModelAdapter({
        mode: "success",
        fixedText: JSON.stringify({
          markdown: "A concise reply.",
          need_image: true,
          image_prompt: "Editorial illustration of a roadmap with signposts.",
          image_alt: "Roadmap signposts illustration",
        }),
      }),
    );

    expect(result.usedFallback).toBe(false);
    expect(result.text).toBe("A concise reply.");
    expect(result.imageRequest).toEqual({
      needImage: true,
      imagePrompt: "Editorial illustration of a roadmap with signposts.",
      imageAlt: "Roadmap signposts illustration",
    });
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

  it("uses comment JSON envelope contract and populated target_context when focus target exists", async () => {
    const result = await runWithAdapter(new MockModelAdapter({ mode: "success", fixedText: "ok" }));
    const blockNames = result.promptBlocks.map((block) => block.name);
    const outputConstraints =
      result.promptBlocks.find((block) => block.name === "output_constraints")?.content ?? "";
    const targetContext =
      result.promptBlocks.find((block) => block.name === "target_context")?.content ?? "";
    const profileBlock =
      result.promptBlocks.find((block) => block.name === "agent_profile")?.content ?? "";
    const relationshipBlock =
      result.promptBlocks.find((block) => block.name === "agent_relationship_context")?.content ??
      "";
    const voiceContractBlock =
      result.promptBlocks.find((block) => block.name === "agent_voice_contract")?.content ?? "";
    const enactmentBlock =
      result.promptBlocks.find((block) => block.name === "agent_enactment_rules")?.content ?? "";
    const antiStyleBlock =
      result.promptBlocks.find((block) => block.name === "agent_anti_style_rules")?.content ?? "";
    const examplesBlock =
      result.promptBlocks.find((block) => block.name === "agent_examples")?.content ?? "";

    expect(blockNames).toContain("target_context");
    expect(blockNames).toContain("agent_profile");
    expect(blockNames).toContain("agent_relationship_context");
    expect(blockNames).toContain("agent_voice_contract");
    expect(blockNames).toContain("agent_enactment_rules");
    expect(blockNames).toContain("agent_anti_style_rules");
    expect(blockNames).toContain("agent_examples");
    expect(outputConstraints).toContain("Return exactly one JSON object.");
    expect(outputConstraints).toContain("markdown: string");
    expect(outputConstraints).toContain("need_image");
    expect(outputConstraints).toContain("image_prompt");
    expect(outputConstraints).toContain("image_alt");
    expect(outputConstraints).toContain("Do not output any text outside the JSON object.");
    expect(targetContext).toContain("target_type: comment");
    expect(targetContext).toContain("target_author: user:abcd1234");
    expect(targetContext).toContain("target_content: which option is safer?");
    expect(profileBlock).toContain("display_name: AI Planner");
    expect(relationshipBlock).toContain("target_author: user:abcd1234");
    expect(voiceContractBlock).toContain("Respond in a way that is recognizably this persona");
    expect(enactmentBlock).toContain("Form a genuine reaction before writing.");
    expect(antiStyleBlock).toContain("Do not sound like a generic assistant");
    expect(examplesBlock).toContain(
      "Scenario: Someone leans on hype instead of backing up the claim.",
    );
  });

  it("repairs workshop-style comment output back toward the persona voice", async () => {
    const result = await runWithAdapter(
      new MockModelAdapter({
        scriptedOutputs: [
          {
            text: JSON.stringify({
              markdown: "What works:\n- strong silhouette\n- clear contrast\n- scale",
              need_image: false,
              image_prompt: null,
              image_alt: null,
            }),
            finishReason: "stop",
          },
          {
            text: JSON.stringify({
              markdown:
                "That silhouette lands. Keep the contrast sharp and stop softening the point just to sound polite.",
              need_image: false,
              image_prompt: null,
              image_alt: null,
            }),
            finishReason: "stop",
          },
        ],
      }),
    );

    expect(result.usedFallback).toBe(false);
    expect(result.text).toContain("That silhouette lands.");
  });

  it("keeps target_context block with explicit empty fallback when no focus target exists", async () => {
    const result = await generateReplyTextWithPromptRuntime({
      entityId: "task-2",
      personaId: "persona-1",
      postId: "post-1",
      title: "Roadmap",
      postBodySnippet: "Need a practical next step.",
      focusActor: "user:abcd1234",
      focusSnippet: null,
      participantCount: 3,
      soul: sampleSoul(),
      memoryContext: sampleMemory(),
      boardContext: null,
      policy: DEFAULT_DISPATCHER_POLICY,
      modelAdapter: new MockModelAdapter({ mode: "success", fixedText: "ok" }),
    });

    const targetContext = result.promptBlocks.find((block) => block.name === "target_context");

    expect(targetContext).toBeDefined();
    expect(targetContext?.degraded).toBe(true);
    expect(targetContext?.content).toContain("No target context available.");
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
