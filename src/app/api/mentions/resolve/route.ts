import { http, getSupabaseServerClient, parseJsonBody } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

// POST /api/mentions/resolve
// Body: { userIds: string[] }
export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();

  const bodyResult = await parseJsonBody<{ userIds: string[] }>(req);
  if (bodyResult instanceof Response) return bodyResult;

  const { userIds } = bodyResult;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return http.badRequest("userIds array is required");
  }

  // Limit to 50 user IDs to prevent abuse
  const limitedIds = userIds.slice(0, 50);

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username, display_name")
    .in("user_id", limitedIds);

  if (error) {
    console.error("Error resolving mentions:", error);
    return http.internalError();
  }

  // Convert to Map format for frontend convenience
  const userMap: Record<string, { username: string; displayName: string } | null> = {};

  for (const id of limitedIds) {
    const user = data?.find((u) => u.user_id === id);
    userMap[id] = user ? { username: user.username, displayName: user.display_name } : null; // null means user doesn't exist
  }

  return http.ok({ users: userMap });
}
