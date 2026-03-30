import type { AiAgentOverviewSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";

export type AiAgentReadinessCheck = {
  key:
    | "runtime_state"
    | "queue_backlog"
    | "token_quota"
    | "image_quota"
    | "checkpoint_coverage"
    | "latest_run";
  status: "pass" | "warn" | "fail";
  summary: string;
};

export type AiAgentReadinessSummary = {
  overallStatus: "ready" | "attention" | "blocked";
  statusLabel: string;
  checks: AiAgentReadinessCheck[];
};

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Math.round((numerator / denominator) * 100);
}

export function buildAiAgentReadinessSummary(
  snapshot: AiAgentOverviewSnapshot,
): AiAgentReadinessSummary {
  const checks: AiAgentReadinessCheck[] = [];

  checks.push({
    key: "runtime_state",
    status: snapshot.runtimeState.available ? "pass" : "fail",
    summary: snapshot.runtimeState.available
      ? "Runtime lease state is available."
      : snapshot.runtimeState.detail,
  });

  const runnableBacklog = snapshot.queue.running + snapshot.queue.inReview + snapshot.queue.failed;
  checks.push({
    key: "queue_backlog",
    status: runnableBacklog === 0 ? "pass" : snapshot.queue.failed > 0 ? "fail" : "warn",
    summary:
      runnableBacklog === 0
        ? "No running, review, or failed queue rows are blocking manual verification."
        : `${snapshot.queue.running} running, ${snapshot.queue.inReview} in-review, ${snapshot.queue.failed} failed rows need attention.`,
  });

  const tokenQuotaUsed = snapshot.usage
    ? snapshot.usage.textPromptTokens + snapshot.usage.textCompletionTokens
    : 0;
  const tokenQuotaPercent = percentage(tokenQuotaUsed, snapshot.config.values.llmDailyTokenQuota);
  checks.push({
    key: "token_quota",
    status: tokenQuotaPercent >= 100 ? "fail" : tokenQuotaPercent >= 80 ? "warn" : "pass",
    summary: `${tokenQuotaUsed} / ${snapshot.config.values.llmDailyTokenQuota} text tokens used (${tokenQuotaPercent}%).`,
  });

  const imageQuotaPercent = percentage(
    snapshot.usage?.imageGenerationCount ?? 0,
    snapshot.config.values.llmDailyImageQuota,
  );
  checks.push({
    key: "image_quota",
    status: imageQuotaPercent >= 100 ? "fail" : imageQuotaPercent >= 80 ? "warn" : "pass",
    summary: `${snapshot.usage?.imageGenerationCount ?? 0} / ${snapshot.config.values.llmDailyImageQuota} images used (${imageQuotaPercent}%).`,
  });

  checks.push({
    key: "checkpoint_coverage",
    status:
      snapshot.checkpoints.length >= 2
        ? "pass"
        : snapshot.checkpoints.length === 1
          ? "warn"
          : "fail",
    summary:
      snapshot.checkpoints.length >= 2
        ? `${snapshot.checkpoints.length} source checkpoints are visible.`
        : snapshot.checkpoints.length === 1
          ? "Only one source checkpoint is visible; intake coverage may be incomplete."
          : "No source checkpoints are visible.",
  });

  checks.push({
    key: "latest_run",
    status: snapshot.latestRun ? "pass" : "warn",
    summary: snapshot.latestRun
      ? `Latest run recorded at ${snapshot.latestRun.runAt}.`
      : "No orchestrator run has been recorded yet.",
  });

  const hasFail = checks.some((check) => check.status === "fail");
  const hasWarn = checks.some((check) => check.status === "warn");

  return {
    overallStatus: hasFail ? "blocked" : hasWarn ? "attention" : "ready",
    statusLabel: hasFail ? "Blocked" : hasWarn ? "Attention Needed" : "Ready For Manual Run",
    checks,
  };
}
