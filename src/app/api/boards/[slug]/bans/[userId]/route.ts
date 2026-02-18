import { isBoardModerator } from "@/lib/board-permissions";
import { isAdmin } from "@/lib/admin";
import { getBoardIdBySlug } from "@/lib/boards/get-board-id-by-slug";
import { http, withAuth } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

/**
 * DELETE /api/boards/[slug]/bans/[userId]
 * Unban a user (moderators only)
 */
export const DELETE = withAuth<{ slug: string; userId: string }>(async (
  request,
  { user, supabase },
  context,
) => {
  const { slug, userId } = await context.params;

  // Get board ID
  const boardIdResult = await getBoardIdBySlug(supabase, slug);
  if ("error" in boardIdResult) {
    if (boardIdResult.error === "not_found") {
      return http.notFound("Board not found");
    }
    return http.internalError("Failed to load board");
  }
  const boardId = boardIdResult.boardId;

  const [userIsAdmin, userIsModerator] = await Promise.all([
    isAdmin(user.id, supabase),
    isBoardModerator(boardId, user.id, supabase),
  ]);

  if (!userIsAdmin && !userIsModerator) {
    return http.forbidden("Forbidden: Only admins or moderators can edit bans");
  }

  // Remove ban
  const { error } = await supabase
    .from("board_bans")
    .delete()
    .eq("board_id", boardId)
    .eq("user_id", userId);

  if (error) {
    // Do not leak internal error details; log for auditing
    console.error("Error unbanning user", { boardId, userId }, error);
    return http.internalError("Failed to unban user");
  }

  return http.ok({ success: true });
});
