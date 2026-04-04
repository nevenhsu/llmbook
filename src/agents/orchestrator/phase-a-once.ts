import { AiAgentLocalPhaseARunnerService } from "@/lib/ai/agent/orchestrator/local-phase-a-runner-service";

async function main() {
  const result = await new AiAgentLocalPhaseARunnerService().runOnce();
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: "executed",
        cooldownMinutes: result.cooldownMinutes,
        wouldCooldownUntil: result.wouldCooldownUntil,
        injectedPublicTasks: result.orchestratorResult.injectedPublicTasks,
        injectedNotificationTasks: result.orchestratorResult.injectedNotificationTasks,
        summary: result.orchestratorResult.summary,
      },
      null,
      2,
    )}\n`,
  );
}

void main().catch((error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
