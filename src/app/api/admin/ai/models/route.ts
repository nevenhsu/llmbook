import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AdminAiControlPlaneStore, type ModelCapability } from "@/lib/ai/admin/control-plane-store";

function bad(message: string) {
  return http.badRequest(message);
}

export const GET = withAuth(async (_req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const store = new AdminAiControlPlaneStore();
  const state = await store.getActiveControlPlane();
  return http.ok({ items: state.document.models, release: state.release });
});

export const POST = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = (await req.json()) as {
    providerId?: string;
    modelKey?: string;
    displayName?: string;
    capability?: ModelCapability;
    status?: "active" | "disabled";
    supportsInput?: boolean;
    supportsImageInputPrompt?: boolean;
    supportsOutput?: boolean;
    contextWindow?: number;
    maxOutputTokens?: number;
    metadata?: Record<string, unknown>;
    testStatus?: "untested" | "success" | "failed";
    lifecycleStatus?: "active" | "retired";
    displayOrder?: number;
    lastErrorKind?: "provider_api" | "model_retired" | "other" | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    lastErrorAt?: string | null;
  };

  if (!body.providerId?.trim() || !body.modelKey?.trim() || !body.displayName?.trim()) {
    return bad("providerId, modelKey, displayName are required");
  }
  if (body.capability !== "text_generation" && body.capability !== "image_generation") {
    return bad("capability must be text_generation or image_generation");
  }

  const store = new AdminAiControlPlaneStore();
  const item = await store.upsertModel(
    {
      providerId: body.providerId.trim(),
      modelKey: body.modelKey.trim(),
      displayName: body.displayName.trim(),
      capability: body.capability,
      status: body.status,
      supportsInput: body.supportsInput,
      supportsImageInputPrompt: body.supportsImageInputPrompt,
      supportsOutput: body.supportsOutput,
      contextWindow: body.contextWindow,
      maxOutputTokens: body.maxOutputTokens,
      metadata: body.metadata,
      testStatus: body.testStatus,
      lifecycleStatus: body.lifecycleStatus,
      displayOrder: body.displayOrder,
      lastErrorKind: body.lastErrorKind ?? undefined,
      lastErrorCode: body.lastErrorCode ?? undefined,
      lastErrorMessage: body.lastErrorMessage ?? undefined,
      lastErrorAt: body.lastErrorAt ?? undefined,
    },
    user.id,
  );

  return http.created({ item });
});

export const PATCH = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = (await req.json()) as {
    id?: string;
    providerId?: string;
    modelKey?: string;
    displayName?: string;
    capability?: ModelCapability;
    status?: "active" | "disabled";
    supportsInput?: boolean;
    supportsImageInputPrompt?: boolean;
    supportsOutput?: boolean;
    contextWindow?: number;
    maxOutputTokens?: number;
    metadata?: Record<string, unknown>;
    testStatus?: "untested" | "success" | "failed";
    lifecycleStatus?: "active" | "retired";
    displayOrder?: number;
    lastErrorKind?: "provider_api" | "model_retired" | "other" | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    lastErrorAt?: string | null;
  };

  if (!body.id?.trim()) {
    return bad("id is required");
  }
  if (!body.providerId?.trim() || !body.modelKey?.trim() || !body.displayName?.trim()) {
    return bad("providerId, modelKey, displayName are required");
  }
  if (body.capability !== "text_generation" && body.capability !== "image_generation") {
    return bad("capability must be text_generation or image_generation");
  }

  const store = new AdminAiControlPlaneStore();
  const item = await store.upsertModel(
    {
      id: body.id.trim(),
      providerId: body.providerId.trim(),
      modelKey: body.modelKey.trim(),
      displayName: body.displayName.trim(),
      capability: body.capability,
      status: body.status,
      supportsInput: body.supportsInput,
      supportsImageInputPrompt: body.supportsImageInputPrompt,
      supportsOutput: body.supportsOutput,
      contextWindow: body.contextWindow,
      maxOutputTokens: body.maxOutputTokens,
      metadata: body.metadata,
      testStatus: body.testStatus,
      lifecycleStatus: body.lifecycleStatus,
      displayOrder: body.displayOrder,
      lastErrorKind: body.lastErrorKind ?? undefined,
      lastErrorCode: body.lastErrorCode ?? undefined,
      lastErrorMessage: body.lastErrorMessage ?? undefined,
      lastErrorAt: body.lastErrorAt ?? undefined,
    },
    user.id,
  );

  return http.ok({ item });
});

export const DELETE = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return bad("id is required");
  }

  const store = new AdminAiControlPlaneStore();
  await store.deleteModel(id, user.id);
  return http.ok({ success: true });
});

export const PUT = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = (await req.json()) as {
    capability?: ModelCapability;
    orderedModelKeys?: string[];
  };

  if (body.capability !== "text_generation" && body.capability !== "image_generation") {
    return bad("capability must be text_generation or image_generation");
  }
  if (!Array.isArray(body.orderedModelKeys)) {
    return bad("orderedModelKeys is required");
  }

  const store = new AdminAiControlPlaneStore();
  const result = await store.reorderModels({
    capability: body.capability,
    orderedModelKeys: body.orderedModelKeys.map((key) => String(key).trim()).filter(Boolean),
    actorId: user.id,
  });

  return http.ok({ items: result.models, routes: result.routes });
});
