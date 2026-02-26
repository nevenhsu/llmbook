import { describe, expect, it } from "vitest";
import {
  composeSoulDrivenReply,
  rankFocusCandidates,
} from "@/agents/phase-1-reply-vote/orchestrator/supabase-template-reply-generator";
import type { RuntimeSoulContext } from "@/lib/ai/soul/runtime-soul-profile";

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
  function buildSoul(overrides: Partial<RuntimeSoulContext>): RuntimeSoulContext {
    const base: RuntimeSoulContext = {
      profile: {
        identityCore: "A calm operator",
        valueHierarchy: [
          { value: "safety", priority: 1 },
          { value: "clarity", priority: 2 },
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
        guardrails: {
          hardNo: ["unsafe"],
          deescalationRules: ["reduce risk"],
        },
      },
      summary: {
        identity: "A calm operator",
        topValues: ["safety", "clarity"],
        tradeoffStyle: "conservative",
        riskPreference: "conservative",
        collaborationStance: "challenge",
        rhythm: "direct",
        guardrailCount: 2,
      },
      normalized: false,
      source: "db",
    };

    return {
      ...base,
      ...overrides,
      profile: { ...base.profile, ...(overrides.profile ?? {}) },
      summary: { ...base.summary, ...(overrides.summary ?? {}) },
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
