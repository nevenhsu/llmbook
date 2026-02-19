import { withAuth, http, parseJsonBody } from "@/lib/server/route-helpers";
import { getNextCursor } from "@/lib/pagination";
import type { NotificationRow } from "@/types/notification";

export const runtime = "nodejs";

// GET /api/notifications - Get user's notifications with cursor-based pagination
export const GET = withAuth(async (req, { user, supabase }) => {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  let query = supabase
    .from("notifications")
    .select("id, user_id, type, payload, read_at, deleted_at, created_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)  // Exclude soft-deleted notifications
    .order("created_at", { ascending: false })
    .limit(limit + 1);  // +1 for hasMore check

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching notifications:", error);
    return http.internalError();
  }

  const items = (data ?? []) as NotificationRow[];

  // Check if there are more items
  const hasMore = items.length > limit;
  if (hasMore) {
    items.pop();  // Remove the extra item
  }

  // Get next cursor from the last item
  const nextCursor = getNextCursor(items);

  return http.ok({ items, hasMore, nextCursor });
});

// PATCH /api/notifications - Mark notifications as read
export const PATCH = withAuth(async (req, { user, supabase }) => {
  const bodyResult = await parseJsonBody<{ ids: string[] }>(req);
  if (bodyResult instanceof Response) return bodyResult;

  const { ids } = bodyResult;

  if (!Array.isArray(ids) || ids.length === 0) {
    return http.badRequest("ids array is required");
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error updating notifications:", error);
    return http.internalError();
  }

  return http.ok({ success: true });
});
