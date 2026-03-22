import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-contract";

export function resolvePersonaTextModel(input: {
  modelId: string;
  models: AiModelConfig[];
  providers: AiProviderConfig[];
  featureLabel: string;
}): { model: AiModelConfig; provider: AiProviderConfig } {
  const model = input.models.find((item) => item.id === input.modelId);
  if (!model) {
    throw new Error("model not found");
  }
  if (
    model.capability !== "text_generation" ||
    model.status !== "active" ||
    model.lifecycleStatus === "retired" ||
    model.testStatus !== "success"
  ) {
    throw new Error(`model is not eligible for ${input.featureLabel}`);
  }
  const provider = input.providers.find((item) => item.id === model.providerId);
  if (!provider) {
    throw new Error("provider not found for model");
  }
  if (!provider.hasKey) {
    throw new Error("provider for this model is missing API key");
  }
  return { model, provider };
}
