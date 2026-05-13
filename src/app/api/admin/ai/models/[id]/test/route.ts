import { withAdminAuth, http } from "@/lib/server/route-helpers";
import {
  AdminAiControlPlaneStore,
  type AiModelConfig,
  type AiProviderConfig,
} from "@/lib/ai/admin/control-plane-store";

function sanitizeModel(model: AiModelConfig) {
  return {
    id: model.id,
    providerId: model.providerId,
    modelKey: model.modelKey,
    displayName: model.displayName,
    capability: model.capability,
    status: model.status,
    testStatus: model.testStatus,
    lifecycleStatus: model.lifecycleStatus,
    displayOrder: model.displayOrder,
    lastErrorKind: model.lastErrorKind,
    lastErrorCode: model.lastErrorCode,
    lastErrorMessage: model.lastErrorMessage,
    lastErrorAt: model.lastErrorAt,
    supportsInput: model.supportsInput,
    supportsImageInputPrompt: model.supportsImageInputPrompt,
    supportsOutput: model.supportsOutput,
    contextWindow: model.contextWindow,
    maxOutputTokens: model.maxOutputTokens,
    metadata: model.metadata,
    updatedAt: model.updatedAt,
  };
}

function sanitizeProvider(provider: AiProviderConfig) {
  return {
    id: provider.id,
    providerKey: provider.providerKey,
    displayName: provider.displayName,
    sdkPackage: provider.sdkPackage,
    status: provider.status,
    testStatus: provider.testStatus,
    keyLast4: provider.keyLast4,
    hasKey: provider.hasKey,
    lastApiErrorCode: provider.lastApiErrorCode,
    lastApiErrorMessage: provider.lastApiErrorMessage,
    lastApiErrorAt: provider.lastApiErrorAt,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

export const POST = withAdminAuth<{ id: string }>(async (_req, { user }, { params }) => {
  const { id } = await params;
  if (!id?.trim()) {
    return http.badRequest("model id is required");
  }

  const store = new AdminAiControlPlaneStore();
  const result = await store.testModelWithMinimalTokens(id.trim(), user.id);
  return http.ok({
    item: sanitizeModel(result.model),
    provider: sanitizeProvider(result.provider),
    artifact: result.artifact ?? null,
  });
});
