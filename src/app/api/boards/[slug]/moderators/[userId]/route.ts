import { isBoardOwner } from "@/lib/board-permissions";
import { getBoardIdBySlug } from "@/lib/boards/get-board-id-by-slug";
import { DEFAULT_MODERATOR_PERMISSIONS, type ModeratorPermissions } from "@/types/board";
import { http, parseJsonBody, withAuth } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

function sanitizePermissions(
  input: unknown,
  current?: Partial<ModeratorPermissions>,
): ModeratorPermissions | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const source = input as Record<string, unknown>;

  const readBool = (
    key: keyof ModeratorPermissions,
  ): { ok: true; value: boolean | undefined } | { ok: false } => {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      return { ok: true, value: undefined };
    }

    const value = source[key];
    if (typeof value !== "boolean") {
      return { ok: false };
    }

    return { ok: true, value };
  };

  const managePosts = readBool("manage_posts");
  const manageUsers = readBool("manage_users");
  const manageSettings = readBool("manage_settings");

  if (!managePosts.ok || !manageUsers.ok || !manageSettings.ok) {
    return null;
  }

  if (
    managePosts.value === undefined &&
    manageUsers.value === undefined &&
    manageSettings.value === undefined
  ) {
    return null;
  }

  return {
    manage_posts:
      managePosts.value ?? current?.manage_posts ?? DEFAULT_MODERATOR_PERMISSIONS.manage_posts,
    manage_users:
      manageUsers.value ?? current?.manage_users ?? DEFAULT_MODERATOR_PERMISSIONS.manage_users,
    manage_settings:
      manageSettings.value ??
      current?.manage_settings ??
      DEFAULT_MODERATOR_PERMISSIONS.manage_settings,
  };
}

/**
 * PATCH /api/boards/[slug]/moderators/[userId]
 * Update moderator permissions (owner only)
 */
export const PATCH = withAuth<{ slug: string; userId: string }>(
  async (request, { user, supabase }, context) => {
    const { slug, userId } = await context.params;

    const boardIdResult = await getBoardIdBySlug(supabase, slug);
    if ("error" in boardIdResult) {
      if (boardIdResult.error === "not_found") {
        return http.notFound("Board not found");
      }
      return http.internalError("Failed to load board");
    }
    const boardId = boardIdResult.boardId;

    const isOwner = await isBoardOwner(boardId, user.id, supabase);
    if (!isOwner) {
      return http.forbidden("Forbidden: Only board owner can edit moderator permissions");
    }

    const body = await parseJsonBody<{ permissions?: unknown }>(request);
    if (body instanceof Response) {
      return body;
    }

    const { permissions } = body;

    const { data: targetMod, error: targetError } = await supabase
      .from("board_moderators")
      .select("id, role, permissions")
      .eq("board_id", boardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (targetError) {
      console.error("Error loading moderator", { boardId, userId }, targetError);
      return http.badRequest("Invalid moderator target");
    }

    if (!targetMod) {
      return http.notFound("Moderator not found");
    }

    if (targetMod.role === "owner") {
      return http.badRequest("Cannot edit owner permissions");
    }

    const nextPermissions = sanitizePermissions(
      permissions,
      (targetMod.permissions as Partial<ModeratorPermissions>) || DEFAULT_MODERATOR_PERMISSIONS,
    );

    if (!nextPermissions) {
      return http.badRequest("Invalid permissions payload");
    }

    const { data: updatedModerator, error: updateError } = await supabase
      .from("board_moderators")
      .update({ permissions: nextPermissions })
      .eq("board_id", boardId)
      .eq("user_id", userId)
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

    if (updateError) {
      console.error("Error updating moderator permissions", { boardId, userId }, updateError);
      return http.badRequest("Failed to update moderator permissions");
    }

    return http.ok(updatedModerator);
  },
);

/**
 * DELETE /api/boards/[slug]/moderators/[userId]
 * Remove a moderator (owner only)
 */
export const DELETE = withAuth<{ slug: string; userId: string }>(
  async (request, { user, supabase }, context) => {
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

    // Check if user is the owner
    const isOwner = await isBoardOwner(boardId, user.id, supabase);
    if (!isOwner) {
      return http.forbidden("Forbidden: Only board owner can remove moderators");
    }

    // Check if target is the owner
    const { data: targetMod } = await supabase
      .from("board_moderators")
      .select("role")
      .eq("board_id", boardId)
      .eq("user_id", userId)
      .single();

    if (targetMod?.role === "owner") {
      return http.badRequest("Cannot remove board owner");
    }

    // Remove moderator
    const { error } = await supabase
      .from("board_moderators")
      .delete()
      .eq("board_id", boardId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error removing moderator", { boardId, userId }, error);
      return http.badRequest("Failed to remove moderator");
    }

    return http.ok({ success: true });
  },
);
