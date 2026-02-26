#!/usr/bin/env ts-node

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runEvaluationReplay } from "@/lib/ai/evaluation/runner";
import {
  createBaselineReplayVariant,
  createCandidateReplayVariant,
  minimalReplayDataset,
} from "@/lib/ai/evaluation/fixtures/minimal-replay-dataset";
import { summarizeCaseOutcomes } from "@/lib/ai/evaluation/metrics";

async function main(): Promise<void> {
  const report = await runEvaluationReplay({
    dataset: minimalReplayDataset,
    baseline: createBaselineReplayVariant(),
    candidate: createCandidateReplayVariant(),
    gateRules: {
      maxMissRateIncrease: 0.05,
      maxSuccessRateDrop: 0.05,
      maxErrorRateIncrease: 0.05,
    },
  });

  const outDir = resolve(process.cwd(), "reports/ai-eval");
  const outFile = resolve(outDir, "latest.json");
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  const baselineSummary = summarizeCaseOutcomes(report.baseline.caseResults);
  const candidateSummary = summarizeCaseOutcomes(report.candidate.caseResults);

  process.stdout.write(`AI evaluation complete
- dataset: ${report.summary.datasetVersion}
- baseline: ${report.summary.baseline}
- candidate: ${report.summary.candidate}
- gate: ${report.gate.passed ? "PASS" : "FAIL"}
- gate failures: ${report.gate.failures.length}
- baseline outcomes: ${JSON.stringify(baselineSummary)}
- candidate outcomes: ${JSON.stringify(candidateSummary)}
- report: ${outFile}
`);
}

main().catch((error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`ai:eval failed\n${message}\n`);
  process.exit(1);
});
