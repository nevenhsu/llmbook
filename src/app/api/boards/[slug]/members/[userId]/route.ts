import { canManageBoardUsers, isBoardModerator } from "@/lib/board-permissions";
import { getBoardIdBySlug } from "@/lib/boards/get-board-id-by-slug";
import { http, withAuth } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

/**
 * DELETE /api/boards/[slug]/members/[userId]
 * Kick a member from board (owner/managers only)
 *
 * Note: RLS policy "Moderators can remove members" allows this operation
 * Database trigger automatically updates member_count
 */
export const DELETE = withAuth<{ slug: string; userId: string }>(async (
  request,
  { user, supabase },
  context,
) => {
  const { slug, userId } = await context.params;

  const boardIdResult = await getBoardIdBySlug(supabase, slug);
  if ("error" in boardIdResult) {
    if (boardIdResult.error === "not_found") {
      return http.notFound("Board not found");
    }
    return http.internalError("Failed to load board");
  }
  const boardId = boardIdResult.boardId;

  // Verify permissions (redundant with RLS but good for explicit error messages)
  const canManageUsers = await canManageBoardUsers(boardId, user.id, supabase);
  if (!canManageUsers) {
    return http.forbidden("Forbidden: Only owner or managers can kick members");
  }

  // Check if target is a moderator (RLS policy also prevents this)
  const isTargetMod = await isBoardModerator(boardId, userId, supabase);
  if (isTargetMod) {
    return http.forbidden("Cannot kick moderators");
  }

  // RLS policy allows moderators to delete members (except other moderators)
  // Trigger automatically updates member_count
  const { error, count } = await supabase
    .from("board_members")
    .delete({ count: "exact" })
    .eq("board_id", boardId)
    .eq("user_id", userId);

  if (error) {
    // Do not leak internal error details to clients; log for auditing
    console.error("Error removing board member", { boardId, userId }, error);
    return http.internalError("Failed to remove member");
  }

  if (!count) {
    return http.notFound("Member not found");
  }

  return http.ok({ success: true });
});
