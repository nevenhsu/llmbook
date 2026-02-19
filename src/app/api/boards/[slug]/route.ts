import { NextResponse } from "next/server";
import { canManageBoard } from "@/lib/board-permissions";
import { isAdmin } from "@/lib/admin";
import { getBoardIdBySlug } from "@/lib/boards/get-board-id-by-slug";
import { http, parseJsonBody, withAuth } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

type BoardPatchPayload = {
  name?: string;
  description?: string;
  banner_url?: string;
  rules?: Array<{ title: string; description?: string }>;
  is_archived?: boolean;
};

/**
 * PATCH /api/boards/[slug]
 * Update board settings and archived state
 */
export const PATCH = withAuth<{ slug: string }>(async (request, { user, supabase }, context) => {
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

  const payload = await parseJsonBody<BoardPatchPayload>(request);
  if (payload instanceof NextResponse) {
    return payload;
  }

  const { name, description, banner_url, rules, is_archived } = payload;
  const hasSettingsUpdate =
    name !== undefined ||
    description !== undefined ||
    banner_url !== undefined ||
    rules !== undefined;
  const hasUnarchiveRequest = is_archived === false;

  if (!hasSettingsUpdate && !hasUnarchiveRequest) {
    return http.badRequest("No valid fields to update");
  }

  const userIsAdmin = await isAdmin(user.id, supabase);

  if (hasSettingsUpdate && !userIsAdmin) {
    const canManageSettings = await canManageBoard(boardId, user.id, supabase);
    if (!canManageSettings) {
      return http.forbidden("Forbidden: Missing manage_settings permission");
    }
  }

  if (hasUnarchiveRequest && !userIsAdmin) {
    return http.forbidden("Forbidden: Only admins can unarchive");
  }

  // Validation
  if (typeof name === "string" && (name.length < 3 || name.length > 21)) {
    return http.badRequest("Board name must be 3-21 characters");
  }

  if (typeof name === "string" && !/^[a-zA-Z0-9_]+$/.test(name)) {
    return http.badRequest("Board name can only contain alphanumeric characters and underscores");
  }

  if (typeof description === "string" && description.length > 500) {
    return http.badRequest("Description must be max 500 characters");
  }

  if (rules !== undefined) {
    if (!Array.isArray(rules)) {
      return http.badRequest("Invalid rules");
    }
    if (rules.length > 15) {
      return http.badRequest("Maximum 15 rules allowed");
    }

    for (const rule of rules) {
      if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
        return http.badRequest("Invalid rules");
      }

      const title = (rule as { title?: unknown }).title;
      const ruleDescription = (rule as { description?: unknown }).description;

      if (typeof title !== "string" || title.length === 0 || title.length > 100) {
        return http.badRequest("Rule title required and must be max 100 characters");
      }
      if (typeof ruleDescription === "string" && ruleDescription.length > 500) {
        return http.badRequest("Rule description must be max 500 characters");
      }
    }
  }

  // Build update object
  const updateData: {
    updated_at: string;
    name?: string;
    description?: string;
    banner_url?: string;
    rules?: BoardPatchPayload["rules"];
    is_archived?: boolean;
    archived_at?: string | null;
  } = { updated_at: new Date().toISOString() };

  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (banner_url !== undefined) updateData.banner_url = banner_url;
  if (rules !== undefined) updateData.rules = rules;
  if (hasUnarchiveRequest) {
    updateData.is_archived = false;
    updateData.archived_at = null;
  }

  // Update board
  const { data: updatedBoard, error } = await supabase
    .from("boards")
    .update(updateData)
    .eq("id", boardId)
    .select("id, slug, name, description, banner_url, rules, updated_at")
    .single();

  if (error) {
    return http.badRequest("Failed to update board");
  }

  return http.ok({ board: updatedBoard });
});

/**
 * DELETE /api/boards/[slug]
 * Archive board (admin only)
 */
export const DELETE = withAuth<{ slug: string }>(async (request, { user, supabase }, context) => {
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

  const userIsAdmin = await isAdmin(user.id, supabase);
  if (!userIsAdmin) {
    return http.forbidden("Forbidden: Only admins can archive");
  }

  // Archive the board (soft delete)
  const { error } = await supabase
    .from("boards")
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
    })
    .eq("id", boardId);

  if (error) {
    return http.badRequest("Failed to archive board");
  }

  return http.ok({ success: true });
});
