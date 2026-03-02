export type ActiveOrderProvider = {
  id: string;
  providerKey: string;
  status: "active" | "disabled";
  hasKey: boolean;
};

export type ActiveOrderModel = {
  id: string;
  providerId: string;
  modelKey: string;
  capability: "text_generation" | "image_generation";
  status: "active" | "disabled";
  testStatus?: "untested" | "success" | "failed";
  displayOrder?: number | null;
  lifecycleStatus?: "active" | "retired";
  supportsImageInputPrompt?: boolean;
};
export type PromptModality = "text_only" | "text_image";

function readDisplayOrder(model: ActiveOrderModel): number {
  return typeof model.displayOrder === "number" && Number.isFinite(model.displayOrder)
    ? model.displayOrder
    : 999;
}

function readTestStatus(model: ActiveOrderModel): "untested" | "success" | "failed" {
  return model.testStatus === "success" || model.testStatus === "failed"
    ? model.testStatus
    : "untested";
}

function readLifecycleStatus(model: ActiveOrderModel): "active" | "retired" {
  return model.lifecycleStatus === "retired" ? "retired" : "active";
}

export function getActiveOrderedModels(input: {
  providers: ActiveOrderProvider[];
  models: ActiveOrderModel[];
  capability: "text_generation" | "image_generation";
  promptModality?: PromptModality;
}): ActiveOrderModel[] {
  return input.models
    .filter((model) => model.capability === input.capability && model.status === "active")
    .filter((model) =>
      input.promptModality === "text_image" ? model.supportsImageInputPrompt === true : true,
    )
    .filter((model) => readLifecycleStatus(model) !== "retired")
    .filter((model) => readTestStatus(model) === "success")
    .filter((model) => {
      const provider = input.providers.find((item) => item.id === model.providerId);
      return Boolean(provider && provider.status === "active" && provider.hasKey);
    })
    .sort((a, b) => {
      const orderGap = readDisplayOrder(a) - readDisplayOrder(b);
      if (orderGap !== 0) {
        return orderGap;
      }
      return a.modelKey.localeCompare(b.modelKey);
    });
}

export function getRouteModelIdsFromActiveOrder(input: {
  providers: ActiveOrderProvider[];
  models: ActiveOrderModel[];
  capability: "text_generation" | "image_generation";
  promptModality?: PromptModality;
}): string[] {
  return getActiveOrderedModels(input).map((model) => model.id);
}

export function getRouteTargetsFromActiveOrder(input: {
  providers: ActiveOrderProvider[];
  models: ActiveOrderModel[];
  capability: "text_generation" | "image_generation";
  promptModality?: PromptModality;
}): Array<{ providerId: string; modelId: string }> {
  const providerById = new Map(input.providers.map((provider) => [provider.id, provider]));
  return getActiveOrderedModels(input)
    .map((model) => {
      const provider = providerById.get(model.providerId);
      if (!provider) {
        return null;
      }
      return {
        providerId: provider.providerKey,
        modelId: model.modelKey,
      };
    })
    .filter((item): item is { providerId: string; modelId: string } => item !== null);
}
