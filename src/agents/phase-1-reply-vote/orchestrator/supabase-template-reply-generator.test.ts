import { describe, expect, it } from "vitest";
import {
  composeSoulDrivenReply,
  rankFocusCandidates,
} from "@/agents/phase-1-reply-vote/orchestrator/supabase-template-reply-generator";
import type { RuntimeCoreContext } from "@/lib/ai/core/runtime-core-profile";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

describe("rankFocusCandidates", () => {
  it("prioritizes most recent non-self comments before self comments", () => {
    const ranked = rankFocusCandidates({
      personaId: "persona-1",
      comments: [
        {
          id: "c1",
          post_id: "p1",
          parent_id: null,
          author_id: null,
          persona_id: "persona-1",
          body: "self old",
          created_at: "2026-02-24T00:00:00.000Z",
        },
        {
          id: "c2",
          post_id: "p1",
          parent_id: null,
          author_id: "user-1",
          persona_id: null,
          body: "user newer",
          created_at: "2026-02-24T00:10:00.000Z",
        },
        {
          id: "c3",
          post_id: "p1",
          parent_id: null,
          author_id: "user-2",
          persona_id: null,
          body: "user latest",
          created_at: "2026-02-24T00:20:00.000Z",
        },
      ],
    });

    expect(ranked.map((row) => row.id)).toEqual(["c3", "c2", "c1"]);
  });
});

describe("composeSoulDrivenReply", () => {
  function buildSoul(overrides: DeepPartial<RuntimeCoreContext>): RuntimeCoreContext {
    const base: RuntimeCoreContext = {
      profile: {
        identityCore: {
          archetype: "A calm operator",
          mbti: "INTJ",
          coreMotivation: "reduce unnecessary risk",
        },
        valueHierarchy: [
          { value: "safety", priority: 1 },
          { value: "clarity", priority: 2 },
        ],
        reasoningLens: {
          primary: ["risk", "clarity"],
          secondary: ["feasibility"],
          promptHint: "Risk first, then clarity.",
        },
        responseStyle: {
          tone: ["direct"],
          patterns: ["short_paragraphs"],
          avoid: ["tutorial_lists"],
        },
        relationshipTendencies: {
          defaultStance: "supportive_but_blunt",
          trustSignals: ["specificity"],
          frictionTriggers: ["hype"],
        },
        agentEnactmentRules: ["Form a genuine reaction before writing."],
        inCharacterExamples: [
          { scenario: "risky idea", response: "Slow down and test the downside first." },
        ],
        decisionPolicy: {
          evidenceStandard: "high",
          tradeoffStyle: "conservative",
          uncertaintyHandling: "state uncertainty",
          antiPatterns: ["overclaim"],
          riskPreference: "conservative",
        },
        interactionDoctrine: {
          askVsTellRatio: "ask-first",
          feedbackPrinciples: ["context", "trade-off"],
          collaborationStance: "challenge",
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
          deescalationRules: ["reduce risk"],
        },
      },
      summary: {
        identity: "A calm operator",
        mbti: "INTJ",
        topValues: ["safety", "clarity"],
        tradeoffStyle: "conservative",
        riskPreference: "conservative",
        collaborationStance: "challenge",
        rhythm: "direct",
        defaultRelationshipStance: "supportive_but_blunt",
        promptHint: "Risk first, then clarity.",
        enactmentRuleCount: 1,
        exampleCount: 1,
        guardrailCount: 2,
      },
      normalized: false,
      source: "db",
    };

    return {
      ...base,
      ...overrides,
      profile: {
        identityCore: {
          ...base.profile.identityCore,
          ...(overrides.profile?.identityCore ?? {}),
        },
        valueHierarchy:
          (overrides.profile?.valueHierarchy as RuntimeCoreContext["profile"]["valueHierarchy"]) ??
          base.profile.valueHierarchy,
        reasoningLens: {
          ...base.profile.reasoningLens,
          ...(overrides.profile?.reasoningLens ?? {}),
        },
        responseStyle: {
          ...base.profile.responseStyle,
          ...(overrides.profile?.responseStyle ?? {}),
        },
        relationshipTendencies: {
          ...base.profile.relationshipTendencies,
          ...(overrides.profile?.relationshipTendencies ?? {}),
        },
        agentEnactmentRules:
          (overrides.profile?.agentEnactmentRules as string[] | undefined) ??
          base.profile.agentEnactmentRules,
        inCharacterExamples:
          (overrides.profile?.inCharacterExamples as
            | RuntimeCoreContext["profile"]["inCharacterExamples"]
            | undefined) ?? base.profile.inCharacterExamples,
        decisionPolicy: {
          ...base.profile.decisionPolicy,
          ...(overrides.profile?.decisionPolicy ?? {}),
        },
        interactionDoctrine: {
          ...base.profile.interactionDoctrine,
          ...(overrides.profile?.interactionDoctrine ?? {}),
        },
        languageSignature: {
          ...base.profile.languageSignature,
          ...(overrides.profile?.languageSignature ?? {}),
        },
        guardrails: {
          ...base.profile.guardrails,
          ...(overrides.profile?.guardrails ?? {}),
        },
      },
      summary: {
        ...base.summary,
        ...(overrides.summary ?? {}),
      },
    };
  }

  it("changes output direction and tone when soul summary changes", () => {
    const conservative = composeSoulDrivenReply({
      title: "Roadmap",
      postBodySnippet: "Need to pick one path",
      focusActor: "user:1234",
      focusSnippet: "we should move quickly",
      participantCount: 3,
      soul: buildSoul({}),
    });

    const progressive = composeSoulDrivenReply({
      title: "Roadmap",
      postBodySnippet: "Need to pick one path",
      focusActor: "user:1234",
      focusSnippet: "we should move quickly",
      participantCount: 3,
      soul: buildSoul({
        profile: {
          interactionDoctrine: {
            askVsTellRatio: "tell-first",
            feedbackPrinciples: ["action"],
            collaborationStance: "support",
          },
          decisionPolicy: {
            evidenceStandard: "medium",
            tradeoffStyle: "progressive",
            uncertaintyHandling: "accept uncertainty",
            antiPatterns: ["stalling"],
            riskPreference: "progressive",
          },
          languageSignature: {
            rhythm: "calm",
            preferredStructures: ["action"],
            lexicalTaboos: [],
          },
        },
        summary: {
          topValues: ["speed"],
          tradeoffStyle: "progressive",
          riskPreference: "progressive",
          collaborationStance: "support",
          rhythm: "calm",
        },
      }),
    });

    expect(conservative).not.toBe(progressive);
    expect(conservative).toContain("Directly speaking");
    expect(progressive).toContain("Calmly");
  });
});
