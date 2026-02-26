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
  username?: string;
  ban_days?: number;
  reason?: string;
  expires_at?: string;
};

type BanTarget = { kind: "profile"; userId: string } | { kind: "persona"; personaId: string };

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

  // Get bans (profiles + personas)
  const {
    data: bans,
    error,
    count,
  } = await supabase
    .from("board_entity_bans")
    .select(
      `
      id,
      entity_type,
      entity_id,
      banned_by,
      reason,
      expires_at,
      created_at,
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
    isAdmin(user.id),
    isBoardModerator(boardId, user.id),
  ]);

  if (!userIsAdmin && !userIsModerator) {
    return http.forbidden("Forbidden: Only admins or moderators can edit bans");
  }

  const body = await parseJsonBody<CreateBanPayload>(request);
  if (body instanceof Response) {
    return body;
  }

  const { user_id, username, ban_days, reason, expires_at } = body;

  let target: BanTarget | null = null;
  if (typeof username === "string" && username.trim()) {
    const normalizedUsername = username.trim().replace(/^@/, "").toLowerCase();
    if (normalizedUsername.startsWith("ai_")) {
      const { data: persona, error: personaError } = await supabase
        .from("personas")
        .select("id")
        .eq("username", normalizedUsername)
        .maybeSingle();

      if (personaError) {
        console.error(
          "Error resolving persona username for board ban",
          { boardId, username },
          personaError,
        );
        return http.internalError("Failed to resolve username");
      }
      if (!persona) {
        return http.notFound("Persona not found");
      }
      target = { kind: "persona", personaId: persona.id };
    } else {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", normalizedUsername)
        .maybeSingle();

      if (profileError) {
        console.error(
          "Error resolving profile username for board ban",
          { boardId, username },
          profileError,
        );
        return http.internalError("Failed to resolve username");
      }
      if (!profile) {
        return http.notFound("User not found");
      }
      target = { kind: "profile", userId: profile.user_id };
    }
  } else if (typeof user_id === "string" && user_id.trim()) {
    target = { kind: "profile", userId: user_id.trim() };
  }

  if (!target) {
    return http.badRequest("Missing or invalid username");
  }

  let normalizedExpiresAt: string | null = null;
  if (ban_days !== undefined) {
    if (!Number.isInteger(ban_days) || ban_days < 1 || ban_days > 99999) {
      return http.badRequest("Invalid ban_days. Must be an integer between 1 and 99999");
    }
    normalizedExpiresAt = new Date(Date.now() + ban_days * 24 * 60 * 60 * 1000).toISOString();
  } else if (expires_at) {
    const parsed = new Date(expires_at);
    if (Number.isNaN(parsed.getTime())) {
      return http.badRequest("Invalid expires_at");
    }
    normalizedExpiresAt = parsed.toISOString();
  }

  if (target.kind === "profile") {
    // Cannot ban yourself
    if (target.userId === user.id) {
      return http.badRequest("Cannot ban yourself");
    }

    // Cannot ban other moderators
    const isTargetMod = await isBoardModerator(boardId, target.userId);
    if (isTargetMod) {
      return http.badRequest("Cannot ban moderators");
    }

    const { data: ban, error } = await supabase
      .from("board_entity_bans")
      .insert({
        board_id: boardId,
        entity_type: "profile",
        entity_id: target.userId,
        banned_by: user.id,
        reason: reason || null,
        expires_at: normalizedExpiresAt,
      })
      .select(
        `
        id,
        entity_type,
        entity_id,
        banned_by,
        reason,
        expires_at,
        created_at
      `,
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        return http.conflict("User is already banned");
      }
      console.error(
        "Error banning profile on board",
        { boardId, user_id: target.userId, username, reason, expires_at: normalizedExpiresAt },
        error,
      );
      return http.internalError("Failed to ban user");
    }

    return http.created(ban);
  }

  const { data: personaBan, error: personaBanError } = await supabase
    .from("board_entity_bans")
    .insert({
      board_id: boardId,
      entity_type: "persona",
      entity_id: target.personaId,
      banned_by: user.id,
      reason: reason || null,
      expires_at: normalizedExpiresAt,
    })
    .select("id, board_id, entity_type, entity_id, banned_by, reason, expires_at, created_at")
    .single();

  if (personaBanError) {
    if (personaBanError.code === "23505") {
      return http.conflict("Persona is already banned");
    }
    console.error(
      "Error banning persona on board",
      { boardId, persona_id: target.personaId, username, reason, expires_at: normalizedExpiresAt },
      personaBanError,
    );
    return http.internalError("Failed to ban persona");
  }

  return http.created(personaBan);
});
