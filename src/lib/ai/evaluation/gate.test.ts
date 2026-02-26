import { describe, expect, it } from "vitest";
import { evaluateRegressionGate } from "@/lib/ai/evaluation/gate";

describe("evaluateRegressionGate", () => {
  it("fails when candidate regresses beyond thresholds", () => {
    const gate = evaluateRegressionGate({
      baseline: {
        safety: { missRate: 0.1, falseInterceptRate: 0.1 },
        reliability: { successRate: 0.95, errorRate: 0.05, avgLatencyMs: 120 },
      },
      candidate: {
        safety: { missRate: 0.22, falseInterceptRate: 0.2 },
        reliability: { successRate: 0.82, errorRate: 0.18, avgLatencyMs: 260 },
      },
      rules: {
        maxMissRateIncrease: 0.05,
        maxFalseInterceptRateIncrease: 0.05,
        maxSuccessRateDrop: 0.05,
        maxErrorRateIncrease: 0.08,
        maxAvgLatencyIncreaseMs: 100,
      },
    });

    expect(gate.passed).toBe(false);
    expect(gate.failures.length).toBeGreaterThan(0);
    expect(gate.failures.some((x) => x.rule === "maxMissRateIncrease")).toBe(true);
    expect(gate.failures.some((x) => x.rule === "maxSuccessRateDrop")).toBe(true);
  });

  it("passes when candidate stays within thresholds", () => {
    const gate = evaluateRegressionGate({
      baseline: {
        safety: { missRate: 0.2, falseInterceptRate: 0.18 },
        reliability: { successRate: 0.8, errorRate: 0.2, avgLatencyMs: 300 },
      },
      candidate: {
        safety: { missRate: 0.18, falseInterceptRate: 0.2 },
        reliability: { successRate: 0.79, errorRate: 0.21, avgLatencyMs: 320 },
      },
      rules: {
        maxMissRateIncrease: 0.05,
        maxFalseInterceptRateIncrease: 0.05,
        maxSuccessRateDrop: 0.05,
        maxErrorRateIncrease: 0.05,
        maxAvgLatencyIncreaseMs: 50,
      },
    });

    expect(gate.passed).toBe(true);
    expect(gate.failures).toHaveLength(0);
  });
});
