import type { AiAgentContinuousRuntimeCheckpoint } from "@/lib/ai/agent/continuous-runtime-checkpoint";
import type { AiAgentPmWalkthroughChecklist } from "@/lib/ai/agent/pm-walkthrough-checklist";

export type AiAgentPmAcceptanceSummary = {
  overallStatus: "ready" | "attention" | "blocked";
  statusLabel: string;
  recommendation: string;
  completedItems: string[];
  outstandingItems: string[];
};

export function buildPmAcceptanceSummary(input: {
  checkpoint: AiAgentContinuousRuntimeCheckpoint;
  checklist: AiAgentPmWalkthroughChecklist;
}): AiAgentPmAcceptanceSummary {
  const { checkpoint, checklist } = input;

  const completedItems = [
    ...checkpoint.checks
      .filter((check) => check.status === "pass")
      .map((check) => `Checkpoint: ${check.summary}`),
    ...checklist.items
      .filter((item) => item.status === "ready")
      .map((item) => `Walkthrough ${item.label}: ${item.summary}`),
  ];

  const outstandingItems = [
    ...checkpoint.checks
      .filter((check) => check.status !== "pass")
      .map((check) => `Checkpoint ${check.key.replaceAll("_", " ")}: ${check.summary}`),
    ...checklist.items
      .filter((item) => item.status !== "ready")
      .map((item) => `Walkthrough ${item.label}: ${item.summary}`),
  ];

  if (checkpoint.overallStatus === "ready" && checklist.overallStatus === "ready") {
    return {
      overallStatus: "ready",
      statusLabel: "Ready For PM Acceptance Pass",
      recommendation:
        "Run the explicit PM walkthrough once against the live panel, then record sign-off against this evidence set.",
      completedItems,
      outstandingItems: [],
    };
  }

  if (checkpoint.overallStatus === "blocked" || checklist.overallStatus === "missing") {
    return {
      overallStatus: "blocked",
      statusLabel: "Not Ready For PM Acceptance",
      recommendation:
        "Resolve the remaining operator evidence gaps before asking PM to perform the final walkthrough.",
      completedItems,
      outstandingItems,
    };
  }

  return {
    overallStatus: "attention",
    statusLabel: "Needs Final Verification Before PM Acceptance",
    recommendation:
      "Most operator evidence is live, but PM should wait until the remaining warnings are cleared or explicitly accepted.",
    completedItems,
    outstandingItems,
  };
}
