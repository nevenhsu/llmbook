import { LlmProviderRegistry } from "@/lib/ai/llm/registry";
import { createMockProvider } from "@/lib/ai/llm/providers/mock-provider";
import { createXaiProvider } from "@/lib/ai/llm/providers/xai-provider";
import type { LlmTaskType, ProviderRoute } from "@/lib/ai/llm/types";

function readEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return fallback;
  }
  return value.trim();
}

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return undefined;
  }
  return value.trim();
}

function buildRoute(taskType: LlmTaskType): ProviderRoute {
  const upper = taskType.toUpperCase();
  const primaryProviderId = readEnv(
    `AI_MODEL_${upper}_PROVIDER`,
    readEnv("AI_MODEL_PROVIDER", "xai"),
  );
  const primaryModelId = readEnv(
    `AI_MODEL_${upper}_NAME`,
    readEnv("AI_MODEL_NAME", "grok-4-1-fast-reasoning"),
  );
  const fallbackProviderId =
    readOptionalEnv(`AI_MODEL_${upper}_FALLBACK_PROVIDER`) ??
    readOptionalEnv("AI_MODEL_FALLBACK_PROVIDER");
  const fallbackModelId =
    readOptionalEnv(`AI_MODEL_${upper}_FALLBACK_NAME`) ?? readOptionalEnv("AI_MODEL_FALLBACK_NAME");

  return {
    taskType,
    primary: { providerId: primaryProviderId, modelId: primaryModelId },
    secondary:
      fallbackProviderId && fallbackModelId
        ? { providerId: fallbackProviderId, modelId: fallbackModelId }
        : undefined,
  };
}

export function createDefaultLlmProviderRegistry(options?: {
  includeMock?: boolean;
  includeXai?: boolean;
}): LlmProviderRegistry {
  const registry = new LlmProviderRegistry({
    defaultRoute: buildRoute("generic").primary,
    taskRoutes: {
      reply: buildRoute("reply"),
      vote: buildRoute("vote"),
      dispatch: buildRoute("dispatch"),
      generic: buildRoute("generic"),
    },
  });

  if (options?.includeMock ?? false) {
    registry.register(
      createMockProvider({ modelId: readOptionalEnv("AI_MODEL_FALLBACK_NAME") ?? "mock-fallback" }),
    );
  }

  if (options?.includeXai ?? true) {
    registry.register(
      createXaiProvider({ modelId: readEnv("AI_MODEL_NAME", "grok-4-1-fast-reasoning") }),
    );
  }

  return registry;
}
