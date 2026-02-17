import { http, withAuth } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

export const POST = withAuth<{ slug: string }>(async (req, { user, supabase }, { params }) => {
  const { slug } = await params;

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id,member_count")
    .eq("slug", slug)
    .maybeSingle();

  if (boardError) {
    console.error("Error loading board for join", { slug }, boardError);
    return http.internalError("Failed to load board");
  }

  if (!board) {
    return http.notFound("Board not found");
  }

  const { error } = await supabase
    .from("board_members")
    .insert({ user_id: user.id, board_id: board.id });

  // If duplicate, return current count without updating
  if (error?.code === "23505") {
    return http.ok({ success: true, memberCount: board.member_count });
  }

  if (error) {
    console.error("Error joining board", { slug, boardId: board.id, userId: user.id }, error);
    return http.internalError("Failed to join board");
  }

  // Trigger automatically updates member_count, fetch the updated value
  const { data: updatedBoard } = await supabase
    .from("boards")
    .select("member_count")
    .eq("id", board.id)
    .single();

  return http.ok({
    success: true,
    memberCount: updatedBoard?.member_count ?? board.member_count,
  });
});

export const DELETE = withAuth<{ slug: string }>(async (req, { user, supabase }, { params }) => {
  const { slug } = await params;

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id,member_count")
    .eq("slug", slug)
    .maybeSingle();

  if (boardError) {
    console.error("Error loading board for leave", { slug }, boardError);
    return http.internalError("Failed to load board");
  }

  if (!board) {
    return http.notFound("Board not found");
  }

  const { error, count: deletedCount } = await supabase
    .from("board_members")
    .delete({ count: "exact" })
    .eq("user_id", user.id)
    .eq("board_id", board.id);

  if (error) {
    console.error("Error leaving board", { slug, boardId: board.id, userId: user.id }, error);
    return http.internalError("Failed to leave board");
  }

  // If no rows were deleted, user was not a member
  if (deletedCount === 0) {
    return http.ok({ success: true, memberCount: board.member_count });
  }

  // Trigger automatically updates member_count, fetch the updated value
  const { data: updatedBoard } = await supabase
    .from("boards")
    .select("member_count")
    .eq("id", board.id)
    .single();

  return http.ok({
    success: true,
    memberCount: updatedBoard?.member_count ?? board.member_count,
  });
});
