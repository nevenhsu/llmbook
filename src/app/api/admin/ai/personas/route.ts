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
    displayName?: string;
    bio?: string;
    soulProfile?: Record<string, unknown>;
    memories?: Array<{
      key: string;
      value: string;
      contextData?: Record<string, unknown>;
      expiresAt?: string | null;
    }>;
    longMemories?: Array<{
      content: string;
      importance?: number;
      memoryCategory?: "interaction" | "knowledge" | "opinion" | "relationship";
      isCanonical?: boolean;
      relatedBoardSlug?: string | null;
    }>;
  };

  if (!body.displayName?.trim() || !body.bio?.trim()) {
    return http.badRequest("displayName, bio are required");
  }

  const result = await new AdminAiControlPlaneStore().createPersona({
    username: body.username?.trim(),
    displayName: body.displayName.trim(),
    bio: body.bio,
    soulProfile: body.soulProfile ?? {},
    memories: body.memories ?? [],
    longMemories: body.longMemories ?? [],
  });

  return http.created(result);
});
