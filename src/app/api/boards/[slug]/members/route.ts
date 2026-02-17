import { createClient } from "@/lib/supabase/server";
import { getBoardIdBySlug } from "@/lib/boards/get-board-id-by-slug";
import { http } from "@/lib/server/route-helpers";
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

  const boardIdResult = await getBoardIdBySlug(supabase, slug);
  if ("error" in boardIdResult) {
    if (boardIdResult.error === "not_found") {
      return http.notFound("Board not found");
    }
    return http.internalError("Failed to load board");
  }
  const boardId = boardIdResult.boardId;

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
    .eq("board_id", boardId)
    .order("joined_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) {
    // Do not leak internal error details to clients; log for auditing
    console.error("Error fetching board members for slug", slug, error);
    return http.internalError("Failed to fetch board members");
  }

  const { data: moderators, error: moderatorsError } = await supabase
    .from("board_moderators")
    .select("user_id, role")
    .eq("board_id", boardId);

  if (moderatorsError) {
    // Do not leak internal error details to clients; log for auditing
    console.error("Error fetching board moderators for board", boardId, moderatorsError);
    return http.internalError("Failed to fetch board moderators");
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

  return http.ok({
    items: normalized,
    page,
    perPage,
    total,
    totalPages,
  });
}
