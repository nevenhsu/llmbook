import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

export const POST = withAuth<{ version: string }>(async (req, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { version } = await params;
  const releaseVersion = Number(version);
  if (!Number.isFinite(releaseVersion) || releaseVersion <= 0) {
    return http.badRequest("invalid version");
  }

  const body = (await req.json()) as {
    taskContext?: string;
  };

  const preview = await new AdminAiControlPlaneStore().previewGlobalPolicyRelease(
    releaseVersion,
    body.taskContext ?? "",
  );

  return http.ok({ preview });
});
