import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient,
}));

function buildPersonaCore() {
  return {
    identity_summary: {
      archetype: "Impulsive Champion",
      core_motivation: "Prove loyalty through action, not words",
      one_sentence_identity:
        "A loud, loyal forum brawler who rewards gutsy allies and smashes pretentious arguments with chaotic energy.",
    },
    values: {
      value_hierarchy: [
        { value: "Loyalty through action", priority: 1 },
        { value: "Gutsy conviction over polished argument", priority: 2 },
      ],
      worldview: [
        "Actions speak louder than words, and anyone who hides behind fancy talk or credentials is just scared to get their hands dirty.",
      ],
      judgment_style: "Judges posts by heart and hustle not by how polished they sound.",
    },
    aesthetic_profile: {
      humor_preferences: ["Loud taunts over polished wit."],
      narrative_preferences: ["Underdogs proving themselves through daring action."],
      creative_preferences: ["Raw passion over technical perfection."],
      disliked_patterns: ["Overly formal debate structure."],
      taste_boundaries: ["Appreciates chaos but not actual harm."],
    },
    lived_context: {
      familiar_scenes_of_life: ["Jumping into heated forum threads."],
      personal_experience_flavors: ["Impulsive rush of jumping into arguments."],
      cultural_contexts: ["Forum culture where bold stances earn respect."],
      topics_with_confident_grounding: ["Loyalty and crew bonds"],
      topics_requiring_runtime_retrieval: ["Technical debate specifics"],
    },
    creator_affinity: {
      admired_creator_types: ["Creators who take bold risks over safe plays"],
      structural_preferences: ["Prefers chaotic energy over rigid structure"],
      detail_selection_habits: ["Notices conviction and guts in presentation"],
      creative_biases: ["Favors raw expression over technical perfection"],
    },
    interaction_defaults: {
      default_stance: "Jumps into threads with gutsy declarations and rallying calls.",
      discussion_strengths: ["Rallying allies and exposing cowardly arguments"],
      friction_triggers: ["Pomposity and credential-flaunting"],
      non_generic_traits: ["Treats forum threads like battles"],
    },
    guardrails: {
      hard_no: ["Will not tolerate attacks on allies"],
      deescalation_style: ["Cracks jokes to defuse without backing down"],
    },
    voice_fingerprint: {
      opening_move: "Starts with a laugh or a challenge.",
      metaphor_domains: ["Battle and crew metaphors"],
      attack_style: "Calls out weakness directly.",
      praise_style: "Celebrates allies with loud enthusiasm.",
      closing_move: "Ends with a rallying challenge.",
      forbidden_shapes: ["Polite disagreement"],
    },
    task_style_matrix: {
      post: {
        entry_shape: "Burst in with a loud declaration.",
        body_shape: "Rallying rhetoric over tidy logic.",
        close_shape: "End with a challenge.",
        forbidden_shapes: ["Formal debate etiquette"],
      },
      comment: {
        entry_shape: "Jump in like joining a fight mid-brawl.",
        feedback_shape: "Quick emotional hit with taunts or cheers.",
        close_shape: "Short burst that cements alliance.",
        forbidden_shapes: ["Neutral feedback tones"],
      },
    },
  };
}

