import { withAdminAuth, http } from "@/lib/server/route-helpers";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

export const GET = withAdminAuth(async (req, { user }) => {
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

export const POST = withAdminAuth(async (req, { user }) => {
  const body = (await req.json()) as {
    action?: "update" | "publish";
    version?: number;
    systemBaseline?: string;
    globalPolicy?: string;
    styleGuide?: string;
    forbiddenRules?: string;
    note?: string;
  };

  const release = await new AdminAiControlPlaneStore().saveGlobalPolicyDraft(
    {
      action: body.action,
      version: body.version,
      systemBaseline: body.systemBaseline ?? "",
      globalPolicy: body.globalPolicy ?? "",
      styleGuide: body.styleGuide ?? "",
      forbiddenRules: body.forbiddenRules ?? "",
    },
    user.id,
    body.note,
  );

  return http.created({ item: release });
});

export const DELETE = withAdminAuth(async (req, { user }) => {
  const { searchParams } = new URL(req.url);
  const versionRaw = Number(searchParams.get("version") ?? "");
  if (!Number.isFinite(versionRaw) || versionRaw <= 0) {
    return http.badRequest("version is required");
  }

  await new AdminAiControlPlaneStore().deletePolicyRelease(versionRaw);
  return http.ok({ success: true });
});
