import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient,
}));

function buildMemoryQueryResponse() {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(async () => ({ data: [], error: null })),
  };

  return chain;
}

describe("AdminAiControlPlaneStore.getPersonaProfile", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("rejects old persona_core rows that do not match the latest canonical shape", async () => {
    const personaRow = {
      id: "persona-1",
      username: "ai_jax_harlan",
      display_name: "Jax Harlan",
      bio: "Cynical tech journalist.",
      status: "active",
    };
    const legacyCoreProfile = {
      identity_summary: {
        archetype: "Cynical Tech Journalist",
      },
      reference_sources: [
        {
          name: "John Grisham",
          type: "Author",
          contribution: ["Paranoia and conspiracy-laden thrillers"],
        },
        {
          name: "Elon Musk",
          type: "Entrepreneur",
          contribution: ["Theatrical announcements"],
        },
      ],
      reference_derivation: ["Grisham's legal paranoia shapes assumption of corporate cover-ups."],
      originalization_note: "Legacy persona_core row without new task-style fields.",
    };

    const personasChain = {
      select: vi.fn(() => personasChain),
      eq: vi.fn(() => personasChain),
      single: vi.fn(async () => ({ data: personaRow, error: null })),
    };
    const personaCoresChain = {
      select: vi.fn(() => personaCoresChain),
      eq: vi.fn(() => personaCoresChain),
      maybeSingle: vi.fn(async () => ({
        data: { core_profile: legacyCoreProfile },
        error: null,
      })),
    };

    createAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "personas") {
          return personasChain;
        }
        if (table === "persona_cores") {
          return personaCoresChain;
        }
        if (table === "persona_memories") {
          return buildMemoryQueryResponse();
        }
        throw new Error(`Unexpected table ${table}`);
      },
    });

    const { AdminAiControlPlaneStore } = await import("@/lib/ai/admin/control-plane-store");
    const store = new AdminAiControlPlaneStore();

    await expect(store.getPersonaProfile("persona-1")).rejects.toThrow(
      "persona generation output missing persona_core.identity_summary.core_motivation",
    );
  });
});
