import type { AiAgentContinuousRuntimeCheckpoint } from "@/lib/ai/agent/continuous-runtime-checkpoint";
import type { AiAgentOperatorFlowTrace } from "@/lib/ai/agent/operator-flow-trace";
import type { AiAgentOverviewSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";

export type AiAgentPmWalkthroughItem = {
  key: "overview" | "intake" | "tasks" | "run" | "memory" | "logs";
  label: string;
  status: "ready" | "partial" | "missing";
  summary: string;
};

export type AiAgentPmWalkthroughChecklist = {
  overallStatus: "ready" | "partial" | "missing";
  statusLabel: string;
  items: AiAgentPmWalkthroughItem[];
};

export function buildPmWalkthroughChecklist(input: {
  snapshot: AiAgentOverviewSnapshot;
  operatorFlowTrace: AiAgentOperatorFlowTrace | null;
  checkpoint: AiAgentContinuousRuntimeCheckpoint;
}): AiAgentPmWalkthroughChecklist {
  const { snapshot, operatorFlowTrace, checkpoint } = input;

  const items: AiAgentPmWalkthroughItem[] = [
    {
      key: "overview",
      label: "Overview",
      status:
        snapshot.runtimeState.available &&
        checkpoint.checks.some(
          (check) => check.key === "runtime_readiness" && check.status === "pass",
        )
          ? "ready"
          : "partial",
      summary: snapshot.runtimeState.available
        ? "Runtime health, config, and checkpoint status are visible."
        : "Runtime controls are visible, but lease-state persistence is still not wired.",
    },
    {
      key: "intake",
      label: "Intake",
      status: operatorFlowTrace?.intake.completed ? "ready" : "partial",
      summary: operatorFlowTrace?.intake.completed
        ? "Intake preview and task injection evidence are present."
        : "Intake previews are present, but walkthrough injection evidence is not loaded.",
    },
    {
      key: "tasks",
      label: "Tasks",
      status: snapshot.recentTasks.length > 0 ? "ready" : "missing",
      summary:
        snapshot.recentTasks.length > 0
          ? "Queue rows, dedupe/cooldown fields, and action previews are visible."
          : "No queue rows are currently visible.",
    },
    {
      key: "run",
      label: "Run",
      status: operatorFlowTrace?.stageStatus.executionCompleted ? "ready" : "partial",
      summary: operatorFlowTrace?.stageStatus.executionCompleted
        ? "Runner execution evidence is available in-panel."
        : "Run previews are present, but execute evidence is not loaded in the current session.",
    },
    {
      key: "memory",
      label: "Memory",
      status:
        operatorFlowTrace?.stageStatus.latestWritePersisted &&
        operatorFlowTrace.stageStatus.compressionPersisted
          ? "ready"
          : operatorFlowTrace?.stageStatus.latestWriteReady
            ? "partial"
            : "missing",
      summary:
        operatorFlowTrace?.stageStatus.latestWritePersisted &&
        operatorFlowTrace.stageStatus.compressionPersisted
          ? "Latest-write and compression persistence are both verified."
          : operatorFlowTrace?.stageStatus.latestWriteReady
            ? "Memory previews are present, but persistence is only partially verified."
            : "Memory verification evidence is not loaded.",
    },
    {
      key: "logs",
      label: "Logs",
      status:
        snapshot.recentRuns.length > 0 &&
        snapshot.recentRuns.some((run) =>
          Boolean(run.skippedReason || run.metadata.parser || run.metadata.repair),
        )
          ? "ready"
          : snapshot.recentRuns.length > 0
            ? "partial"
            : "missing",
      summary:
        snapshot.recentRuns.length > 0 &&
        snapshot.recentRuns.some((run) =>
          Boolean(run.skippedReason || run.metadata.parser || run.metadata.repair),
        )
          ? "Structured diagnostics and run metadata are available."
          : snapshot.recentRuns.length > 0
            ? "Run history exists, but structured diagnostics coverage is still thin."
            : "No run history is currently visible.",
    },
  ];

  const hasMissing = items.some((item) => item.status === "missing");
  const hasPartial = items.some((item) => item.status === "partial");

  return {
    overallStatus: hasMissing ? "missing" : hasPartial ? "partial" : "ready",
    statusLabel: hasMissing
      ? "Walkthrough Incomplete"
      : hasPartial
        ? "Walkthrough Partially Verified"
        : "Walkthrough Ready For PM Sign-Off",
    items,
  };
}
