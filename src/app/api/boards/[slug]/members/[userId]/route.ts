import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canManageBoardUsers, isBoardModerator } from "@/lib/board-permissions";

export const runtime = "nodejs";

/**
 * DELETE /api/boards/[slug]/members/[userId]
 * Kick a member from board (owner/managers only)
 *
 * Note: RLS policy "Moderators can remove members" allows this operation
 * Database trigger automatically updates member_count
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string; userId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { slug, userId } = await context.params;

  const { data: board } = await supabase.from("boards").select("id").eq("slug", slug).single();

  if (!board) {
    return new NextResponse("Board not found", { status: 404 });
  }

  // Verify permissions (redundant with RLS but good for explicit error messages)
  const canManageUsers = await canManageBoardUsers(board.id, user.id);
  if (!canManageUsers) {
    return new NextResponse("Forbidden: Only owner or managers can kick members", { status: 403 });
  }

  // Check if target is a moderator (RLS policy also prevents this)
  const isTargetMod = await isBoardModerator(board.id, userId);
  if (isTargetMod) {
    return new NextResponse("Cannot kick moderators", { status: 403 });
  }

  // RLS policy allows moderators to delete members (except other moderators)
  // Trigger automatically updates member_count
  const { error, count } = await supabase
    .from("board_members")
    .delete({ count: "exact" })
    .eq("board_id", board.id)
    .eq("user_id", userId);

  if (error) {
    // Do not leak internal error details to clients; log for auditing
    console.error("Error removing board member", { boardId: board.id, userId }, error);
    return new NextResponse("Failed to remove member", { status: 500 });
  }

  if (!count) {
    return new NextResponse("Member not found", { status: 404 });
  }

  return NextResponse.json({ success: true });
}
