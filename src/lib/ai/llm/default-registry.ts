import { LlmProviderRegistry } from "@/lib/ai/llm/registry";
import { createMockProvider } from "@/lib/ai/llm/providers/mock-provider";
import { createXaiProvider } from "@/lib/ai/llm/providers/xai-provider";
import { createMinimaxProvider } from "@/lib/ai/llm/providers/minimax-provider";
import { loadDecryptedProviderSecrets } from "@/lib/ai/llm/provider-secrets";
import type { LlmTaskType, ProviderRoute } from "@/lib/ai/llm/types";

const DEFAULT_TEXT_PROVIDER_ID = "xai";
const DEFAULT_TEXT_MODEL_ID = "grok-4-1-fast-reasoning";
const DEFAULT_MINIMAX_MODEL_ID = "MiniMax-M2.1";
const DEFAULT_MOCK_MODEL_ID = "mock-fallback";

function buildRoute(taskType: LlmTaskType): ProviderRoute {
  return {
    taskType,
    targets: [{ providerId: DEFAULT_TEXT_PROVIDER_ID, modelId: DEFAULT_TEXT_MODEL_ID }],
  };
}

export function createDefaultLlmProviderRegistry(options?: {
  includeMock?: boolean;
  includeXai?: boolean;
  includeMinimax?: boolean;
}): LlmProviderRegistry {
  const registry = new LlmProviderRegistry({
    defaultRoute: buildRoute("generic").targets[0],
    taskRoutes: {
      reply: buildRoute("reply"),
      vote: buildRoute("vote"),
      dispatch: buildRoute("dispatch"),
      generic: buildRoute("generic"),
    },
  });

  if (options?.includeMock ?? false) {
    registry.register(createMockProvider({ modelId: DEFAULT_MOCK_MODEL_ID }));
  }

  if (options?.includeXai ?? true) {
    registry.register(createXaiProvider({ modelId: DEFAULT_TEXT_MODEL_ID }));
  }

  if (options?.includeMinimax ?? true) {
    registry.register(createMinimaxProvider({ modelId: DEFAULT_MINIMAX_MODEL_ID }));
  }

  return registry;
}

export async function createDbBackedLlmProviderRegistry(options?: {
  includeMock?: boolean;
  includeXai?: boolean;
  includeMinimax?: boolean;
}): Promise<LlmProviderRegistry> {
  const registry = new LlmProviderRegistry({
    defaultRoute: buildRoute("generic").targets[0],
    taskRoutes: {
      reply: buildRoute("reply"),
      vote: buildRoute("vote"),
      dispatch: buildRoute("dispatch"),
      generic: buildRoute("generic"),
    },
  });

  if (options?.includeMock ?? false) {
    registry.register(createMockProvider({ modelId: DEFAULT_MOCK_MODEL_ID }));
  }

  const providerKeys: string[] = [];
  if (options?.includeXai ?? true) {
    providerKeys.push("xai");
  }
  if (options?.includeMinimax ?? true) {
    providerKeys.push("minimax");
  }

  const secretMap = await loadDecryptedProviderSecrets(providerKeys).catch(() => new Map());

  if (options?.includeXai ?? true) {
    registry.register(
      createXaiProvider({
        modelId: DEFAULT_TEXT_MODEL_ID,
        apiKey: secretMap.get("xai")?.apiKey,
      }),
    );
  }

  if (options?.includeMinimax ?? true) {
    registry.register(
      createMinimaxProvider({
        modelId: DEFAULT_MINIMAX_MODEL_ID,
        apiKey: secretMap.get("minimax")?.apiKey,
      }),
    );
  }

  return registry;
}
