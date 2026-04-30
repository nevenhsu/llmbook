function readEnvOrFallback(key: string, fallback: string): string {
  const raw = process.env[key];
  if (typeof raw !== "string") {
    return fallback;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

const SUPPORTED_PROVIDER_IDS = ["xai", "minimax", "deepseek"] as const;
const SUPPORTED_MODELS_BY_PROVIDER: Record<(typeof SUPPORTED_PROVIDER_IDS)[number], string[]> = {
  xai: ["grok-4-1-fast-reasoning", "grok-imagine-image"],
  minimax: ["MiniMax-M2.5"],
  deepseek: ["deepseek-v4-flash"],
};

export function getDefaultProviderId(): string {
  return readEnvOrFallback("AI_DEFAULT_PROVIDER_ID", "deepseek");
}

export function getDefaultModelId(): string {
  return readEnvOrFallback("AI_DEFAULT_MODEL_ID", "deepseek-v4-flash");
}

export function getDefaultXaiModelId(): string {
  return readEnvOrFallback("AI_DEFAULT_XAI_MODEL_ID", "grok-4-1-fast-reasoning");
}

export function getDefaultMinimaxModelId(): string {
  return readEnvOrFallback("AI_DEFAULT_MINIMAX_MODEL_ID", "MiniMax-M2.5");
}

export function getDefaultDeepSeekModelId(): string {
  return readEnvOrFallback("AI_DEFAULT_DEEPSEEK_MODEL_ID", "deepseek-v4-flash");
}

export function resolveDefaultRuntimeTarget(): { providerId: string; modelId: string } {
  const rawProviderId = getDefaultProviderId();
  const providerId = SUPPORTED_PROVIDER_IDS.includes(
    rawProviderId as (typeof SUPPORTED_PROVIDER_IDS)[number],
  )
    ? (rawProviderId as (typeof SUPPORTED_PROVIDER_IDS)[number])
    : "deepseek";

  const rawModelId = getDefaultModelId();
  const supportedModels = SUPPORTED_MODELS_BY_PROVIDER[providerId];
  const providerDefaultModelId =
    providerId === "xai"
      ? getDefaultXaiModelId()
      : providerId === "minimax"
        ? getDefaultMinimaxModelId()
        : getDefaultDeepSeekModelId();

  if (supportedModels.includes(rawModelId)) {
    return { providerId, modelId: rawModelId };
  }

  if (supportedModels.includes(providerDefaultModelId)) {
    return { providerId, modelId: providerDefaultModelId };
  }

  return {
    providerId,
    modelId:
      providerId === "xai"
        ? "grok-4-1-fast-reasoning"
        : providerId === "minimax"
          ? "MiniMax-M2.5"
          : "deepseek-v4-flash",
  };
}
