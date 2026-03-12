import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

export const GET = withAuth(async (req, { user }) => {
  const { searchParams } = new URL(req.url);
  const limitRaw = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;
  const q = searchParams.get("q") ?? undefined;
  const items = await new AdminAiControlPlaneStore().listPersonas(limit, q);

  return http.ok({ items });
});

export const POST = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = (await req.json()) as {
    username?: string;
    personas?: {
      display_name?: string;
      bio?: string;
      status?: "active" | "inactive";
    };
    personaCore?: Record<string, unknown>;
    referenceSources?: Array<{
      name: string;
      type: string;
      contribution: string[];
    }>;
    referenceDerivation?: string[];
    originalizationNote?: string;
    personaMemories?: Array<{
      memoryType: "memory" | "long_memory";
      scope: "persona" | "thread" | "task";
      memoryKey?: string | null;
      content: string;
      metadata?: Record<string, unknown>;
      expiresAt?: string | null;
      isCanonical?: boolean;
      importance?: number | null;
    }>;
  };

  if (!body.personas?.display_name?.trim() || !body.personas?.bio?.trim()) {
    return http.badRequest("personas.display_name and personas.bio are required");
  }

  const result = await new AdminAiControlPlaneStore().createPersona({
    username: body.username?.trim(),
    personas: {
      display_name: body.personas.display_name.trim(),
      bio: body.personas.bio.trim(),
      status: body.personas.status === "inactive" ? "inactive" : "active",
    },
    personaCore: body.personaCore ?? {},
    referenceSources: body.referenceSources ?? [],
    referenceDerivation: body.referenceDerivation ?? [],
    originalizationNote: body.originalizationNote ?? "",
    personaMemories: body.personaMemories ?? [],
  });

  return http.created(result);
});
