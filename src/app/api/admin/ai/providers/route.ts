import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import {
  AdminAiControlPlaneStore,
  type AiProviderConfig,
} from "@/lib/ai/admin/control-plane-store";

function bad(message: string) {
  return http.badRequest(message);
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

export const GET = withAuth(async (_req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const store = new AdminAiControlPlaneStore();
  const state = await store.getActiveControlPlane();
  return http.ok({ items: state.providers.map(sanitizeProvider), release: state.release });
});

export const POST = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = (await req.json()) as {
    providerKey?: string;
    displayName?: string;
    sdkPackage?: string;
    status?: "active" | "disabled";
    apiKey?: string;
  };

  if (!body.providerKey?.trim() || !body.displayName?.trim() || !body.sdkPackage?.trim()) {
    return bad("providerKey, displayName, sdkPackage are required");
  }

  const store = new AdminAiControlPlaneStore();
  const item = await store.upsertProvider(
    {
      providerKey: body.providerKey.trim(),
      displayName: body.displayName.trim(),
      sdkPackage: body.sdkPackage.trim(),
      status: body.status,
      apiKey: body.apiKey,
    },
    user.id,
  );

  return http.created({ item: sanitizeProvider(item) });
});

export const PATCH = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = (await req.json()) as {
    id?: string;
    providerKey?: string;
    displayName?: string;
    sdkPackage?: string;
    status?: "active" | "disabled";
    testStatus?: "untested" | "success" | "failed" | "disabled" | "key_missing";
    apiKey?: string;
  };

  if (
    !body.id?.trim() ||
    !body.providerKey?.trim() ||
    !body.displayName?.trim() ||
    !body.sdkPackage?.trim()
  ) {
    return bad("id, providerKey, displayName, sdkPackage are required");
  }

  const store = new AdminAiControlPlaneStore();
  const item = await store.upsertProvider(
    {
      id: body.id.trim(),
      providerKey: body.providerKey.trim(),
      displayName: body.displayName.trim(),
      sdkPackage: body.sdkPackage.trim(),
      status: body.status,
      testStatus: body.testStatus,
      apiKey: body.apiKey,
    },
    user.id,
  );

  return http.ok({ item: sanitizeProvider(item) });
});
