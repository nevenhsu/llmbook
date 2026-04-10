import { describe, expect, it } from "vitest";
import { generateReplyTextWithPromptRuntime } from "@/agents/reply-worker/reply-prompt-runtime";
import {
  MockModelAdapter,
  type ModelAdapter,
  type ModelGenerateTextInput,
  type ModelGenerateTextOutput,
} from "@/lib/ai/prompt-runtime/model-adapter";
import type { RuntimeCoreContext } from "@/lib/ai/core/runtime-core-profile";
import type { RuntimeMemoryContext } from "@/lib/ai/memory/runtime-memory-context";
import { DEFAULT_REPLY_WORKER_POLICY } from "@/agents/reply-worker/reply-worker-policy";
import { PersonaOutputValidationError } from "@/lib/ai/prompt-runtime/persona-output-audit";
import { ExecutionSkipReasonCode } from "@/lib/ai/reason-codes";

function sampleSoul(): RuntimeCoreContext {
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
      voiceFingerprint: {
        openingMove: "Lead with the concrete risk first.",
        metaphorDomains: ["trade-off", "pressure point", "failure mode"],
        attackStyle: "direct and evidence-oriented",
        praiseStyle: "specific praise only after proof",
        closingMove: "Close with a concrete takeaway.",
        forbiddenShapes: ["support macro", "balanced explainer"],
      },
      taskStyleMatrix: {
        post: {
          entryShape: "Plant the angle early.",
          bodyShape: "Build a clear argument instead of a tutorial.",
          closeShape: "Land on a concrete takeaway.",
          forbiddenShapes: ["newsletter tone", "advice list"],
        },
        comment: {
          entryShape: "Sound like a live thread reply.",
          feedbackShape: "reaction -> concrete note -> pointed close",
          closeShape: "Keep the close short and thread-native.",
          forbiddenShapes: ["sectioned critique", "support-macro tone"],
        },
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
    policy: DEFAULT_REPLY_WORKER_POLICY,
    modelAdapter,
  });
}

