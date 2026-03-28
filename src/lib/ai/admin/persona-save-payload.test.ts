import { describe, expect, it } from "vitest";
import { mockPersonaGenerationPreview } from "@/lib/ai/admin/persona-generation-preview-mock";
import {
  buildCreatePersonaPayload,
  buildUpdatePersonaPayload,
  mapStructuredPersonaMemoriesToApiMemories,
} from "@/lib/ai/admin/persona-save-payload";

describe("persona-save-payload", () => {
  it("maps structured persona memories into canonical API memory payload rows", () => {
    const mapped = mapStructuredPersonaMemoriesToApiMemories(
      [
        {
          memory_type: "long_memory",
          scope: "persona",
          content: "Protect the crew first.",
          metadata: {
            topic_keys: ["loyalty", "crew"],
            stance_summary: "Protects the crew before abstract principle.",
            follow_up_hooks: ["Will keep defending allies under pressure."],
            promotion_candidate: true,
          },
          expires_in_hours: 24,
          importance: 10,
        },
        {
          memory_type: "memory",
          scope: "persona",
          content: "Won a late-night argument.",
          metadata: {
            topic_keys: ["argument", "conviction"],
            stance_summary: "Remembers winning a conviction-first late-night argument.",
            follow_up_hooks: [],
            promotion_candidate: false,
          },
          expires_in_hours: null,
          importance: 4,
        },
        {
          memory_type: "memory",
          scope: "persona",
          content: "The board keeps revisiting scarcity as a design pressure.",
          metadata: {
            topic_keys: ["scarcity", "design"],
            stance_summary: "Tracks recurring scarcity pressure in design arguments.",
            follow_up_hooks: ["Will likely revisit scarcity as a constraint lens."],
            promotion_candidate: false,
          },
          expires_in_hours: 72,
          importance: 5,
        },
      ],
      { now: new Date("2026-03-22T10:00:00.000Z") },
    );

    expect(mapped).toEqual([
      {
        memoryType: "long_memory",
        scope: "persona",
        content: "Protect the crew first.",
        metadata: {
          topic_keys: ["loyalty", "crew"],
          stance_summary: "Protects the crew before abstract principle.",
          follow_up_hooks: ["Will keep defending allies under pressure."],
          promotion_candidate: true,
        },
        expiresAt: "2026-03-23T10:00:00.000Z",
        importance: 10,
      },
      {
        memoryType: "memory",
        scope: "persona",
        content: "Won a late-night argument.",
        metadata: {
          topic_keys: ["argument", "conviction"],
          stance_summary: "Remembers winning a conviction-first late-night argument.",
          follow_up_hooks: [],
          promotion_candidate: false,
        },
        expiresAt: null,
        importance: 4,
      },
      {
        memoryType: "memory",
        scope: "persona",
        content: "The board keeps revisiting scarcity as a design pressure.",
        metadata: {
          topic_keys: ["scarcity", "design"],
          stance_summary: "Tracks recurring scarcity pressure in design arguments.",
          follow_up_hooks: ["Will likely revisit scarcity as a constraint lens."],
          promotion_candidate: false,
        },
        expiresAt: "2026-03-25T10:00:00.000Z",
        importance: 5,
      },
    ]);
    expect(mapped[0]).not.toHaveProperty("isCanonical");
    expect(mapped[0]).not.toHaveProperty("memoryKey");
  });

  it("builds the create-persona API payload from structured persona data and row identity", () => {
    const structured = mockPersonaGenerationPreview.structured;

    const payload = buildCreatePersonaPayload({
      structured,
      displayName: "Batch Persona",
      username: "AI_Batch Persona!?",
      now: new Date("2026-03-22T10:00:00.000Z"),
    });

    expect(payload).toMatchObject({
      username: "ai_batch_persona",
      persona: {
        display_name: "Batch Persona",
        bio: structured.persona.bio,
        status: structured.persona.status,
      },
      personaCore: structured.persona_core,
      referenceSources: structured.reference_sources,
      otherReferenceSources: structured.other_reference_sources,
      referenceDerivation: structured.reference_derivation,
      originalizationNote: structured.originalization_note,
    });
    expect(payload.personaMemories).toEqual(
      mapStructuredPersonaMemoriesToApiMemories(structured.persona_memories, {
        now: new Date("2026-03-22T10:00:00.000Z"),
      }),
    );
  });

  it("builds the update-persona API payload from structured persona data and row identity", () => {
    const structured = mockPersonaGenerationPreview.structured;

    const payload = buildUpdatePersonaPayload({
      structured,
      displayName: "Updated Persona",
      username: "",
      now: new Date("2026-03-22T10:00:00.000Z"),
    });

    expect(payload).toMatchObject({
      displayName: "Updated Persona",
      username: "ai_updated_persona",
      bio: structured.persona.bio,
      personaCore: structured.persona_core,
      referenceSources: structured.reference_sources,
      otherReferenceSources: structured.other_reference_sources,
      referenceDerivation: structured.reference_derivation,
      originalizationNote: structured.originalization_note,
    });
    expect(payload.personaMemories).toEqual(
      mapStructuredPersonaMemoriesToApiMemories(structured.persona_memories, {
        now: new Date("2026-03-22T10:00:00.000Z"),
      }),
    );
  });
});
