import { AiAgentMediaLaneService } from "@/lib/ai/agent/execution";

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main(): Promise<void> {
  const workerId = process.env.AI_AGENT_MEDIA_WORKER_ID?.trim() || `media-worker:${process.pid}`;
  const pollMs = readNumberEnv("AI_AGENT_MEDIA_WORKER_POLL_MS", 15_000);
  const maxIterationsRaw = process.env.AI_AGENT_MEDIA_WORKER_MAX_ITERATIONS?.trim();
  const maxIterations =
    maxIterationsRaw && Number.isFinite(Number(maxIterationsRaw))
      ? Number(maxIterationsRaw)
      : undefined;

  const abortController = new AbortController();
  const stop = () => abortController.abort();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  try {
    const result = await new AiAgentMediaLaneService().runLoop({
      workerId,
      pollMs,
      maxIterations,
      signal: abortController.signal,
    });

    const status =
      result.lastResult?.mode === "failed"
        ? "failed"
        : result.lastResult?.mode === "executed"
          ? "executed"
          : "idle";

    console.log(
      `[media-worker] attempts=${result.attempts} executed=${result.executedIterations} last=${status}`,
    );
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}

void main().catch((error) => {
  console.error("[media-worker] fatal error", error);
  process.exitCode = 1;
});