describe("generateReplyTextWithPromptRuntime", () => {
  it("uses model output when model returns plain markdown text", async () => {
    const result = await runWithAdapter(
      new MockModelAdapter({
        scriptedOutputs: [
          { text: "llm text", finishReason: "stop" },
          {
            text: JSON.stringify({
              passes: true,
              issues: [],
              repairGuidance: [],
              severity: "low",
              confidence: 0.94,
              missingSignals: [],
            }),
            finishReason: "stop",
          },
        ],
      }),
    );
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
        scriptedOutputs: [
          {
            text: JSON.stringify({
              markdown: "A concise reply.",
              need_image: true,
              image_prompt: "Editorial illustration of a roadmap with signposts.",
              image_alt: "Roadmap signposts illustration",
            }),
            finishReason: "stop",
          },
          {
            text: JSON.stringify({
              passes: true,
              issues: [],
              repairGuidance: [],
              severity: "low",
              confidence: 0.94,
              missingSignals: [],
            }),
            finishReason: "stop",
          },
        ],
      }),
    );

    expect(result.text).toBe("A concise reply.");
    expect(result.imageRequest).toEqual({
      needImage: true,
      imagePrompt: "Editorial illustration of a roadmap with signposts.",
      imageAlt: "Roadmap signposts illustration",
    });
  });

  it("throws when model returns empty output", async () => {
    await expect(runWithAdapter(new MockModelAdapter({ mode: "empty" }))).rejects.toThrow(
      "EMPTY_MODEL_OUTPUT",
    );
  });

  it("throws when adapter throws", async () => {
    const previousEnabled = process.env.AI_TOOL_RUNTIME_ENABLED;
    process.env.AI_TOOL_RUNTIME_ENABLED = "false";
    const throwingAdapter: ModelAdapter = {
      generateText: async () => {
        throw new Error("model failed");
      },
    };
    try {
      await expect(runWithAdapter(throwingAdapter)).rejects.toThrow("model failed");
    } finally {
      process.env.AI_TOOL_RUNTIME_ENABLED = previousEnabled;
    }
  });

  it("uses comment JSON envelope contract and populated target_context when focus target exists", async () => {
    const result = await runWithAdapter(
      new MockModelAdapter({
        scriptedOutputs: [
          { text: "ok", finishReason: "stop" },
          {
            text: JSON.stringify({
              passes: true,
              issues: [],
              repairGuidance: [],
              severity: "low",
              confidence: 0.94,
              missingSignals: [],
            }),
            finishReason: "stop",
          },
        ],
      }),
    );
    const blockNames = result.promptBlocks.map((block) => block.name);
    const outputConstraints =
      result.promptBlocks.find((block) => block.name === "output_constraints")?.content ?? "";
    const targetContext =
      result.promptBlocks.find((block) => block.name === "target_context")?.content ?? "";
    const profileBlock =
      result.promptBlocks.find((block) => block.name === "agent_profile")?.content ?? "";
    const coreBlock =
      result.promptBlocks.find((block) => block.name === "agent_core")?.content ?? "";
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
    expect(blockNames).not.toContain("agent_relationship_context");
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
    expect(coreBlock).toContain("Compact persona summary for reply generation:");
    expect(coreBlock).toContain("Voice fingerprint:");
    expect(coreBlock).toContain("Comment shape expectations:");
    expect(coreBlock).not.toContain("Memory anchors:");
    expect(coreBlock).not.toContain("MBTI:");
    expect(voiceContractBlock).toContain("Respond in a way that is recognizably this persona");
    expect(enactmentBlock).toContain("Form a genuine reaction before writing.");
    expect(antiStyleBlock).toContain("Do not sound like a generic assistant");
    expect(examplesBlock).toContain("Scenario: Someone leans on");
    expect(examplesBlock).toContain("Show the concrete move, the proof, or the consequence.");
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
              passes: false,
              issues: ["too editorial"],
              repairGuidance: ["Lead with the persona's immediate reaction before explaining."],
              severity: "medium",
              confidence: 0.87,
              missingSignals: ["immediate reaction"],
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
          {
            text: JSON.stringify({
              passes: true,
              issues: [],
              repairGuidance: [],
              severity: "low",
              confidence: 0.9,
              missingSignals: [],
            }),
            finishReason: "stop",
          },
        ],
      }),
    );

    expect(result.text).toContain("That silhouette lands.");
  });

  it("retries reply persona audit in compact mode with shared comment budgets when the first audit returns empty output", async () => {
    const previousEnabled = process.env.AI_TOOL_RUNTIME_ENABLED;
    process.env.AI_TOOL_RUNTIME_ENABLED = "false";
    const calls: ModelGenerateTextInput[] = [];
    const outputs: ModelGenerateTextOutput[] = [
      {
        text: JSON.stringify({
          markdown: "A direct reply.",
          need_image: false,
          image_prompt: null,
          image_alt: null,
        }),
        finishReason: "stop",
      },
      {
        text: "",
        finishReason: "length",
      },
      {
        text: JSON.stringify({
          passes: true,
          issues: [],
          repairGuidance: [],
          severity: "low",
          confidence: 0.9,
          missingSignals: [],
        }),
        finishReason: "stop",
      },
    ];
    const adapter: ModelAdapter = {
      generateText: async (input) => {
        calls.push(input);
        const next = outputs.shift();
        if (!next) {
          throw new Error("unexpected call");
        }
        return next;
      },
    };

    try {
      const result = await runWithAdapter(adapter);

      expect(result.text).toBe("A direct reply.");
      expect(calls[0]?.maxOutputTokens).toBe(900);
      expect(calls[1]?.maxOutputTokens).toBe(900);
      expect(calls[2]?.maxOutputTokens).toBe(1200);
      expect(calls[2]?.prompt).toContain("[audit_mode]");
      expect(calls[2]?.prompt).toContain("compact");
    } finally {
      process.env.AI_TOOL_RUNTIME_ENABLED = previousEnabled;
    }
  });

  it("retries reply persona audit in compact mode when the first audit returns truncated JSON", async () => {
    const previousEnabled = process.env.AI_TOOL_RUNTIME_ENABLED;
    process.env.AI_TOOL_RUNTIME_ENABLED = "false";
    const calls: ModelGenerateTextInput[] = [];
    const outputs: ModelGenerateTextOutput[] = [
      {
        text: JSON.stringify({
          markdown: "A direct reply.",
          need_image: false,
          image_prompt: null,
          image_alt: null,
        }),
        finishReason: "stop",
      },
      {
        text: '```json\n{\n  "passes": false,\n  "issues": [\n    "Persona claims inability to',
        finishReason: "length",
      },
      {
        text: JSON.stringify({
          passes: true,
          issues: [],
          repairGuidance: [],
          severity: "low",
          confidence: 0.92,
          missingSignals: [],
        }),
        finishReason: "stop",
      },
    ];
    const adapter: ModelAdapter = {
      generateText: async (input) => {
        calls.push(input);
        const next = outputs.shift();
        if (!next) {
          throw new Error("unexpected call");
        }
        return next;
      },
    };

    try {
      const result = await runWithAdapter(adapter);

      expect(result.text).toBe("A direct reply.");
      expect(calls).toHaveLength(3);
      expect(calls[2]?.prompt).toContain("[audit_mode]");
      expect(calls[2]?.prompt).toContain("compact");
    } finally {
      process.env.AI_TOOL_RUNTIME_ENABLED = previousEnabled;
    }
  });

  it("throws when repaired reply output still fails persona audit instead of failing open", async () => {
    await expect(
      runWithAdapter(
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
                passes: false,
                issues: ["too editorial"],
                repairGuidance: ["Lead with a sharper gut reaction."],
                severity: "medium",
                confidence: 0.84,
                missingSignals: ["immediate reaction"],
              }),
              finishReason: "stop",
            },
            {
              text: JSON.stringify({
                markdown: "That silhouette lands. Keep the contrast sharp.",
                need_image: false,
                image_prompt: null,
                image_alt: null,
              }),
              finishReason: "stop",
            },
            {
              text: JSON.stringify({
                passes: false,
                issues: ["persona priorities not visible"],
                repairGuidance: ["Make the persona's priorities visible in what it defends."],
                severity: "high",
                confidence: 0.9,
                missingSignals: ["persona priorities"],
              }),
              finishReason: "stop",
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({
      code: "persona_repair_failed",
    });
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
      policy: DEFAULT_REPLY_WORKER_POLICY,
      modelAdapter: new MockModelAdapter({
        scriptedOutputs: [
          { text: "ok", finishReason: "stop" },
          {
            text: JSON.stringify({
              passes: true,
              issues: [],
              repairGuidance: [],
              severity: "low",
              confidence: 0.94,
              missingSignals: [],
            }),
            finishReason: "stop",
          },
        ],
      }),
    });

    const targetContext = result.promptBlocks.find((block) => block.name === "target_context");

    expect(targetContext).toBeDefined();
    expect(targetContext?.degraded).toBe(true);
    expect(targetContext?.content).toContain("No target context available.");
  });

  it("throws when tool loop hits max iterations without producing output", async () => {
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
      await expect(runWithAdapter(toolLoopAdapter)).rejects.toThrow("TOOL_LOOP_MAX_ITERATIONS");
    } finally {
      process.env.AI_TOOL_RUNTIME_ENABLED = previousEnabled;
      process.env.AI_TOOL_LOOP_TIMEOUT_MS = previousTimeout;
      process.env.AI_TOOL_LOOP_MAX_ITERATIONS = previousMaxIterations;
    }
  });
});
