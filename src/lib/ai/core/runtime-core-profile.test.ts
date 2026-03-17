import { describe, expect, it, vi } from "vitest";
import { SoulReasonCode } from "@/lib/ai/reason-codes";
import {
  CachedRuntimeCoreProvider,
  InMemoryRuntimeCoreEventSink,
  normalizeCoreProfile,
} from "@/lib/ai/core/runtime-core-profile";

describe("normalizeCoreProfile", () => {
  it("fills defaults when fields are missing or invalid", () => {
    const result = normalizeCoreProfile({
      identityCore: {
        archetype: "",
        mbti: "INTJ",
      },
      valueHierarchy: [
        { value: "accuracy", priority: 2 },
        { value: 123, priority: "x" },
      ],
      reasoningLens: {
        primary: ["clarity", "", "clarity"],
      },
      responseStyle: {
        tone: ["direct"],
      },
      relationshipTendencies: {
        defaultStance: "supportive_but_blunt",
      },
      agentEnactmentRules: ["Form a genuine reaction first."],
      inCharacterExamples: [{ scenario: "vague claim", response: "Show receipts." }],
      decisionPolicy: {
        tradeoffStyle: "safe-first",
        antiPatterns: ["", "overclaiming", "overclaiming"],
      },
      languageSignature: {
        rhythm: "direct",
      },
    });

    expect(result.profile.identityCore.archetype.length).toBeGreaterThan(0);
    expect(result.profile.identityCore.mbti).toBe("INTJ");
    expect(result.profile.valueHierarchy[0]).toEqual({ value: "accuracy", priority: 2 });
    expect(result.profile.reasoningLens.primary).toEqual(["clarity"]);
    expect(result.profile.responseStyle.tone).toEqual(["direct"]);
    expect(result.profile.relationshipTendencies.defaultStance).toBe("supportive_but_blunt");
    expect(result.profile.agentEnactmentRules).toContain("Form a genuine reaction first.");
    expect(result.profile.inCharacterExamples).toEqual([
      { scenario: "vague claim", response: "Show receipts." },
    ]);
    expect(result.profile.decisionPolicy.evidenceStandard).toBe("medium");
    expect(result.profile.decisionPolicy.riskPreference).toBe("conservative");
    expect(result.profile.languageSignature.rhythm).toBe("direct");
    expect(result.profile.guardrails.hardNo.length).toBeGreaterThan(0);
    expect(result.normalized).toBe(true);
  });

  it("adapts persona_core voice cues into runtime tone, rhythm, lexical taboos, and feedback principles", () => {
    const result = normalizeCoreProfile({
      identity_summary: {
        archetype: "The Rebel",
        one_sentence_identity:
          "An impulsive, loyal-to-a-fault troublemaker who treats every forum like his ship and every debate like a fight against some admiral.",
      },
      aesthetic_profile: {
        humor_preferences: [
          "Loves crude, physical comedy and exaggerated reactions.",
          "Appreciates humor that punches up at authority or exposes hypocrisy.",
        ],
        creative_preferences: [
          "Prefers bold, direct creative expression over flowery language.",
          "Values sincerity over polish and would take rough but genuine over polished but hollow any day.",
        ],
        disliked_patterns: [
          "Deeply dislikes performative allyship and people who talk about loyalty without acting on it.",
          "Cannot stand passive-aggressive behavior or backdoor manipulation.",
        ],
        taste_boundaries: [
          "Will engage with almost anything if it's honest, but draws hard lines at: fake outrage, manufactured drama, bootlicking authority, and performative politeness.",
        ],
      },
      creator_affinity: {
        creative_biases: [
          "Values sincerity over sophistication any day",
          "Prefers bold, unfiltered expression to nuanced subtlety",
        ],
        detail_selection_habits: [
          "Focuses on character bonds over intricate world-building",
          "Skips elaborate explanations in favor of visceral moments",
        ],
      },
      interaction_defaults: {
        default_stance:
          "Impulsive and emotionally direct, entering conversations with reckless optimism and blunt conviction. Treats every forum like his ship and every debate like a fight against authority. Speaks before thinking and prioritizes loyalty over diplomacy.",
        discussion_strengths: [
          "Fiercely defending crewmates with absolute ferocity",
          "Cutting through empty rhetoric with action-oriented arguments",
        ],
        non_generic_traits: [
          "Zero patience for hierarchy or artificial rank",
          "Would rather throw hands in a group chat than compose a carefully worded reply",
          "Functional illiteracy markers and simple speech patterns",
        ],
      },
      guardrails: {
        hard_no: [
          "Fake outrage and performative allyship",
          "Manufactured drama for engagement",
          "Bootlicking authority",
          "虚伪的politeness (hollow, performative politeness)",
        ],
      },
      voice_fingerprint: {
        opening_move: "Lead with suspicion, not neutral setup.",
        metaphor_domains: ["crime scene", "product launch", "cover-up"],
        attack_style: "sarcastic and evidence-oriented",
        praise_style: "grudging respect only after proof",
        closing_move: "Land a sting or reluctant concession.",
        forbidden_shapes: ["balanced explainer", "workshop critique"],
      },
      task_style_matrix: {
        post: {
          entry_shape: "Plant the angle early.",
          body_shape: "Column-style argument, not tutorial.",
          close_shape: "End with a sting or reluctant concession.",
          forbidden_shapes: ["newsletter tone", "advice list"],
        },
        comment: {
          entry_shape: "Sound like a live thread reply.",
          feedback_shape: "reaction -> suspicion -> concrete note -> grudging respect",
          close_shape: "Keep the close short and thread-native.",
          forbidden_shapes: ["sectioned critique", "support-macro tone"],
        },
      },
    });

    expect(result.profile.responseStyle.tone).toEqual([
      "impulsive",
      "emotionally direct",
      "reckless optimism",
      "blunt conviction",
      "anti-authority",
    ]);
    expect(result.profile.languageSignature.rhythm).toBe("bursty and reactive");
    expect(result.profile.languageSignature.lexicalTaboos).toEqual([
      "fake outrage",
      "manufactured drama",
      "bootlicking authority",
      "performative politeness",
      "passive-aggressive behavior",
    ]);
    expect(result.profile.interactionDoctrine.feedbackPrinciples).toEqual([
      "reaction -> suspicion -> concrete note -> grudging respect",
      "grudging respect only after proof",
      "protect the honest core before polishing",
      "cut through empty rhetoric fast",
      "push for vivid stakes and concrete detail",
      "notice the live emotional bond before the clever surface",
    ]);
    expect(result.profile.voiceFingerprint).toEqual({
      openingMove: "Lead with suspicion, not neutral setup.",
      metaphorDomains: ["crime scene", "product launch", "cover-up"],
      attackStyle: "sarcastic and evidence-oriented",
      praiseStyle: "grudging respect only after proof",
      closingMove: "Land a sting or reluctant concession.",
      forbiddenShapes: ["balanced explainer", "workshop critique"],
    });
    expect(result.profile.taskStyleMatrix).toEqual({
      post: {
        entryShape: "Plant the angle early.",
        bodyShape: "Column-style argument, not tutorial.",
        closeShape: "End with a sting or reluctant concession.",
        forbiddenShapes: ["newsletter tone", "advice list"],
      },
      comment: {
        entryShape: "Sound like a live thread reply.",
        feedbackShape: "reaction -> suspicion -> concrete note -> grudging respect",
        closeShape: "Keep the close short and thread-native.",
        forbiddenShapes: ["sectioned critique", "support-macro tone"],
      },
    });
  });
});

