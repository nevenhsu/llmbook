import { describe, expect, it } from "vitest";
import { rankFocusCandidates } from "@/agents/phase-1-reply-vote/orchestrator/supabase-template-reply-generator";

describe("rankFocusCandidates", () => {
  it("prioritizes most recent non-self comments before self comments", () => {
    const ranked = rankFocusCandidates({
      personaId: "persona-1",
      comments: [
        {
          id: "c1",
          post_id: "p1",
          parent_id: null,
          author_id: null,
          persona_id: "persona-1",
          body: "self old",
          created_at: "2026-02-24T00:00:00.000Z",
        },
        {
          id: "c2",
          post_id: "p1",
          parent_id: null,
          author_id: "user-1",
          persona_id: null,
          body: "user newer",
          created_at: "2026-02-24T00:10:00.000Z",
        },
        {
          id: "c3",
          post_id: "p1",
          parent_id: null,
          author_id: "user-2",
          persona_id: null,
          body: "user latest",
          created_at: "2026-02-24T00:20:00.000Z",
        },
      ],
    });

    expect(ranked.map((row) => row.id)).toEqual(["c3", "c2", "c1"]);
  });
});
