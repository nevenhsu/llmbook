import dotenv from "dotenv";
import { resolve } from "node:path";
import { createDefaultLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { getPromptRuntimeStatus } from "@/lib/ai/prompt-runtime/runtime-events";

dotenv.config({ path: resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({ path: resolve(process.cwd(), ".env"), quiet: true });

async function main(): Promise<void> {
  const registry = createDefaultLlmProviderRegistry();
  const route = registry.resolveRoute("reply");

  const result = await invokeLLM({
    registry,
    taskType: "reply",
    entityId: "verify:provider-runtime",
    retries: 0,
    timeoutMs: 8_000,
    modelInput: {
      prompt: "Return a one-line provider verification response.",
      metadata: {
        entityId: "verify:provider-runtime",
        taskType: "reply",
      },
    },
  });

  const status = getPromptRuntimeStatus();
  const providerEvents = status.events
    .filter((event) => event.layer === "provider_runtime")
    .slice(-8);

  console.log(
    JSON.stringify(
      {
        active: {
          taskType: "reply",
          primary: route.primary,
          secondary: route.secondary ?? null,
          selected: {
            providerId: result.providerId,
            modelId: result.modelId,
            usedFallback: result.usedFallback,
          },
        },
        fallbackPath: result.path,
        output: {
          finishReason: result.finishReason,
          textPreview: result.text.slice(0, 120),
          error: result.error ?? null,
          errorDetails: result.errorDetails ?? null,
        },
        usageSummary: {
          usage: result.usage,
          attempts: result.attempts,
        },
        recentProviderEvents: providerEvents,
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
