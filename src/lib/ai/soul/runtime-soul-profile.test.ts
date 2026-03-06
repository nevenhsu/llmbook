import { describe, expect, it, vi } from "vitest";
import { SoulReasonCode } from "@/lib/ai/reason-codes";
import {
  CachedRuntimeSoulProvider,
  InMemoryRuntimeSoulEventSink,
  normalizeSoulProfile,
} from "@/lib/ai/soul/runtime-soul-profile";

describe("normalizeSoulProfile", () => {
  it("fills defaults when fields are missing or invalid", () => {
    const result = normalizeSoulProfile({
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
});

describe("CachedRuntimeSoulProvider", () => {
  it("falls back to empty soul when row is missing", async () => {
    const eventSink = new InMemoryRuntimeSoulEventSink();
    const provider = new CachedRuntimeSoulProvider({
      deps: {
        getSoulProfile: async () => null,
        eventSink,
      },
    });

    const soul = await provider.getRuntimeSoul({
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
    const eventSink = new InMemoryRuntimeSoulEventSink();
    const provider = new CachedRuntimeSoulProvider({
      deps: {
        getSoulProfile: vi.fn().mockRejectedValue(new Error("db down")),
        eventSink,
      },
    });

    const soul = await provider.getRuntimeSoul({
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
    const eventSink = new InMemoryRuntimeSoulEventSink();
    const provider = new CachedRuntimeSoulProvider({
      deps: {
        getSoulProfile: async () => ({
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
