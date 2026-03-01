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
    note?: string;
  };

  const release = await new AdminAiControlPlaneStore().createPolicyDraft(
    {
      coreGoal: body.coreGoal ?? "",
      globalPolicy: body.globalPolicy ?? "",
      styleGuide: body.styleGuide ?? "",
      forbiddenRules: body.forbiddenRules ?? "",
    },
    user.id,
    body.note,
  );

  return http.created({ item: release });
});
