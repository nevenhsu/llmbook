import { describe, expect, it } from "vitest";
import { computeEvaluationMetrics, summarizeCaseOutcomes } from "@/lib/ai/evaluation/metrics";
import type { ReplayCaseResult } from "@/lib/ai/evaluation/contracts";

function result(overrides: Partial<ReplayCaseResult>): ReplayCaseResult {
  return {
    caseId: overrides.caseId ?? "case-1",
    variant: overrides.variant ?? "baseline",
    flow: overrides.flow ?? "execution",
    decision: overrides.decision ?? "SUCCEEDED",
    reasonCodes: overrides.reasonCodes ?? [],
    generated: overrides.generated ?? { textPreview: "ok", textLength: 2, empty: false },
    error: overrides.error,
    latencyMs: overrides.latencyMs ?? 10,
    reliability: overrides.reliability ?? { succeeded: true, errored: false },
    safety: overrides.safety ?? { blocked: false },
    quality: overrides.quality ?? { emptyOutput: false, normalizedText: "ok" },
    cost: overrides.cost ?? { inputTokens: 10, outputTokens: 20, estimatedUsd: 0.001 },
    expected: overrides.expected,
  };
}

describe("computeEvaluationMetrics", () => {
  it("calculates safety, quality, reliability and cost proxies", () => {
    const metrics = computeEvaluationMetrics([
      result({
        caseId: "a",
        safety: { blocked: true, shouldBlock: true },
        expected: { safety: { shouldBlock: true } },
      }),
      result({
        caseId: "b",
        decision: "BLOCKED_SAFETY",
        safety: { blocked: true, shouldBlock: false },
        expected: { safety: { shouldBlock: false } },
      }),
      result({
        caseId: "c",
        decision: "SUCCEEDED",
        generated: { textPreview: "", textLength: 0, empty: true },
        quality: { emptyOutput: true, normalizedText: "" },
        safety: { blocked: false, shouldBlock: true },
        expected: { safety: { shouldBlock: true } },
      }),
      result({
        caseId: "d",
        decision: "FAILED",
        reliability: { succeeded: false, errored: true },
        error: { code: "ERR", message: "boom" },
        generated: { textPreview: "repeat", textLength: 6, empty: false },
        quality: { emptyOutput: false, normalizedText: "repeat" },
      }),
      result({
        caseId: "e",
        decision: "SUCCEEDED",
        generated: { textPreview: "repeat", textLength: 6, empty: false },
        quality: { emptyOutput: false, normalizedText: "repeat" },
      }),
    ]);

    expect(metrics.safety.labeledCount).toBe(3);
    expect(metrics.safety.interceptRate).toBeCloseTo(0.5, 5);
    expect(metrics.safety.falseInterceptRate).toBeCloseTo(1, 5);
    expect(metrics.safety.missRate).toBeCloseTo(0.5, 5);
    expect(metrics.quality.emptyOutputRate).toBeCloseTo(0.2, 5);
    expect(metrics.quality.repeatRate).toBeCloseTo(0.5, 5);
    expect(metrics.reliability.successRate).toBeCloseTo(0.8, 5);
    expect(metrics.reliability.errorRate).toBeCloseTo(0.2, 5);
    expect(metrics.cost.totalTokens).toBe(150);
    expect(metrics.score.total).toBeGreaterThanOrEqual(0);
    expect(metrics.score.total).toBeLessThanOrEqual(100);
  });
});

describe("summarizeCaseOutcomes", () => {
  it("aggregates decision counts", () => {
    const summary = summarizeCaseOutcomes([
      result({ decision: "SUCCEEDED" }),
      result({ decision: "SUCCEEDED" }),
      result({ decision: "BLOCKED_SAFETY" }),
    ]);

    expect(summary.SUCCEEDED).toBe(2);
    expect(summary.BLOCKED_SAFETY).toBe(1);
  });
});
