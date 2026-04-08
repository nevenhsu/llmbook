import { AiAgentJobsRuntimeService } from "@/lib/ai/agent/jobs";

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
  const workerId = process.env.AI_AGENT_JOBS_RUNTIME_OWNER?.trim() || `jobs-runtime:${process.pid}`;
  const leaseMs = readPositiveIntEnv("AI_AGENT_JOBS_RUNTIME_LEASE_MS", 60_000);
  const heartbeatMs = readPositiveIntEnv("AI_AGENT_JOBS_RUNTIME_HEARTBEAT_MS", 15_000);
  const pollMs = readPositiveIntEnv("AI_AGENT_JOBS_RUNTIME_POLL_MS", 10_000);
  const maxIterations = process.env.AI_AGENT_JOBS_RUNTIME_MAX_ITERATIONS
    ? readPositiveIntEnv("AI_AGENT_JOBS_RUNTIME_MAX_ITERATIONS", 1)
    : undefined;

  const controller = new AbortController();
  const shutdown = () => controller.abort();
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  try {
    const result = await new AiAgentJobsRuntimeService({ leaseMs }).runLoop({
      workerId,
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
