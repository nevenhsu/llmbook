import type { AiAgentOperatorFlowTrace } from "@/lib/ai/agent/operator-flow-trace";
import type { AiAgentReadinessSummary } from "@/lib/ai/agent/readiness-summary";
import type { AiAgentOverviewSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";

export type AiAgentContinuousRuntimeCheckpointCheck = {
  key: "runtime_readiness" | "operator_walkthrough" | "memory_persistence" | "logs_diagnostics";
  status: "pass" | "warn" | "fail";
  summary: string;
};

export type AiAgentContinuousRuntimeCheckpoint = {
  overallStatus: "ready" | "attention" | "blocked";
  statusLabel: string;
  checks: AiAgentContinuousRuntimeCheckpointCheck[];
};

function hasStructuredLogEvidence(snapshot: AiAgentOverviewSnapshot): boolean {
  return snapshot.recentRuns.some((run) => {
    const selector = run.metadata.selector;
    const workerSummary = run.metadata.workerSummary;
    const parser = run.metadata.parser;
    const repair = run.metadata.repair;
    return Boolean(selector || workerSummary || parser || repair || run.skippedReason);
  });
}

export function buildContinuousRuntimeCheckpoint(input: {
  snapshot: AiAgentOverviewSnapshot;
  readinessSummary: AiAgentReadinessSummary;
  operatorFlowTrace: AiAgentOperatorFlowTrace | null;
}): AiAgentContinuousRuntimeCheckpoint {
  const { snapshot, readinessSummary, operatorFlowTrace } = input;
  const checks: AiAgentContinuousRuntimeCheckpointCheck[] = [];

  checks.push({
    key: "runtime_readiness",
    status:
      readinessSummary.overallStatus === "blocked"
        ? "fail"
        : readinessSummary.overallStatus === "attention"
          ? "warn"
          : "pass",
    summary:
      readinessSummary.overallStatus === "ready"
        ? "Runtime readiness checks are currently green for manual operation."
        : readinessSummary.statusLabel,
  });

  checks.push({
    key: "operator_walkthrough",
    status:
      operatorFlowTrace?.stageStatus.intakeCompleted &&
      operatorFlowTrace.stageStatus.executionCompleted
        ? "pass"
        : operatorFlowTrace
          ? "warn"
          : "fail",
    summary:
      operatorFlowTrace?.stageStatus.intakeCompleted &&
      operatorFlowTrace.stageStatus.executionCompleted
        ? "An end-to-end operator walkthrough has executed intake and runner stages."
        : operatorFlowTrace
          ? "Operator flow trace exists, but intake/runner execution has not both completed yet."
          : "No operator walkthrough evidence is currently loaded.",
  });

  checks.push({
    key: "memory_persistence",
    status:
      operatorFlowTrace?.stageStatus.latestWritePersisted &&
      operatorFlowTrace.stageStatus.compressionPersisted
        ? "pass"
        : operatorFlowTrace?.stageStatus.latestWriteReady
          ? "warn"
          : "fail",
    summary:
      operatorFlowTrace?.stageStatus.latestWritePersisted &&
      operatorFlowTrace.stageStatus.compressionPersisted
        ? "Latest-write and compression persistence have both been verified in the current flow."
        : operatorFlowTrace?.stageStatus.latestWriteReady
          ? "Memory flow is partially verified, but persistence has not completed end-to-end."
          : "No current memory persistence verification is available.",
  });

  checks.push({
    key: "logs_diagnostics",
    status: hasStructuredLogEvidence(snapshot) ? "pass" : "fail",
    summary: hasStructuredLogEvidence(snapshot)
      ? "Recent runs include structured diagnostics for executed/skipped inspection."
      : "Recent runs do not yet expose enough structured diagnostics for sign-off.",
  });

  const hasFail = checks.some((check) => check.status === "fail");
  const hasWarn = checks.some((check) => check.status === "warn");

  return {
    overallStatus: hasFail ? "blocked" : hasWarn ? "attention" : "ready",
    statusLabel: hasFail
      ? "Not Ready For Continuous Runtime"
      : hasWarn
        ? "Needs More Sign-Off"
        : "Ready For Continuous Runtime",
    checks,
  };
}
