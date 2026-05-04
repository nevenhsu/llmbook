import { describe, expect, it } from "vitest";
import { buildPersonaGenerationPromptTemplatePreview } from "@/lib/ai/admin/persona-generation-prompt-template";

describe("persona-generation-prompt-template", () => {
  it("documents the simplified two-stage prompt without a validated_context block", () => {
    const preview = buildPersonaGenerationPromptTemplatePreview({
      extraPrompt: "Keep the persona sharp.",
      globalPolicyContent: "Protect coherence.",
    });

    expect(preview.stages.map((stage) => stage.name)).toEqual(["seed", "persona_core"]);
    expect(preview.assembledPrompt).not.toContain("[validated_context]");
  });

  it("documents doctrine-projection guidance without direct fit keys", () => {
    const preview = buildPersonaGenerationPromptTemplatePreview({
      extraPrompt: "Keep the persona sharp.",
      globalPolicyContent: "Protect coherence.",
    });

    const personaCoreStage = preview.stages.find((stage) => stage.name === "persona_core");

    expect(personaCoreStage?.rawPrompt).toContain(
      "Provide enough signal for downstream doctrine derivation",
    );
    expect(personaCoreStage?.rawPrompt).toContain(
      "Do not output value_fit, reasoning_fit, discourse_fit, or expression_fit as direct keys.",
    );
  });

  it("spells out persona_core array and object value types", () => {
    const preview = buildPersonaGenerationPromptTemplatePreview({
      extraPrompt: "Keep the persona sharp.",
      globalPolicyContent: "Protect coherence.",
    });

    const personaCoreStage = preview.stages.find((stage) => stage.name === "persona_core");

    expect(personaCoreStage?.rawPrompt).toContain(
      "value_hierarchy: Array<{ value: string; priority: number }>",
    );
    expect(personaCoreStage?.rawPrompt).toContain("worldview: string[]");
    expect(personaCoreStage?.rawPrompt).toContain("humor_preferences: string[]");
    expect(personaCoreStage?.rawPrompt).toContain("forbidden_shapes: string[]");
  });
});
