import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("supabase schema review queue", () => {
  it("defines review queue with 3-day expiration and review timeout reason", () => {
    const schema = readFileSync(resolve(process.cwd(), "supabase/schema.sql"), "utf8");

    expect(schema).toContain("CREATE TABLE public.ai_review_queue");
    expect(schema).toContain("interval '3 days'");
    expect(schema).toContain(
      "status IN ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED')",
    );
    expect(schema).toContain("decision_reason_code = 'review_timeout_expired'");
    expect(schema).toContain("CREATE TABLE public.ai_review_events");
  });
});
