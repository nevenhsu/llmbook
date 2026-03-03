import { createAdminClient } from "@/lib/supabase/admin";
import type { PromptModality } from "@/lib/ai/admin/active-model-order";
import {
  getRouteModelIdsFromActiveOrder,
  getRouteTargetsFromActiveOrder,
  type ActiveOrderModel,
  type ActiveOrderProvider,
} from "@/lib/ai/admin/active-model-order";
import { listProviderSecretStatuses } from "@/lib/ai/llm/provider-secrets";

type InventoryCapability = "text_generation" | "image_generation";

function asString(input: unknown): string | undefined {
  if (typeof input !== "string") {
    return undefined;
  }
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asNumber(input: unknown): number | undefined {
  return typeof input === "number" && Number.isFinite(input) ? input : undefined;
}

export function toActiveOrderProviders<
  T extends {
    id: string;
    providerKey: string;
    status: "active" | "disabled";
    hasKey: boolean;
  },
>(providers: T[]): ActiveOrderProvider[] {
  return providers.map((provider) => ({
    id: provider.id,
    providerKey: provider.providerKey,
    status: provider.status,
    hasKey: provider.hasKey,
  }));
}

export function toActiveOrderModels<
  T extends {
    id: string;
    providerId: string;
    modelKey: string;
    capability: "text_generation" | "image_generation";
    status: "active" | "disabled";
    testStatus?: "untested" | "success" | "failed";
    lifecycleStatus?: "active" | "retired";
    displayOrder?: number | null;
    supportsImageInputPrompt?: boolean;
  },
>(models: T[]): ActiveOrderModel[] {
  return models.map((model) => ({
    id: model.id,
    providerId: model.providerId,
    modelKey: model.modelKey,
    capability: model.capability,
    status: model.status,
    testStatus: model.testStatus,
    lifecycleStatus: model.lifecycleStatus,
    displayOrder: model.displayOrder ?? null,
    supportsImageInputPrompt: model.supportsImageInputPrompt,
  }));
}

export function getOrderedTargetsFromInventory(input: {
  providers: ActiveOrderProvider[];
  models: ActiveOrderModel[];
  capability: InventoryCapability;
  promptModality?: PromptModality;
}): Array<{ providerId: string; modelId: string }> {
  return getRouteTargetsFromActiveOrder(input);
}

export function getOrderedModelIdsFromInventory(input: {
  providers: ActiveOrderProvider[];
  models: ActiveOrderModel[];
  capability: InventoryCapability;
  promptModality?: PromptModality;
}): string[] {
  return getRouteModelIdsFromActiveOrder(input);
}

export async function loadActiveOrderInventoryFromDb(): Promise<{
  providers: ActiveOrderProvider[];
  models: ActiveOrderModel[];
}> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      providers: [],
      models: [],
    };
  }

  const supabase = createAdminClient();
  const [providersRes, modelsRes] = await Promise.all([
    supabase.from("ai_providers").select("id, provider_key, status"),
    supabase
      .from("ai_models")
      .select(
        "id, provider_id, model_key, capability, status, test_status, lifecycle_status, display_order, supports_image_input_prompt",
      ),
  ]);

  if (providersRes.error) {
    throw new Error(`load ai_providers failed: ${providersRes.error.message}`);
  }
  if (modelsRes.error) {
    throw new Error(`load ai_models failed: ${modelsRes.error.message}`);
  }

  const providerKeys = (providersRes.data ?? [])
    .map((item) => asString(item.provider_key) ?? "")
    .filter((item) => item.length > 0);
  const keyStatusMap = await listProviderSecretStatuses(providerKeys);

  const providers: ActiveOrderProvider[] = (providersRes.data ?? [])
    .map((item) => {
      const id = asString(item.id) ?? "";
      const providerKey = asString(item.provider_key) ?? "";
      const status =
        asString(item.status) === "disabled" ? ("disabled" as const) : ("active" as const);
      if (!id || !providerKey) {
        return null;
      }
      const keyStatus = keyStatusMap.get(providerKey);
      return {
        id,
        providerKey,
        status,
        hasKey: keyStatus?.hasKey ?? false,
      };
    })
    .filter((item): item is ActiveOrderProvider => item !== null);

  const models: ActiveOrderModel[] = (modelsRes.data ?? [])
    .map((item) => {
      const id = asString(item.id) ?? "";
      const providerId = asString(item.provider_id) ?? "";
      const modelKey = asString(item.model_key) ?? "";
      if (!id || !providerId || !modelKey) {
        return null;
      }
      return {
        id,
        providerId,
        modelKey,
        capability:
          asString(item.capability) === "image_generation"
            ? ("image_generation" as const)
            : ("text_generation" as const),
        status: asString(item.status) === "disabled" ? ("disabled" as const) : ("active" as const),
        testStatus:
          asString(item.test_status) === "success" || asString(item.test_status) === "failed"
            ? (asString(item.test_status) as "success" | "failed")
            : ("untested" as const),
        lifecycleStatus:
          asString(item.lifecycle_status) === "retired"
            ? ("retired" as const)
            : ("active" as const),
        displayOrder: asNumber(item.display_order) ?? 999,
        supportsImageInputPrompt: item.supports_image_input_prompt === true,
      };
    })
    .filter((item): item is ActiveOrderModel => item !== null);

  return {
    providers,
    models,
  };
}
