function readEnvOrFallback(key: string, fallback: string): string {
  const raw = process.env[key];
  if (typeof raw !== "string") {
    return fallback;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

const SUPPORTED_PROVIDER_IDS = ["xai", "minimax"] as const;
const SUPPORTED_MODELS_BY_PROVIDER: Record<(typeof SUPPORTED_PROVIDER_IDS)[number], string[]> = {
  xai: ["grok-4-1-fast-reasoning", "grok-imagine-image"],
  minimax: ["MiniMax-M2.1"],
};

export function getDefaultProviderId(): string {
  return readEnvOrFallback("AI_DEFAULT_PROVIDER_ID", "xai");
}

export function getDefaultModelId(): string {
  return readEnvOrFallback("AI_DEFAULT_MODEL_ID", "grok-4-1-fast-reasoning");
}

export function getDefaultXaiModelId(): string {
  return readEnvOrFallback("AI_DEFAULT_XAI_MODEL_ID", "grok-4-1-fast-reasoning");
}

export function getDefaultMinimaxModelId(): string {
  return readEnvOrFallback("AI_DEFAULT_MINIMAX_MODEL_ID", "MiniMax-M2.1");
}

export function resolveDefaultRuntimeTarget(): { providerId: string; modelId: string } {
  const rawProviderId = getDefaultProviderId();
  const providerId = SUPPORTED_PROVIDER_IDS.includes(rawProviderId as "xai" | "minimax")
    ? (rawProviderId as "xai" | "minimax")
    : "xai";

  const rawModelId = getDefaultModelId();
  const supportedModels = SUPPORTED_MODELS_BY_PROVIDER[providerId];
  const providerDefaultModelId =
    providerId === "xai" ? getDefaultXaiModelId() : getDefaultMinimaxModelId();

  if (supportedModels.includes(rawModelId)) {
    return { providerId, modelId: rawModelId };
  }

  if (supportedModels.includes(providerDefaultModelId)) {
    return { providerId, modelId: providerDefaultModelId };
  }

  return {
    providerId,
    modelId: providerId === "xai" ? "grok-4-1-fast-reasoning" : "MiniMax-M2.1",
  };
}
