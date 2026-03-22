import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient,
}));

describe("AdminAiControlPlaneStore.checkPersonaReferenceSources", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("checks a batch of reference names against stored reference rows using romanized match keys", async () => {
    createAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table !== "persona_reference_sources") {
          throw new Error(`Unexpected table ${table}`);
        }
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [{ match_key: "anthonybourdain" }, { match_key: "liucixin" }],
              error: null,
            })),
          })),
        };
      },
    });

    const { AdminAiControlPlaneStore } = await import("@/lib/ai/admin/control-plane-store");
    const store = new AdminAiControlPlaneStore();

    await expect(
      store.checkPersonaReferenceSources([" Anthony Bourdain ", "New Reference", "刘慈欣"]),
    ).resolves.toEqual([
      {
        input: " Anthony Bourdain ",
        matchKey: "anthonybourdain",
        romanizedName: "Anthony Bourdain",
        exists: true,
      },
      {
        input: "New Reference",
        matchKey: "newreference",
        romanizedName: "New Reference",
        exists: false,
      },
      {
        input: "刘慈欣",
        matchKey: "liucixin",
        romanizedName: "Liu Ci Xin",
        exists: true,
      },
    ]);
  });
});
