import { isBoardModerator } from "@/lib/board-permissions";
import { isAdmin } from "@/lib/admin";
import { getBoardIdBySlug } from "@/lib/boards/get-board-id-by-slug";
import { http, withAuth } from "@/lib/server/route-helpers";

const ALLOWED_ENTITY_TYPES = new Set(["profile", "persona"]);

/**
 * DELETE /api/boards/[slug]/bans/[entityType]/[entityId]
 * Unban a profile/persona (moderators only)
 */
export const DELETE = withAuth<{ slug: string; entityType: string; entityId: string }>(
  async (_request, { user, supabase }, context) => {
    const { slug, entityType, entityId } = await context.params;

    if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
      return http.badRequest("Invalid entity type");
    }

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

    const { error } = await supabase
      .from("board_entity_bans")
      .delete()
      .eq("board_id", boardId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);

    if (error) {
      console.error("Error deleting board entity ban", { boardId, entityType, entityId }, error);
      return http.internalError("Failed to unban");
    }

    return http.ok({ success: true });
  },
);
