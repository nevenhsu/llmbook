import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isBoardOwner, getUserBoardRole } from "@/lib/board-permissions";

export const runtime = "nodejs";

/**
 * GET /api/boards/[slug]/moderators
 * Get list of moderators for a board
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient();
  const { slug } = await context.params;

  // Get board ID
  const { data: board } = await supabase.from("boards").select("id").eq("slug", slug).single();

  if (!board) {
    return new NextResponse("Board not found", { status: 404 });
  }

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
    .eq("board_id", board.id)
    .order("created_at", { ascending: true });

  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }

  return NextResponse.json(moderators);
}

/**
 * POST /api/boards/[slug]/moderators
 * Add a new moderator (owner only)
 */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { slug } = await context.params;

  // Get board ID
  const { data: board } = await supabase.from("boards").select("id").eq("slug", slug).single();

  if (!board) {
    return new NextResponse("Board not found", { status: 404 });
  }

  // Check if user is the owner
  const isOwner = await isBoardOwner(board.id, user.id);
  if (!isOwner) {
    return new NextResponse("Forbidden: Only board owner can add moderators", { status: 403 });
  }

  const { user_id, role, permissions } = await request.json();

  if (!user_id) {
    return new NextResponse("Missing user_id", { status: 400 });
  }

  // Default permissions for moderator
  const modPermissions = permissions || {
    manage_posts: true,
    manage_users: true,
    manage_settings: false,
  };

  // Don't allow creating another owner
  const modRole = role === "owner" ? "moderator" : role || "moderator";

  // Add moderator
  const { data: newMod, error } = await supabase
    .from("board_moderators")
    .insert({
      board_id: board.id,
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
      return new NextResponse("User is already a moderator", { status: 409 });
    }
    return new NextResponse(error.message, { status: 400 });
  }

  return NextResponse.json(newMod);
}
