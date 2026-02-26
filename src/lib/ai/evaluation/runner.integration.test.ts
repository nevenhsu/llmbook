import { describe, expect, it } from "vitest";
import { runEvaluationReplay } from "@/lib/ai/evaluation/runner";
import {
  createBaselineReplayVariant,
  createCandidateReplayVariant,
  minimalReplayDataset,
} from "@/lib/ai/evaluation/fixtures/minimal-replay-dataset";

describe("runEvaluationReplay", () => {
  it("runs baseline/candidate on same dataset and produces diff + gate", async () => {
    const report = await runEvaluationReplay({
      dataset: minimalReplayDataset,
      baseline: createBaselineReplayVariant(),
      candidate: createCandidateReplayVariant(),
      gateRules: {
        maxMissRateIncrease: 0.05,
        maxSuccessRateDrop: 0.1,
      },
    });

    expect(report.summary.datasetVersion).toBe(minimalReplayDataset.datasetVersion);
    expect(report.baseline.caseResults).toHaveLength(minimalReplayDataset.cases.length);
    expect(report.candidate.caseResults).toHaveLength(minimalReplayDataset.cases.length);
    expect(report.diff.safety.missRateDelta).toBeGreaterThan(0);
    expect(report.gate.passed).toBe(false);
    expect(report.gate.failures.length).toBeGreaterThan(0);
  });

  it("covers thread memory hit + memory fallback observability", async () => {
    const report = await runEvaluationReplay({
      dataset: minimalReplayDataset,
      baseline: createBaselineReplayVariant(),
      candidate: createCandidateReplayVariant(),
    });

    const baselineMemoryHit = report.baseline.caseResults.find(
      (r) => r.caseId === "precheck-block",
    );
    const baselineFallback = report.baseline.caseResults.find(
      (r) => r.caseId === "memory-fallback-allow",
    );

    expect(baselineMemoryHit?.decision).toBe("BLOCKED_PRECHECK");
    expect(baselineMemoryHit?.reasonCodes).toContain("PRECHECK_SAFETY_SIMILAR_TO_RECENT_REPLY");
    expect(baselineFallback?.reasonCodes).toContain("MEMORY_READ_FAILED");
    expect(baselineFallback?.decision).toBe("ALLOWED");
  });
});
