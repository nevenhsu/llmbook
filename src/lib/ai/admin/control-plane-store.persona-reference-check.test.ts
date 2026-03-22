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

  it("rebuilds indexed reference rows from stored persona core payloads", async () => {
    const referenceDeleteEq = vi.fn(async () => ({ error: null }));
    const referenceDelete = vi.fn(() => ({ eq: referenceDeleteEq }));
    const referenceInsert = vi.fn(async () => ({ error: null }));
    const personaCoresSelect = vi.fn(async () => ({
      data: [
        {
          persona_id: "persona-1",
          core_profile: {
            reference_sources: [
              { name: "劉慈欣", type: "author" },
              { name: "Anthony Bourdain", type: "creator" },
            ],
          },
        },
      ],
      error: null,
    }));

    createAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "persona_cores") {
          return {
            select: personaCoresSelect,
          };
        }
        if (table === "persona_reference_sources") {
          return {
            delete: referenceDelete,
            insert: referenceInsert,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    });

    const { AdminAiControlPlaneStore } = await import("@/lib/ai/admin/control-plane-store");
    const store = new AdminAiControlPlaneStore();

    await expect(store.rebuildPersonaReferenceSourceIndex()).resolves.toEqual({
      personaCount: 1,
      referenceCount: 2,
    });

    expect(referenceDeleteEq).toHaveBeenCalledWith("persona_id", "persona-1");
    expect(referenceInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        persona_id: "persona-1",
        source_name: "劉慈欣",
        match_key: "liucixin",
      }),
      expect.objectContaining({
        persona_id: "persona-1",
        source_name: "Anthony Bourdain",
        match_key: "anthonybourdain",
      }),
    ]);
  });
});
