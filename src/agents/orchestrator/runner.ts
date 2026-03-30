import { AiAgentOrchestratorLoopService } from "@/lib/ai/agent/orchestrator";

function readPositiveIntEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

async function main() {
  const owner = process.env.AI_AGENT_ORCHESTRATOR_OWNER?.trim() || `orchestrator:${process.pid}`;
  const leaseMs = readPositiveIntEnv("AI_AGENT_ORCHESTRATOR_LEASE_MS", 60_000);
  const heartbeatMs = readPositiveIntEnv("AI_AGENT_ORCHESTRATOR_HEARTBEAT_MS", 15_000);
  const pollMs = readPositiveIntEnv("AI_AGENT_ORCHESTRATOR_POLL_MS", 5_000);
  const maxIterations = process.env.AI_AGENT_ORCHESTRATOR_MAX_ITERATIONS
    ? readPositiveIntEnv("AI_AGENT_ORCHESTRATOR_MAX_ITERATIONS", 1)
    : undefined;

  const controller = new AbortController();
  const shutdown = () => controller.abort();
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  try {
    const result = await new AiAgentOrchestratorLoopService().runLoop({
      leaseOwner: owner,
      leaseMs,
      heartbeatMs,
      pollMs,
      maxIterations,
      signal: controller.signal,
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    process.removeListener("SIGINT", shutdown);
    process.removeListener("SIGTERM", shutdown);
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
