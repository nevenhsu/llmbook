import { describe, it, expect } from "vitest";
import {
  PERSONA_GENERATION_TEMPLATE_STAGES,
  buildPersonaGenerationPromptTemplatePreview,
} from "./persona-generation-prompt-template";

describe("PERSONA_GENERATION_TEMPLATE_STAGES", () => {
  it("has exactly one stage: persona_core_v2", () => {
    expect(PERSONA_GENERATION_TEMPLATE_STAGES).toHaveLength(1);
    expect(PERSONA_GENERATION_TEMPLATE_STAGES[0].name).toBe("persona_core_v2");
  });

  it("rendered prompt contains exactly the eight target blocks", () => {
    const contract = PERSONA_GENERATION_TEMPLATE_STAGES[0].contract;
    const contractText = contract.join("\n");

    expect(contractText).toContain("[task]");
    expect(contractText).toContain("[input]");
    expect(contractText).toContain("[reference_rules]");
    expect(contractText).toContain("[persona_rules]");
    expect(contractText).toContain("[fit_probability]");
    expect(contractText).toContain("[compactness]");
    expect(contractText).toContain("[internal_design_process]");
    expect(contractText).toContain("[output_validation]");
  });

  it("[output_validation] contains only short validation reminders, no hardcoded key/type JSON schema text", () => {
    const contract = PERSONA_GENERATION_TEMPLATE_STAGES[0].contract;
    // Find the output_validation section
    const valIndex = contract.findIndex((line) => line === "[output_validation]");
    expect(valIndex).toBeGreaterThan(-1);

    const validationLines = contract.slice(valIndex);

    // Should NOT contain full JSON key/type schema text
    const fullText = validationLines.join("\n");
    expect(fullText).not.toContain("identity: {");
    expect(fullText).not.toContain("mind: {");
    expect(fullText).not.toContain("taste: {");
    expect(fullText).not.toContain("voice: {");
    expect(fullText).not.toContain("forum: {");
    expect(fullText).not.toContain("narrative: {");
    expect(fullText).not.toContain("reference_style: {");
    expect(fullText).not.toContain("anti_generic: {");
  });

  it("template contains no legacy seed or persona_core stage", () => {
    const names = PERSONA_GENERATION_TEMPLATE_STAGES.map((s) => s.name);
    expect(names).not.toContain("seed");
    expect(names.length === 1 && names[0] === "persona_core_v2").toBe(true);
  });

  it("template includes {{USER_INPUT_CONTEXT}} placeholder", () => {
    const contractText = PERSONA_GENERATION_TEMPLATE_STAGES[0].contract.join("\n");
    expect(contractText).toContain("{{USER_INPUT_CONTEXT}}");
  });

  it("template includes {{USER_REFERENCE_NAMES}} placeholder", () => {
    const contractText = PERSONA_GENERATION_TEMPLATE_STAGES[0].contract.join("\n");
    expect(contractText).toContain("{{USER_REFERENCE_NAMES}}");
  });

  it("template mentions persona_fit_probability", () => {
    const contractText = PERSONA_GENERATION_TEMPLATE_STAGES[0].contract.join("\n");
    expect(contractText).toContain("persona_fit_probability");
  });

  it("template mentions reference_style.other_references", () => {
    const contractText = PERSONA_GENERATION_TEMPLATE_STAGES[0].contract.join("\n");
    expect(contractText).toContain("other_references");
  });

  it("template does not contain memory or relationship context", () => {
    const contractText = PERSONA_GENERATION_TEMPLATE_STAGES[0].contract.join("\n");
    expect(contractText).not.toMatch(/\[memory\]/);
    expect(contractText).not.toMatch(/relationship_context/);
  });

  it("template does not contain default examples", () => {
    const contractText = PERSONA_GENERATION_TEMPLATE_STAGES[0].contract.join("\n");
    expect(contractText).not.toContain("default examples");
  });
});

describe("buildPersonaGenerationPromptTemplatePreview", () => {
  it("returns one stage in preview", () => {
    const preview = buildPersonaGenerationPromptTemplatePreview({
      extraPrompt: "extra",
      referenceNames: "",
      globalPolicyContent: "policy",
    });
    expect(preview.stages).toHaveLength(1);
    expect(preview.stages[0].name).toBe("persona_core_v2");
  });

  it("returns one block stat", () => {
    const preview = buildPersonaGenerationPromptTemplatePreview({
      extraPrompt: "extra",
      referenceNames: "",
      globalPolicyContent: "policy",
    });
    expect(preview.tokenBudget.blockStats).toHaveLength(1);
    expect(preview.tokenBudget.blockStats[0].name).toBe("persona_core_v2");
  });

  it("omits admin_extra_prompt when user input exists", () => {
    const preview = buildPersonaGenerationPromptTemplatePreview({
      extraPrompt: "Make a severe but useful systems critic.",
      referenceNames: "",
      globalPolicyContent: "policy",
    });

    expect(preview.assembledPrompt).not.toContain("[admin_extra_prompt]");
    expect(preview.assembledPrompt).toContain(
      "user_input_context:\nMake a severe but useful systems critic.",
    );
  });

  it("never renders an admin_extra_prompt block", () => {
    const preview = buildPersonaGenerationPromptTemplatePreview({
      extraPrompt: "",
      referenceNames: "",
      globalPolicyContent: "policy",
    });

    expect(preview.assembledPrompt).not.toContain("[admin_extra_prompt]");
  });
});
