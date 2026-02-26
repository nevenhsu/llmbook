import { createAdminClient } from "@/lib/supabase/admin";

export type ReplyEligibilityReasonCode =
  | "TARGET_POST_NOT_INTERACTABLE"
  | "TARGET_BOARD_ARCHIVED"
  | "PERSONA_NOT_ACTIVE"
  | "PERSONA_BOARD_BANNED"
  | "ELIGIBILITY_CHECK_FAILED";

export type ReplyEligibilityResult = {
  allowed: boolean;
  reasonCode?: ReplyEligibilityReasonCode;
};

type PersonaStatus = "active" | "inactive" | "retired" | "suspended";

type EligibilityDeps = {
  getPersonaStatus: (personaId: string) => Promise<PersonaStatus | null>;
  getPostStatusAndBoard: (postId: string) => Promise<{ status: string; boardId: string } | null>;
  isBoardArchived: (boardId: string) => Promise<boolean>;
  isPersonaBannedOnBoard: (input: {
    boardId: string;
    personaId: string;
    now: Date;
  }) => Promise<boolean>;
};

function defaultDeps(): EligibilityDeps {
  return {
    getPersonaStatus: async (personaId) => {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("personas")
        .select("status")
        .eq("id", personaId)
        .maybeSingle<{ status: PersonaStatus }>();
      if (error) {
        throw new Error(`eligibility persona lookup failed: ${error.message}`);
      }
      return data?.status ?? null;
    },
    getPostStatusAndBoard: async (postId) => {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("posts")
        .select("status, board_id")
        .eq("id", postId)
        .maybeSingle<{ status: string; board_id: string }>();
      if (error) {
        throw new Error(`eligibility post lookup failed: ${error.message}`);
      }
      if (!data) {
        return null;
      }
      return { status: data.status, boardId: data.board_id };
    },
    isBoardArchived: async (boardId) => {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("boards")
        .select("is_archived")
        .eq("id", boardId)
        .maybeSingle<{ is_archived: boolean }>();
      if (error) {
        throw new Error(`eligibility board lookup failed: ${error.message}`);
      }
      return data?.is_archived === true;
    },
    isPersonaBannedOnBoard: async ({ boardId, personaId, now }) => {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("board_entity_bans")
        .select("id, expires_at")
        .eq("board_id", boardId)
        .eq("entity_type", "persona")
        .eq("entity_id", personaId)
        .maybeSingle<{ id: string; expires_at: string | null }>();

      // Some environments do not have persona-level board bans yet.
      if (error || !data) {
        return false;
      }

      if (!data.expires_at) {
        return true;
      }

      return new Date(data.expires_at).getTime() > now.getTime();
    },
  };
}

export function createReplyInteractionEligibilityChecker(customDeps?: Partial<EligibilityDeps>) {
  const deps: EligibilityDeps = { ...defaultDeps(), ...(customDeps ?? {}) };

  return async (input: {
    personaId: string;
    postId?: string | null;
    boardId?: string | null;
    now: Date;
  }): Promise<ReplyEligibilityResult> => {
    try {
      const personaStatus = await deps.getPersonaStatus(input.personaId);
      if (personaStatus !== "active") {
        return { allowed: false, reasonCode: "PERSONA_NOT_ACTIVE" };
      }

      const postId =
        typeof input.postId === "string" && input.postId.length > 0 ? input.postId : null;
      let boardId =
        typeof input.boardId === "string" && input.boardId.length > 0 ? input.boardId : null;

      if (postId) {
        const post = await deps.getPostStatusAndBoard(postId);
        if (!post || post.status === "ARCHIVED" || post.status === "DELETED") {
          return { allowed: false, reasonCode: "TARGET_POST_NOT_INTERACTABLE" };
        }
        boardId = boardId ?? post.boardId;
      }

      if (boardId) {
        const archived = await deps.isBoardArchived(boardId);
        if (archived) {
          return { allowed: false, reasonCode: "TARGET_BOARD_ARCHIVED" };
        }

        const banned = await deps.isPersonaBannedOnBoard({
          boardId,
          personaId: input.personaId,
          now: input.now,
        });
        if (banned) {
          return { allowed: false, reasonCode: "PERSONA_BOARD_BANNED" };
        }
      }

      return { allowed: true };
    } catch {
      return { allowed: false, reasonCode: "ELIGIBILITY_CHECK_FAILED" };
    }
  };
}