describe("CachedRuntimeCoreProvider", () => {
  it("falls back to empty soul when row is missing", async () => {
    const eventSink = new InMemoryRuntimeCoreEventSink();
    const provider = new CachedRuntimeCoreProvider({
      deps: {
        getCoreProfile: async () => null,
        eventSink,
      },
    });

    const soul = await provider.getRuntimeCore({
      personaId: "persona-1",
      now: new Date("2026-02-26T00:00:00.000Z"),
    });

    expect(soul.source).toBe("fallback_empty");
    expect(soul.summary.riskPreference).toBe("balanced");
    expect(
      eventSink.events.some((event) => event.reasonCode === SoulReasonCode.fallbackEmpty),
    ).toBe(true);
  });

  it("degrades safely when soul read throws", async () => {
    const eventSink = new InMemoryRuntimeCoreEventSink();
    const provider = new CachedRuntimeCoreProvider({
      deps: {
        getCoreProfile: vi.fn().mockRejectedValue(new Error("db down")),
        eventSink,
      },
    });

    const soul = await provider.getRuntimeCore({
      personaId: "persona-2",
      now: new Date("2026-02-26T00:00:00.000Z"),
      tolerateFailure: true,
    });

    expect(soul.source).toBe("fallback_empty");
    expect(eventSink.events.map((event) => event.reasonCode)).toContain(SoulReasonCode.loadFailed);
    expect(eventSink.events.map((event) => event.reasonCode)).toContain(
      SoulReasonCode.fallbackEmpty,
    );
  });

  it("records SOUL_APPLIED as observable event", async () => {
    const eventSink = new InMemoryRuntimeCoreEventSink();
    const provider = new CachedRuntimeCoreProvider({
      deps: {
        getCoreProfile: async () => ({
          identityCore: { archetype: "debug", mbti: "INTJ", coreMotivation: "clarify" },
          reasoningLens: { primary: ["clarity"], secondary: [], promptHint: "clarity first" },
          responseStyle: { tone: ["direct"], patterns: ["short_paragraphs"], avoid: [] },
          relationshipTendencies: {
            defaultStance: "supportive_but_blunt",
            trustSignals: ["specificity"],
            frictionTriggers: ["hype"],
          },
          agentEnactmentRules: ["Form a genuine reaction first."],
          inCharacterExamples: [{ scenario: "vague claim", response: "Show receipts." }],
        }),
        eventSink,
      },
    });

    await provider.recordApplied({
      personaId: "persona-3",
      layer: "generation",
      now: new Date("2026-02-26T00:00:00.000Z"),
      metadata: { operation: "prompt_integration" },
    });

    expect(eventSink.events).toHaveLength(1);
    expect(eventSink.events[0]?.reasonCode).toBe(SoulReasonCode.applied);
    expect(eventSink.events[0]?.layer).toBe("generation");
  });
});
