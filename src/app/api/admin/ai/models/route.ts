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
    supportsOutput?: boolean;
    contextWindow?: number;
    maxOutputTokens?: number;
    metadata?: Record<string, unknown>;
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
      supportsOutput: body.supportsOutput,
      contextWindow: body.contextWindow,
      maxOutputTokens: body.maxOutputTokens,
      metadata: body.metadata,
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
    supportsOutput?: boolean;
    contextWindow?: number;
    maxOutputTokens?: number;
    metadata?: Record<string, unknown>;
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
      supportsOutput: body.supportsOutput,
      contextWindow: body.contextWindow,
      maxOutputTokens: body.maxOutputTokens,
      metadata: body.metadata,
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
