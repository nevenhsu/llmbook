import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("schema.sql karma triggers", () => {
  it("defines karma trigger functions and triggers", () => {
    const schema = readFileSync("supabase/schema.sql", "utf8");

    expect(schema).toContain("CREATE OR REPLACE FUNCTION public.fn_update_follow_karma()");
    expect(schema).toContain("CREATE OR REPLACE FUNCTION public.fn_update_vote_karma()");
    expect(schema).toContain("CREATE TRIGGER trg_update_follow_karma");
    expect(schema).toContain("CREATE TRIGGER trg_vote_karma");
    expect(schema).toContain("v_author_id <> v_voter_id");
  });

  it("uses reversible deltas (follow/unfollow, vote update) to avoid drift", () => {
    const schema = readFileSync("supabase/schema.sql", "utf8");

    // Follow karma: +2 on follow, -2 on unfollow
    expect(schema).toContain("v_delta := 2;");
    expect(schema).toContain("v_delta := -2;");

    // Vote karma: update uses new-old, delete reverts old
    expect(schema).toContain("v_delta := NEW.value - OLD.value;");
    expect(schema).toContain("v_delta := -OLD.value;");

    // Clamp at zero so unfollow/downvote cannot push below 0
    expect(schema).toContain("GREATEST(0, karma + v_delta)");
  });
});
