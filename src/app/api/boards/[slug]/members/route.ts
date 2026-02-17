import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getOffset,
  getTotalPages,
  parsePageParam,
  parsePerPageParam,
} from "@/lib/board-pagination";

export const runtime = "nodejs";

/**
 * GET /api/boards/[slug]/members
 * Get board members list (public)
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const page = parsePageParam(searchParams.get("page"));
  const perPage = parsePerPageParam(searchParams.get("perPage"));
  const offset = getOffset(page, perPage);

  const { slug } = await context.params;

  const { data: board } = await supabase.from("boards").select("id").eq("slug", slug).single();

  if (!board) {
    return new NextResponse("Board not found", { status: 404 });
  }

  const {
    data: members,
    error,
    count,
  } = await supabase
    .from("board_members")
    .select(
      `
      *,
      profiles:user_id (
        display_name,
        avatar_url
      )
    `,
      { count: "exact" },
    )
    .eq("board_id", board.id)
    .order("joined_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) {
    // Do not leak internal error details to clients; log for auditing
    console.error("Error fetching board members for slug", slug, error);
    return new NextResponse("Failed to fetch board members", { status: 500 });
  }

  const { data: moderators, error: moderatorsError } = await supabase
    .from("board_moderators")
    .select("user_id, role")
    .eq("board_id", board.id);

  if (moderatorsError) {
    // Do not leak internal error details to clients; log for auditing
    console.error("Error fetching board moderators for board", board?.id, moderatorsError);
    return new NextResponse("Failed to fetch board moderators", { status: 500 });
  }

  const moderatorMap = new Map<string, string>();
  for (const mod of moderators || []) {
    moderatorMap.set(mod.user_id, mod.role);
  }

  const normalized = (members || []).map((member: any) => ({
    user_id: member.user_id,
    joined_at: member.created_at ?? member.joined_at ?? null,
    profiles: member.profiles,
    is_moderator: moderatorMap.has(member.user_id),
    moderator_role: moderatorMap.get(member.user_id) || null,
  }));

  const total = count || 0;
  const totalPages = getTotalPages(total, perPage);

  return NextResponse.json({
    items: normalized,
    page,
    perPage,
    total,
    totalPages,
  });
}
