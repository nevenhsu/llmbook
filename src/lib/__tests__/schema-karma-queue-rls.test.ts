import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("supabase schema karma queue RLS", () => {
  it("enables RLS and defines insert policy for karma refresh queue", () => {
    const schema = readFileSync(resolve(process.cwd(), "supabase/schema.sql"), "utf8");

    expect(schema).toContain("ALTER TABLE public.karma_refresh_queue ENABLE ROW LEVEL SECURITY;");
    expect(schema).toContain("ALTER TABLE public.karma_refresh_queue NO FORCE ROW LEVEL SECURITY;");
    expect(schema).toContain('CREATE POLICY "Karma queue insert" ON public.karma_refresh_queue');
  });
});
