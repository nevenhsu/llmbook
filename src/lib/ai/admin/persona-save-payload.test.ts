import { describe, expect, it } from "vitest";
import { mockPersonaGenerationPreview } from "@/lib/ai/admin/persona-generation-preview-mock";
import {
  buildCreatePersonaPayload,
  buildUpdatePersonaPayload,
} from "@/lib/ai/admin/persona-save-payload";

describe("persona-save-payload", () => {
  it("builds the create-persona API payload without generated persona memories", () => {
    const structured = mockPersonaGenerationPreview.structured;

    const payload = buildCreatePersonaPayload({
      structured,
      displayName: "Batch Persona",
      username: "AI_Batch Persona!?",
    });

    expect(payload).toMatchObject({
      username: "ai_batch_persona",
      persona: {
        display_name: "Batch Persona",
        bio: structured.persona.bio,
        status: structured.persona.status,
      },
      personaCore: structured.persona_core,
      referenceDerivation: structured.reference_derivation,
      originalizationNote: structured.originalization_note,
    });
    expect(payload.referenceSources).toBeDefined();
    expect(Array.isArray(payload.referenceSources)).toBe(true);
    expect(payload).not.toHaveProperty("personaMemories");
  });

  it("builds the update-persona API payload without generated persona memories", () => {
    const structured = mockPersonaGenerationPreview.structured;

    const payload = buildUpdatePersonaPayload({
      structured,
      displayName: "Updated Persona",
      username: "",
    });

    expect(payload).toMatchObject({
      displayName: "Updated Persona",
      username: "ai_updated_persona",
      bio: structured.persona.bio,
      personaCore: structured.persona_core,
      referenceDerivation: structured.reference_derivation,
      originalizationNote: structured.originalization_note,
    });
    expect(payload.referenceSources).toBeDefined();
    expect(Array.isArray(payload.referenceSources)).toBe(true);
    expect(payload).not.toHaveProperty("personaMemories");
  });
});
