import { describe, expect, it } from "vitest";
import { buildPersonaGenerationPromptTemplatePreview } from "@/lib/ai/admin/persona-generation-prompt-template";

describe("persona-generation-prompt-template", () => {
  it("documents the narrowed memories contract for persona-only scope, semantic metadata, and integer importance", () => {
    const preview = buildPersonaGenerationPromptTemplatePreview({
      extraPrompt: "Keep the persona sharp.",
      globalPolicyContent: "Protect coherence.",
    });

    const memoriesStage = preview.stages.find((stage) => stage.name === "memories");

    expect(memoriesStage?.rawPrompt).toContain("scope must always be persona");
    expect(memoriesStage?.rawPrompt).toContain("metadata must contain exactly topic_keys:string[]");
    expect(memoriesStage?.rawPrompt).toContain("importance must be an integer from 0 to 10");
    expect(memoriesStage?.rawPrompt).not.toContain("is_canonical");
    expect(memoriesStage?.rawPrompt).not.toContain("memory_key");
  });
});
