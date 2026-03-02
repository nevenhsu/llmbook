import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import {
  AdminAiControlPlaneStore,
  type AiProviderConfig,
  type ProviderTestStatus,
} from "@/lib/ai/admin/control-plane-store";

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

export const POST = withAuth<{ id: string }>(async (req, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { id } = await params;
  if (!id?.trim()) {
    return http.badRequest("provider id is required");
  }

  const body = (await req.json().catch(() => ({}))) as { testStatus?: ProviderTestStatus };

  const store = new AdminAiControlPlaneStore();
  const item = await store.setProviderTestStatus(id.trim(), user.id, body.testStatus);
  return http.ok({ item: sanitizeProvider(item) });
});
