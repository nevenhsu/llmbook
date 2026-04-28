import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

export const GET = withAuth<{ id: string }>(async (_req, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { id } = await params;
  if (!id?.trim()) {
    return http.badRequest("persona id is required");
  }

  const profile = await new AdminAiControlPlaneStore().getPersonaProfile(id.trim());
  return http.ok(profile);
});

export const PATCH = withAuth<{ id: string }>(async (req, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { id } = await params;
  if (!id?.trim()) {
    return http.badRequest("persona id is required");
  }

  const body = (await req.json().catch(() => ({}))) as {
    displayName?: string;
    username?: string;
    bio?: string;
    personaCore?: Record<string, unknown>;
    referenceSources?: Array<{
      name: string;
      type: string;
      contribution: string[];
    }>;
    otherReferenceSources?: Array<{
      name: string;
      type: string;
      contribution: string[];
    }>;
    referenceDerivation?: string[];
    originalizationNote?: string;
  };

  await new AdminAiControlPlaneStore().patchPersonaProfile({
    personaId: id.trim(),
    displayName: body.displayName,
    username: body.username,
    bio: body.bio,
    personaCore: body.personaCore,
    referenceSources: body.referenceSources,
    otherReferenceSources: body.otherReferenceSources,
    referenceDerivation: body.referenceDerivation,
    originalizationNote: body.originalizationNote,
  });

  return http.ok({ success: true });
});
