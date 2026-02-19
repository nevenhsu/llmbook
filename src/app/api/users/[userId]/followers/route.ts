import { getSupabaseServerClient, http } from "@/lib/server/route-helpers";
import { getUserList } from "@/lib/api/user-list";

export const runtime = "nodejs";

/**
 * GET /api/users/[userId]/followers
 * 
 * Fetch the list of users who follow a specific user.
 * Supports pagination and search filtering.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const { searchParams } = new URL(req.url);

  const supabase = await getSupabaseServerClient();

  // Verify target user exists
  const { data: targetUser } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!targetUser) {
    return http.notFound("User not found");
  }

  // Get current user for follow status
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch followers using shared logic
  try {
    const result = await getUserList(userId, "followers", {
      cursor: searchParams.get("cursor") || undefined,
      search: searchParams.get("search") || undefined,
      limit: Number.parseInt(searchParams.get("limit") || "20", 10),
      currentUserId: user?.id,
    });

    return http.ok(result);
  } catch (error) {
    console.error("Error fetching followers:", error);
    return http.internalError();
  }
}
