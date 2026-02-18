import { createClient } from "@/lib/supabase/server";
import { isBoardModerator } from "@/lib/board-permissions";
import { isAdmin } from "@/lib/admin";
import { getBoardIdBySlug } from "@/lib/boards/get-board-id-by-slug";
import { http, parseJsonBody, withAuth } from "@/lib/server/route-helpers";
import {
  getOffset,
  getTotalPages,
  parsePageParam,
  parsePerPageParam,
} from "@/lib/board-pagination";

export const runtime = "nodejs";

type CreateBanPayload = {
  user_id?: string;
  reason?: string;
  expires_at?: string;
};

/**
 * GET /api/boards/[slug]/bans
 * Get list of banned users (public)
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const page = parsePageParam(searchParams.get("page"));
  const perPage = parsePerPageParam(searchParams.get("perPage"));
  const offset = getOffset(page, perPage);

  const { slug } = await context.params;

  // Get board ID
  const boardIdResult = await getBoardIdBySlug(supabase, slug);
  if ("error" in boardIdResult) {
    if (boardIdResult.error === "not_found") {
      return http.notFound("Board not found");
    }
    return http.internalError("Failed to load board");
  }
  const boardId = boardIdResult.boardId;

  // Get bans with user profile info
  const {
    data: bans,
    error,
    count,
  } = await supabase
    .from("board_bans")
    .select(
      `
      id,
      user_id,
      banned_by,
      reason,
      expires_at,
      created_at,
      user:user_id (
        display_name,
        avatar_url
      ),
      banned_by_user:banned_by (
        display_name
      )
    `,
      { count: "exact" },
    )
    .eq("board_id", boardId)
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) {
    // Do not leak internal error details to clients; log for auditing
    console.error("Error fetching bans for board", boardId, error);
    return http.internalError("Failed to fetch bans");
  }

  const total = count || 0;
  const totalPages = getTotalPages(total, perPage);

  return http.ok({
    items: bans || [],
    page,
    perPage,
    total,
    totalPages,
  });
}

/**
 * POST /api/boards/[slug]/bans
 * Ban a user from the board (moderators only)
 */
export const POST = withAuth<{ slug: string }>(async (request, { user, supabase }, context) => {
  const { slug } = await context.params;

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

  const body = await parseJsonBody<CreateBanPayload>(request);
  if (body instanceof Response) {
    return body;
  }

  const { user_id, reason, expires_at } = body;

  if (!user_id || typeof user_id !== "string") {
    return http.badRequest("Missing or invalid user_id");
  }

  let normalizedExpiresAt: string | null = null;
  if (expires_at) {
    const parsed = new Date(expires_at);
    if (Number.isNaN(parsed.getTime())) {
      return http.badRequest("Invalid expires_at");
    }
    normalizedExpiresAt = parsed.toISOString();
  }

  // Cannot ban yourself
  if (user_id === user.id) {
    return http.badRequest("Cannot ban yourself");
  }

  // Cannot ban other moderators
  const isTargetMod = await isBoardModerator(boardId, user_id, supabase);
  if (isTargetMod) {
    return http.badRequest("Cannot ban moderators");
  }

  // Create ban
  const { data: ban, error } = await supabase
    .from("board_bans")
    .insert({
      board_id: boardId,
      user_id,
      banned_by: user.id,
      reason: reason || null,
      expires_at: normalizedExpiresAt,
    })
    .select(
      `
      id,
      user_id,
      banned_by,
      reason,
      expires_at,
      created_at,
      user:user_id (
        display_name,
        avatar_url
      )
    `,
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      // Unique violation
      return http.conflict("User is already banned");
    }
    // Do not leak internal error details; log for auditing
    console.error(
      "Error banning user on board",
      { boardId, user_id, reason, expires_at: normalizedExpiresAt },
      error,
    );
    return http.internalError("Failed to ban user");
  }

  return http.created(ban);
});
