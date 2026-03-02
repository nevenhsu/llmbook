import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AdminAiControlPlaneStore, type ModelRouteScope } from "@/lib/ai/admin/control-plane-store";
import { getRouteModelIdsFromActiveOrder } from "@/lib/ai/admin/active-model-order";

const ALLOWED_SCOPES: ModelRouteScope[] = ["global_default", "image"];
const CAPABILITY_SCOPES: Array<{
  scope: ModelRouteScope;
  outputType: "text" | "image";
  usedByTasks: string[];
}> = [
  {
    scope: "global_default",
    outputType: "text",
    usedByTasks: ["post", "comment", "poll", "vote", "persona_generation"],
  },
  {
    scope: "image",
    outputType: "image",
    usedByTasks: ["post", "comment"],
  },
];

export const GET = withAuth(async (_req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const store = new AdminAiControlPlaneStore();
  const state = await store.getActiveControlPlane();
  const textModelIds = getRouteModelIdsFromActiveOrder({
    providers: state.document.providers.map((provider) => ({
      id: provider.id,
      providerKey: provider.providerKey,
      status: provider.status,
      hasKey: provider.hasKey,
    })),
    models: state.document.models.map((model) => ({
      id: model.id,
      providerId: model.providerId,
      modelKey: model.modelKey,
      capability: model.capability,
      status: model.status,
      testStatus: model.testStatus,
      lifecycleStatus: model.lifecycleStatus,
      displayOrder: model.displayOrder,
    })),
    capability: "text_generation",
  });
  const imageModelIds = getRouteModelIdsFromActiveOrder({
    providers: state.document.providers.map((provider) => ({
      id: provider.id,
      providerKey: provider.providerKey,
      status: provider.status,
      hasKey: provider.hasKey,
    })),
    models: state.document.models.map((model) => ({
      id: model.id,
      providerId: model.providerId,
      modelKey: model.modelKey,
      capability: model.capability,
      status: model.status,
      testStatus: model.testStatus,
      lifecycleStatus: model.lifecycleStatus,
      displayOrder: model.displayOrder,
    })),
    capability: "image_generation",
  });
  const now = new Date().toISOString();
  const routeByScope = new Map(state.document.routes.map((route) => [route.scope, route]));
  const derivedItems = CAPABILITY_SCOPES.map((capabilityRoute) => {
    const { scope } = capabilityRoute;
    const existing = routeByScope.get(scope);
    const source = scope === "image" ? imageModelIds : textModelIds;
    return {
      scope,
      outputType: capabilityRoute.outputType,
      usedByTasks: capabilityRoute.usedByTasks,
      orderedModelIds: source,
      updatedAt: existing?.updatedAt ?? now,
    };
  });

  return http.ok({
    items: derivedItems,
    defaults: derivedItems.find((item) => item.outputType === "text") ?? null,
    taskCapabilityMap: {
      post: ["text", "image"],
      comment: ["text", "image"],
      poll: ["text"],
      vote: ["text"],
      persona_generation: ["text"],
    },
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
      orderedModelIds?: string[];
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
      orderedModelIds: Array.isArray(route.orderedModelIds) ? route.orderedModelIds : [],
    })),
    user.id,
  );

  return http.ok({ items });
});
