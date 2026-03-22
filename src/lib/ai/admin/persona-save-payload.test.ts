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
          memory_key: "core_rule",
          content: "Protect the crew first.",
          metadata: { tag: "value" },
          expires_in_hours: 24,
          is_canonical: true,
          importance: 10,
        },
        {
          memory_type: "memory",
          scope: "thread",
          memory_key: null,
          content: "Won a late-night argument.",
          metadata: {},
          expires_in_hours: null,
          is_canonical: false,
          importance: 4,
        },
      ],
      { now: new Date("2026-03-22T10:00:00.000Z") },
    );

    expect(mapped).toEqual([
      {
        memoryType: "long_memory",
        scope: "persona",
        memoryKey: "core_rule",
        content: "Protect the crew first.",
        metadata: { tag: "value" },
        expiresAt: "2026-03-23T10:00:00.000Z",
        isCanonical: true,
        importance: 10,
      },
      {
        memoryType: "memory",
        scope: "thread",
        memoryKey: null,
        content: "Won a late-night argument.",
        metadata: {},
        expiresAt: null,
        isCanonical: false,
        importance: 4,
      },
    ]);
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
