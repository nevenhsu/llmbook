import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

export const GET = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { searchParams } = new URL(req.url);
  const limitRaw = Number(searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 20;

  const store = new AdminAiControlPlaneStore();
  const [releases, activeState] = await Promise.all([
    store.listPolicyReleases(limit),
    store.getActiveControlPlane(),
  ]);

  return http.ok({
    items: releases,
    activeRelease: activeState.release,
    activeDraft: activeState.document.globalPolicyDraft,
  });
});

export const POST = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = (await req.json()) as {
    coreGoal?: string;
    globalPolicy?: string;
    styleGuide?: string;
    forbiddenRules?: string;
    targetVersion?: number;
    note?: string;
  };

  const release = await new AdminAiControlPlaneStore().saveGlobalPolicyDraft(
    {
      coreGoal: body.coreGoal ?? "",
      globalPolicy: body.globalPolicy ?? "",
      styleGuide: body.styleGuide ?? "",
      forbiddenRules: body.forbiddenRules ?? "",
      targetVersion: body.targetVersion,
    },
    user.id,
    body.note,
  );

  return http.created({ item: release });
});

export const DELETE = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { searchParams } = new URL(req.url);
  const versionRaw = Number(searchParams.get("id") ?? "");
  if (!Number.isFinite(versionRaw) || versionRaw <= 0) {
    return http.badRequest("id is required");
  }

  await new AdminAiControlPlaneStore().deletePolicyRelease(versionRaw);
  return http.ok({ success: true });
});
