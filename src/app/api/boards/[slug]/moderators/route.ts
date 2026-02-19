import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isBoardOwner } from "@/lib/board-permissions";
import { DEFAULT_MODERATOR_PERMISSIONS, type ModeratorPermissions } from "@/types/board";
import { getBoardIdBySlug } from "@/lib/boards/get-board-id-by-slug";
import { http, parseJsonBody, withAuth } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

type AddModeratorPayload = {
  user_id?: string;
  role?: string;
  permissions?: Partial<ModeratorPermissions>;
};

/**
 * GET /api/boards/[slug]/moderators
 * Get list of moderators for a board
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient();
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

  // Get moderators with profile info
  const { data: moderators, error } = await supabase
    .from("board_moderators")
    .select(
      `
      id,
      user_id,
      role,
      permissions,
      created_at,
      profiles:user_id (
        display_name,
        avatar_url
      )
    `,
    )
    .eq("board_id", boardId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching moderators", { boardId, slug }, error);
    return http.internalError("Failed to fetch moderators");
  }

  return http.ok(moderators || []);
}

/**
 * POST /api/boards/[slug]/moderators
 * Add a new moderator (owner only)
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

  // Check if user is the owner
  const isOwner = await isBoardOwner(boardId, user.id, supabase);
  if (!isOwner) {
    return http.forbidden("Forbidden: Only board owner can add moderators");
  }

  const body = await parseJsonBody<AddModeratorPayload>(request);
  if (body instanceof NextResponse) {
    return body;
  }

  const { user_id, role, permissions } = body;

  if (!user_id || typeof user_id !== "string") {
    return http.badRequest("Missing or invalid user_id");
  }

  // Default permissions for moderator
  const modPermissions = permissions ? { ...permissions } : { ...DEFAULT_MODERATOR_PERMISSIONS };

  // Don't allow creating another owner
  const modRole = role === "owner" ? "moderator" : role || "moderator";

  // Add moderator
  const { data: newMod, error } = await supabase
    .from("board_moderators")
    .insert({
      board_id: boardId,
      user_id,
      role: modRole,
      permissions: modPermissions,
    })
    .select(
      `
      id,
      user_id,
      role,
      permissions,
      created_at,
      profiles:user_id (
        display_name,
        avatar_url
      )
    `,
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      // Unique violation
      return http.conflict("User is already a moderator");
    }
    console.error("Error adding moderator", { boardId, slug, user_id, role: modRole }, error);
    return http.badRequest("Failed to add moderator");
  }

  return http.created(newMod);
});
