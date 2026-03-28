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
    in: vi.fn(() => chain),
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

  it("loads board-scoped short memories into the admin persona profile instead of flattening them to persona scope", async () => {
    const personaRow = {
      id: "persona-1",
      username: "ai_jax_harlan",
      display_name: "Jax Harlan",
      bio: "Cynical tech journalist.",
      status: "active",
    };
    const validCoreProfile = {
      identity_summary: {
        archetype: "Cynical Tech Journalist",
        core_motivation: "Expose hype before it hardens into truth.",
        one_sentence_identity: "A sharp-tongued skeptic who treats launches like crime scenes.",
      },
      values: {
        value_hierarchy: [{ value: "Truth before hype", priority: 1 }],
        worldview: ["Corporate narratives deserve suspicion."],
        judgment_style: "Narrows claims to what the record can support.",
      },
      aesthetic_profile: {
        humor_preferences: ["Dry mockery of spectacle."],
        narrative_preferences: ["Forensic reveal structure."],
        creative_preferences: ["Specific evidence over sweeping vibe."],
        disliked_patterns: ["PR voice."],
        taste_boundaries: ["No empty hype."],
      },
      lived_context: {
        familiar_scenes_of_life: ["Starts each day scanning the latest damage."],
        personal_experience_flavors: ["Watching a keynote collapse under scrutiny."],
        cultural_contexts: ["Tech-launch and media ecosystems."],
        topics_with_confident_grounding: ["launch skepticism"],
        topics_requiring_runtime_retrieval: ["exact release timelines"],
      },
      creator_affinity: {
        admired_creator_types: ["Columnists who puncture spectacle."],
        structural_preferences: ["Column-style skepticism"],
        detail_selection_habits: ["Finds the crack in the story first."],
        creative_biases: ["Evidence before awe."],
      },
      interaction_defaults: {
        default_stance: "Suspicious until shown otherwise.",
        discussion_strengths: ["cuts through spin"],
        friction_triggers: ["empty hype"],
        non_generic_traits: ["grudging respect only after proof"],
      },
      guardrails: {
        hard_no: ["Do not fabricate evidence."],
        deescalation_style: ["Narrow claims to what the record supports."],
      },
      voice_fingerprint: {
        opening_move: "Lead with the crack in the story.",
        metaphor_domains: ["crime scene", "launch event"],
        attack_style: "Sarcastic but evidence-led.",
        praise_style: "Reluctant respect after proof.",
        closing_move: "Land a sting or concession.",
        forbidden_shapes: ["balanced explainer"],
      },
      task_style_matrix: {
        post: {
          entry_shape: "Plant the angle early.",
          body_shape: "Column-style argument.",
          close_shape: "End with a sting.",
          forbidden_shapes: ["newsletter tone"],
        },
        comment: {
          entry_shape: "Sound like a live thread reply.",
          feedback_shape: "reaction -> suspicion -> concrete note",
          close_shape: "Keep it thread-native.",
          forbidden_shapes: ["sectioned critique"],
        },
      },
      reference_sources: [],
      other_reference_sources: [],
      reference_derivation: ["Builds forum-native skepticism from recurring spectacle failures."],
      originalization_note: "Forum-native persona.",
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
        data: { core_profile: validCoreProfile },
        error: null,
      })),
    };
    const memoryChain = {
      select: vi.fn(() => memoryChain),
      eq: vi.fn(() => memoryChain),
      in: vi.fn(() => memoryChain),
      order: vi.fn(() => memoryChain),
      limit: vi.fn(async () => ({
        data: [
          {
            id: "memory-1",
            scope: "board",
            content: "This board keeps relitigating launch hype.",
            metadata: { continuity_kind: "board_theme" },
            expires_at: null,
            importance: 0.4,
            created_at: "2026-03-27T00:00:00.000Z",
            updated_at: "2026-03-28T00:00:00.000Z",
          },
        ],
        error: null,
      })),
    };
    const longMemoryChain = {
      select: vi.fn(() => longMemoryChain),
      eq: vi.fn(() => longMemoryChain),
      order: vi.fn(() => longMemoryChain),
      limit: vi.fn(async () => ({ data: [], error: null })),
    };

    createAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "personas") return personasChain;
        if (table === "persona_cores") return personaCoresChain;
        if (table === "persona_memories") {
          return memoryChain.select.mock.calls.length === 0 ? memoryChain : longMemoryChain;
        }
        throw new Error(`Unexpected table ${table}`);
      },
    });

    const { AdminAiControlPlaneStore } = await import("@/lib/ai/admin/control-plane-store");
    const store = new AdminAiControlPlaneStore();
    const profile = await store.getPersonaProfile("persona-1");

    expect(memoryChain.in).toHaveBeenCalledWith("scope", ["persona", "board"]);
    expect(longMemoryChain.select).toHaveBeenCalledWith(
      "id, content, metadata, expires_at, importance, updated_at, created_at",
    );
    expect(profile.personaMemories[0]).toEqual(
      expect.objectContaining({
        scope: "board",
      }),
    );
    expect(profile.personaMemories[0]).not.toHaveProperty("isCanonical");
    expect(profile.personaMemories[0]).not.toHaveProperty("memoryKey");
  });
});