describe("AdminAiControlPlaneStore.patchPersonaProfile", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("upserts existing persona_cores rows using the persona_id conflict target", async () => {
    const personasUpdateEq = vi.fn(async () => ({ error: null }));
    const personasUpdate = vi.fn(() => ({ eq: personasUpdateEq }));
    const personaCoresUpsert = vi.fn(async () => ({ error: null }));
    const referenceDeleteEq = vi.fn(async () => ({ error: null }));
    const referenceDelete = vi.fn(() => ({ eq: referenceDeleteEq }));
    const referenceInsert = vi.fn(async () => ({ error: null }));

    createAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "personas") {
          return {
            update: personasUpdate,
          };
        }
        if (table === "persona_cores") {
          return {
            upsert: personaCoresUpsert,
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

    await store.patchPersonaProfile({
      personaId: "persona-1",
      displayName: "RiptideRoo",
      username: "ai_riptideroo",
      bio: "Boisterous forum warrior.",
      personaCore: buildPersonaCore(),
      referenceSources: [
        {
          name: "Monkey D. Luffy",
          type: "character_inspiration",
          contribution: ["Impulsive crew-first energy"],
        },
      ],
      otherReferenceSources: [
        {
          name: "pirate crew loyalty",
          type: "group_dynamic",
          contribution: ["Crew-as-family emotional logic."],
        },
      ],
      referenceDerivation: ["Impulsive first-reaction posting style"],
      originalizationNote: "Reference-inspired, not reference-cosplay.",
    });

    expect(personaCoresUpsert).toHaveBeenCalledTimes(1);
    expect(personaCoresUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        persona_id: "persona-1",
        core_profile: expect.objectContaining({
          other_reference_sources: [
            expect.objectContaining({
              name: "pirate crew loyalty",
            }),
          ],
        }),
      }),
      expect.objectContaining({
        onConflict: "persona_id",
      }),
    );
    expect(referenceDelete).toHaveBeenCalledTimes(1);
    expect(referenceDeleteEq).toHaveBeenCalledWith("persona_id", "persona-1");
    expect(referenceInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        persona_id: "persona-1",
        source_name: "Monkey D. Luffy",
        match_key: "monkeydluffy",
      }),
    ]);
  });

  it("normalizes persona usernames with the shared persona username helper before update", async () => {
    const personasUpdateEq = vi.fn(async () => ({ error: null }));
    const personasUpdate = vi.fn(() => ({ eq: personasUpdateEq }));

    createAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "personas") {
          return {
            update: personasUpdate,
          };
        }
        if (table === "persona_cores") {
          return {
            upsert: vi.fn(async () => ({ error: null })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    });

    const { AdminAiControlPlaneStore } = await import("@/lib/ai/admin/control-plane-store");
    const store = new AdminAiControlPlaneStore();

    await store.patchPersonaProfile({
      personaId: "persona-1",
      username: "AI_RIPTIDE-ROO!?漢字",
    });

    expect(personasUpdate).toHaveBeenCalledWith({
      username: "ai_riptideroo",
    });
  });

  it("rejects personaMemories in persona profile patch payloads", async () => {
    const deleteChain = {
      eq: vi.fn(() => deleteChain),
      in: vi.fn(async () => ({ error: null })),
    };
    const deleteFn = vi.fn(() => ({ eq: deleteChain.eq }));
    const insert = vi.fn(async () => ({ error: null }));

    createAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "personas") {
          return {
            update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
          };
        }
        if (table === "persona_memories") {
          return {
            delete: deleteFn,
            insert,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    });

    const { AdminAiControlPlaneStore } = await import("@/lib/ai/admin/control-plane-store");
    const store = new AdminAiControlPlaneStore();

    await expect(
      store.patchPersonaProfile({
        personaId: "persona-1",
        personaMemories: [
          {
            memoryType: "memory",
            scope: "board",
            content: "This board keeps relitigating scarcity.",
            metadata: { continuity_kind: "board_theme" },
            expiresAt: null,
            importance: 0.4,
          },
        ],
      } as any),
    ).rejects.toThrow(/personaMemories/);

    expect(deleteFn).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("AdminAiControlPlaneStore.createPersona", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("rejects personaMemories in create persona payloads", async () => {
    const personasInsertSingle = vi.fn(async () => ({
      data: { id: "persona-1" },
      error: null,
    }));
    const personasInsertSelect = vi.fn(() => ({
      single: personasInsertSingle,
    }));
    const personasInsert = vi.fn(() => ({
      select: personasInsertSelect,
    }));
    const personaCoresUpsert = vi.fn(async () => ({ error: null }));
    const referenceDeleteEq = vi.fn(async () => ({ error: null }));
    const referenceDelete = vi.fn(() => ({ eq: referenceDeleteEq }));
    const referenceInsert = vi.fn(async () => ({ error: null }));
    const memoryInsert = vi.fn(async () => ({ error: null }));

    createAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "personas") {
          return {
            insert: personasInsert,
          };
        }
        if (table === "persona_cores") {
          return {
            upsert: personaCoresUpsert,
          };
        }
        if (table === "persona_reference_sources") {
          return {
            delete: referenceDelete,
            insert: referenceInsert,
          };
        }
        if (table === "persona_memories") {
          return {
            insert: memoryInsert,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    });

    const { AdminAiControlPlaneStore } = await import("@/lib/ai/admin/control-plane-store");
    const store = new AdminAiControlPlaneStore();

    await expect(
      store.createPersona({
        username: "ai_riptideroo",
        persona: {
          display_name: "Riptide Roo",
          bio: "Boisterous forum warrior.",
          status: "active",
        },
        personaCore: buildPersonaCore(),
        referenceSources: [],
        otherReferenceSources: [],
        referenceDerivation: [],
        originalizationNote: "Reference-inspired, not reference-cosplay.",
        personaMemories: [
          {
            memoryType: "long_memory",
            scope: "persona",
            content: "Prefers bold action over polished argument.",
          },
        ],
      } as any),
    ).rejects.toThrow(/personaMemories/);

    expect(personasInsert).not.toHaveBeenCalled();
    expect(memoryInsert).not.toHaveBeenCalled();
  });

  it("normalizes explicit persona usernames with the shared persona username helper", async () => {
    const personasInsertSingle = vi.fn(async () => ({
      data: { id: "persona-1" },
      error: null,
    }));
    const personasInsertSelect = vi.fn(() => ({
      single: personasInsertSingle,
    }));
    const personasInsert = vi.fn(() => ({
      select: personasInsertSelect,
    }));
    const personaCoresUpsert = vi.fn(async () => ({ error: null }));
    const referenceDeleteEq = vi.fn(async () => ({ error: null }));
    const referenceDelete = vi.fn(() => ({ eq: referenceDeleteEq }));
    const referenceInsert = vi.fn(async () => ({ error: null }));

    createAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "personas") {
          return {
            insert: personasInsert,
          };
        }
        if (table === "persona_cores") {
          return {
            upsert: personaCoresUpsert,
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

    await store.createPersona({
      username: "AI_RIPTIDE-ROO!?漢字",
      persona: {
        display_name: "Riptide Roo",
        bio: "Boisterous forum warrior.",
        status: "active",
      },
      personaCore: buildPersonaCore(),
      referenceSources: [
        {
          name: "劉慈欣",
          type: "author",
          contribution: ["Hard-sf scale"],
        },
      ],
      otherReferenceSources: [
        {
          name: "dark forest theory",
          type: "concept",
          contribution: ["Cosmic paranoia under scarcity."],
        },
      ],
      referenceDerivation: [],
      originalizationNote: "Reference-inspired, not reference-cosplay.",
    });

    expect(personasInsert).toHaveBeenCalledWith({
      username: "ai_riptideroo",
      display_name: "Riptide Roo",
      bio: "Boisterous forum warrior.",
      status: "active",
    });
    expect(referenceInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        persona_id: "persona-1",
        source_name: "劉慈欣",
        match_key: "liucixin",
      }),
    ]);
    expect(personaCoresUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        core_profile: expect.objectContaining({
          other_reference_sources: [
            expect.objectContaining({
              name: "dark forest theory",
            }),
          ],
        }),
      }),
      expect.any(Object),
    );
    expect(referenceDeleteEq).toHaveBeenCalledWith("persona_id", "persona-1");
  });
});
