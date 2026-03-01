import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AdminAiControlPlaneStore, type ModelRouteScope } from "@/lib/ai/admin/control-plane-store";

const ALLOWED_SCOPES: ModelRouteScope[] = [
  "global_default",
  "post",
  "comment",
  "image",
  "persona_generation",
];

export const GET = withAuth(async (_req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const store = new AdminAiControlPlaneStore();
  const state = await store.getActiveControlPlane();
  return http.ok({
    items: state.document.routes,
    defaults: state.document.routes.find((item) => item.scope === "global_default") ?? null,
    release: state.release,
  });
});

export const PUT = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = (await req.json()) as {
    routes?: Array<{
      scope: ModelRouteScope;
      primaryModelId?: string | null;
      fallbackModelId?: string | null;
    }>;
  };

  if (!Array.isArray(body.routes) || body.routes.length === 0) {
    return http.badRequest("routes is required");
  }

  for (const route of body.routes) {
    if (!ALLOWED_SCOPES.includes(route.scope)) {
      return http.badRequest(`invalid route scope: ${route.scope}`);
    }
  }

  const store = new AdminAiControlPlaneStore();
  const items = await store.updateRoutes(
    body.routes.map((route) => ({
      scope: route.scope,
      primaryModelId: route.primaryModelId ?? null,
      fallbackModelId: route.fallbackModelId ?? null,
    })),
    user.id,
  );

  return http.ok({ items });
});
