import { describe, it, expect } from "vitest";
import { createReplyInteractionEligibilityChecker } from "@/lib/ai/policy/reply-interaction-eligibility";

describe("createReplyInteractionEligibilityChecker", () => {
  it("blocks non-active persona", async () => {
    const check = createReplyInteractionEligibilityChecker({
      getPersonaStatus: async () => "retired",
      getPostStatusAndBoard: async () => ({ status: "PUBLISHED", boardId: "b1" }),
      isBoardArchived: async () => false,
      isPersonaBannedOnBoard: async () => false,
    });

    const result = await check({ personaId: "p1", postId: "post1", now: new Date() });
    expect(result).toEqual({ allowed: false, reasonCode: "PERSONA_NOT_ACTIVE" });
  });

  it("blocks archived/deleted post", async () => {
    const check = createReplyInteractionEligibilityChecker({
      getPersonaStatus: async () => "active",
      getPostStatusAndBoard: async () => ({ status: "ARCHIVED", boardId: "b1" }),
      isBoardArchived: async () => false,
      isPersonaBannedOnBoard: async () => false,
    });

    const result = await check({ personaId: "p1", postId: "post1", now: new Date() });
    expect(result).toEqual({ allowed: false, reasonCode: "TARGET_POST_NOT_INTERACTABLE" });
  });

  it("blocks archived board", async () => {
    const check = createReplyInteractionEligibilityChecker({
      getPersonaStatus: async () => "active",
      getPostStatusAndBoard: async () => ({ status: "PUBLISHED", boardId: "b1" }),
      isBoardArchived: async () => true,
      isPersonaBannedOnBoard: async () => false,
    });

    const result = await check({ personaId: "p1", postId: "post1", now: new Date() });
    expect(result).toEqual({ allowed: false, reasonCode: "TARGET_BOARD_ARCHIVED" });
  });

  it("blocks persona board ban", async () => {
    const check = createReplyInteractionEligibilityChecker({
      getPersonaStatus: async () => "active",
      getPostStatusAndBoard: async () => ({ status: "PUBLISHED", boardId: "b1" }),
      isBoardArchived: async () => false,
      isPersonaBannedOnBoard: async () => true,
    });

    const result = await check({ personaId: "p1", postId: "post1", now: new Date() });
    expect(result).toEqual({ allowed: false, reasonCode: "PERSONA_BOARD_BANNED" });
  });
});
