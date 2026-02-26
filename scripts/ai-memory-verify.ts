import {
  buildRuntimeMemoryContext,
  getRuntimeMemoryProviderStatus,
  type RuntimeTaskType,
} from "@/lib/ai/memory/runtime-memory-context";

function readArg(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index < 0) {
    return undefined;
  }
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function readTaskType(flag: string): RuntimeTaskType {
  const value = readArg(flag);
  if (
    value === "reply" ||
    value === "vote" ||
    value === "post" ||
    value === "comment" ||
    value === "image_post" ||
    value === "poll_post"
  ) {
    return value;
  }
  return "reply";
}

async function main(): Promise<void> {
  const personaId = readArg("--personaId");
  if (!personaId) {
    throw new Error("--personaId is required");
  }

  const taskType = readTaskType("--taskType");
  const threadId = readArg("--threadId");
  const boardId = readArg("--boardId");
  const tolerateFailure = process.argv.includes("--tolerateFailure");

  const context = await buildRuntimeMemoryContext({
    personaId,
    threadId,
    boardId,
    taskType,
    now: new Date(),
    tolerateFailure,
  });

  const status = getRuntimeMemoryProviderStatus();

  console.log(
    JSON.stringify(
      {
        activeMemoryRefs: {
          policyVersion: context.policyRefs.policyVersion,
          communityMemoryVersion: context.memoryRefs.communityMemoryVersion,
          safetyMemoryVersion: context.memoryRefs.safetyMemoryVersion,
        },
        effectiveLoadState: {
          global: status.layers.global,
          persona: status.layers.persona,
          thread: status.layers.thread,
        },
        lastGovernanceEvents: {
          trim: status.lastTrimEvent,
          fallback: status.lastFallbackEvent,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
