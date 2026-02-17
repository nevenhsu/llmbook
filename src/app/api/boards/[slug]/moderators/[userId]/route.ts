import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isBoardOwner } from "@/lib/board-permissions";

export const runtime = "nodejs";

type ModeratorPermissions = {
  manage_posts: boolean;
  manage_users: boolean;
  manage_settings: boolean;
};

const DEFAULT_MODERATOR_PERMISSIONS: ModeratorPermissions = {
  manage_posts: true,
  manage_users: true,
  manage_settings: false,
};

function sanitizePermissions(
  input: unknown,
  current?: Partial<ModeratorPermissions>,
): ModeratorPermissions | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const source = input as Record<string, unknown>;

  const manage_posts = source.manage_posts;
  const manage_users = source.manage_users;
  const manage_settings = source.manage_settings;

  if (
    typeof manage_posts !== "boolean" ||
    typeof manage_users !== "boolean" ||
    typeof manage_settings !== "boolean"
  ) {
    return null;
  }

  return {
    manage_posts:
      manage_posts ?? current?.manage_posts ?? DEFAULT_MODERATOR_PERMISSIONS.manage_posts,
    manage_users:
      manage_users ?? current?.manage_users ?? DEFAULT_MODERATOR_PERMISSIONS.manage_users,
    manage_settings:
      manage_settings ?? current?.manage_settings ?? DEFAULT_MODERATOR_PERMISSIONS.manage_settings,
  };
}

/**
 * PATCH /api/boards/[slug]/moderators/[userId]
 * Update moderator permissions (owner only)
 */
export async function PATCH(
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

  const isOwner = await isBoardOwner(board.id, user.id);
  if (!isOwner) {
    return new NextResponse("Forbidden: Only board owner can edit moderator permissions", {
      status: 403,
    });
  }

  const { permissions } = await request.json();

  const { data: targetMod, error: targetError } = await supabase
    .from("board_moderators")
    .select("id, role, permissions")
    .eq("board_id", board.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (targetError) {
    return new NextResponse(targetError.message, { status: 400 });
  }

  if (!targetMod) {
    return new NextResponse("Moderator not found", { status: 404 });
  }

  if (targetMod.role === "owner") {
    return new NextResponse("Cannot edit owner permissions", { status: 400 });
  }

  const nextPermissions = sanitizePermissions(
    permissions,
    (targetMod.permissions as Partial<ModeratorPermissions>) || DEFAULT_MODERATOR_PERMISSIONS,
  );

  if (!nextPermissions) {
    return new NextResponse("Invalid permissions payload", { status: 400 });
  }

  const { data: updatedModerator, error: updateError } = await supabase
    .from("board_moderators")
    .update({ permissions: nextPermissions })
    .eq("board_id", board.id)
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
    return new NextResponse(updateError.message, { status: 400 });
  }

  return NextResponse.json(updatedModerator);
}

/**
 * DELETE /api/boards/[slug]/moderators/[userId]
 * Remove a moderator (owner only)
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

  // Get board ID
  const { data: board } = await supabase.from("boards").select("id").eq("slug", slug).single();

  if (!board) {
    return new NextResponse("Board not found", { status: 404 });
  }

  // Check if user is the owner
  const isOwner = await isBoardOwner(board.id, user.id);
  if (!isOwner) {
    return new NextResponse("Forbidden: Only board owner can remove moderators", { status: 403 });
  }

  // Check if target is the owner
  const { data: targetMod } = await supabase
    .from("board_moderators")
    .select("role")
    .eq("board_id", board.id)
    .eq("user_id", userId)
    .single();

  if (targetMod?.role === "owner") {
    return new NextResponse("Cannot remove board owner", { status: 400 });
  }

  // Remove moderator
  const { error } = await supabase
    .from("board_moderators")
    .delete()
    .eq("board_id", board.id)
    .eq("user_id", userId);

  if (error) {
    return new NextResponse(error.message, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
