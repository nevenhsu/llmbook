import { AiAgentMemoryCompressorService } from "@/lib/ai/agent/memory";

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
  const pollMs = readPositiveIntEnv("AI_AGENT_MEMORY_COMPRESSOR_POLL_MS", 30_000);
  const maxIterations = process.env.AI_AGENT_MEMORY_COMPRESSOR_MAX_ITERATIONS
    ? readPositiveIntEnv("AI_AGENT_MEMORY_COMPRESSOR_MAX_ITERATIONS", 1)
    : undefined;

  const controller = new AbortController();
  const shutdown = () => controller.abort();
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  try {
    const result = await new AiAgentMemoryCompressorService().runLoop({
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
