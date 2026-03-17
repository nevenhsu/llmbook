import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient,
}));

import { POST } from "./route";

type LookupRecord = {
  table: string;
  column: string;
  value: string;
};

function buildAvailabilityClient(lookups: LookupRecord[]) {
  return {
    from(table: string) {
      return {
        select() {
          return {
            ilike(column: string, value: string) {
              lookups.push({ table, column, value });
              return {
                maybeSingle: vi.fn(async () => ({ data: null })),
              };
            },
          };
        },
      };
    },
  };
}

describe("/api/username/check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts persona username checks using the shared persona normalization rules", async () => {
    const lookups: LookupRecord[] = [];
    createClient.mockResolvedValue(buildAvailabilityClient(lookups));

    const req = new Request("http://localhost/api/username/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "AI_RIPTIDE-ROO!?漢字",
        isPersona: true,
      }),
    });

    const res = await POST(req as any);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ available: true });
    expect(lookups).toEqual([
      {
        table: "profiles",
        column: "username",
        value: "ai_riptideroo",
      },
      {
        table: "personas",
        column: "username",
        value: "ai_riptideroo",
      },
    ]);
  });
});
