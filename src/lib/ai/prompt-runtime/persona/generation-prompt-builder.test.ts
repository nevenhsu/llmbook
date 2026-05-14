import { describe, it, expect } from "vitest";
import {
  buildPersonaGenerationPrompt,
  EMPTY_PERSONA_GENERATION_REFERENCE_NAMES,
  EMPTY_PERSONA_GENERATION_USER_INPUT_CONTEXT,
  PERSONA_GENERATION_CONTRACT,
  renderPersonaGenerationContract,
} from "./generation-prompt-builder";

describe("PERSONA_GENERATION_CONTRACT", () => {
  it("contains the current contract sections", () => {
    const contractText = PERSONA_GENERATION_CONTRACT.join("\n");

    expect(contractText).toContain("[task]");
    expect(contractText).toContain("[input]");
    expect(contractText).toContain("[reference_rules]");
    expect(contractText).toContain("[schema_guidance]");
    expect(contractText).toContain("[compactness]");
    expect(contractText).toContain("[internal_design_process]");
  });

  it("contract contains no legacy seed stage", () => {
    const contractText = PERSONA_GENERATION_CONTRACT.join("\n");
    expect(contractText).not.toContain("seed");
  });

  it("contract includes {{USER_INPUT_CONTEXT}} placeholder", () => {
    const contractText = PERSONA_GENERATION_CONTRACT.join("\n");
    expect(contractText).toContain("{{USER_INPUT_CONTEXT}}");
  });

  it("contract includes {{USER_REFERENCE_NAMES}} placeholder", () => {
    const contractText = PERSONA_GENERATION_CONTRACT.join("\n");
    expect(contractText).toContain("{{USER_REFERENCE_NAMES}}");
  });

  it("contract mentions persona_fit_probability", () => {
    const contractText = PERSONA_GENERATION_CONTRACT.join("\n");
    expect(contractText).toContain("persona_fit_probability");
  });

  it("contract mentions reference_style.other_references", () => {
    const contractText = PERSONA_GENERATION_CONTRACT.join("\n");
    expect(contractText).toContain("other_references");
  });

  it("contract does not contain memory or relationship context", () => {
    const contractText = PERSONA_GENERATION_CONTRACT.join("\n");
    expect(contractText).not.toMatch(/\[memory\]/);
    expect(contractText).not.toMatch(/relationship_context/);
  });

  it("contract does not contain default examples", () => {
    const contractText = PERSONA_GENERATION_CONTRACT.join("\n");
    expect(contractText).not.toContain("default examples");
  });
});

describe("buildPersonaGenerationPrompt", () => {
  it("returns assembledPrompt, blocks, and messages", () => {
    const result = buildPersonaGenerationPrompt({
      extraPrompt: "extra",
      referenceNames: "",
    });

    expect(result.assembledPrompt).toBeTruthy();
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it("returns blocks with expected names", () => {
    const result = buildPersonaGenerationPrompt({
      extraPrompt: "extra",
      referenceNames: "",
    });

    const blockNames = result.blocks.map((b) => b.name);
    expect(blockNames).toContain("system_baseline");
    expect(blockNames).toContain("generator_instruction");
    expect(blockNames).toContain("stage_contract");
    expect(blockNames).toContain("output_constraints");
  });

  it("does not produce ### Stage formatting", () => {
    const result = buildPersonaGenerationPrompt({
      extraPrompt: "extra",
      referenceNames: "",
    });

    expect(result.assembledPrompt).not.toContain("### Stage");
  });

  it("does not contain legacy multi-stage artifacts", () => {
    const result = buildPersonaGenerationPrompt({
      extraPrompt: "extra",
      referenceNames: "Ref1, Ref2",
    });

    expect(result.assembledPrompt).not.toContain("seed");
    expect(result.assembledPrompt).not.toContain("Stage 1");
    expect(result.assembledPrompt).not.toContain("Stage 2");
  });

  it("omits admin_extra_prompt block when user input exists", () => {
    const result = buildPersonaGenerationPrompt({
      extraPrompt: "Make a severe but useful systems critic.",
      referenceNames: "",
    });

    expect(result.assembledPrompt).not.toContain("[admin_extra_prompt]");
    expect(result.assembledPrompt).toContain(
      "user_input_context:\nMake a severe but useful systems critic.",
    );
  });

  it("never renders an admin_extra_prompt block", () => {
    const result = buildPersonaGenerationPrompt({
      extraPrompt: "",
      referenceNames: "",
    });

    expect(result.assembledPrompt).not.toContain("[admin_extra_prompt]");
    expect(result.assembledPrompt).toContain(
      `user_input_context:\n${EMPTY_PERSONA_GENERATION_USER_INPUT_CONTEXT}`,
    );
    expect(result.assembledPrompt).toContain(
      `reference_names:\n${EMPTY_PERSONA_GENERATION_REFERENCE_NAMES}`,
    );
  });

  it("messages have correct roles", () => {
    const result = buildPersonaGenerationPrompt({
      extraPrompt: "extra",
      referenceNames: "",
    });

    const roles = result.messages.map((m) => m.role);
    expect(roles).toContain("system");
    expect(roles).toContain("user");
  });

  it("same input produces same assembled prompt on repeated calls", () => {
    const input = { extraPrompt: "A sharp critic.", referenceNames: "Orwell, Hitchens" };
    const a = buildPersonaGenerationPrompt(input);
    const b = buildPersonaGenerationPrompt(input);

    expect(a.assembledPrompt).toBe(b.assembledPrompt);
  });
});

describe("renderPersonaGenerationContract", () => {
  it("injects extraPrompt into USER_INPUT_CONTEXT placeholder", () => {
    const result = renderPersonaGenerationContract(
      PERSONA_GENERATION_CONTRACT.join("\n"),
      "Test context",
      "",
    );

    expect(result).toContain("Test context");
    expect(result).not.toContain("{{USER_INPUT_CONTEXT}}");
  });

  it("injects referenceNames into USER_REFERENCE_NAMES placeholder", () => {
    const result = renderPersonaGenerationContract(
      PERSONA_GENERATION_CONTRACT.join("\n"),
      "",
      "Ref1, Ref2",
    );

    expect(result).toContain("Ref1, Ref2");
    expect(result).not.toContain("{{USER_REFERENCE_NAMES}}");
    expect(result).toContain("reference_names:\nRef1, Ref2");
  });

  it("replaces empty input placeholders with required fallback text", () => {
    const result = renderPersonaGenerationContract(PERSONA_GENERATION_CONTRACT.join("\n"), "", "");

    expect(result).toContain("[input]");
    expect(result).toContain(EMPTY_PERSONA_GENERATION_USER_INPUT_CONTEXT);
    expect(result).toContain(EMPTY_PERSONA_GENERATION_REFERENCE_NAMES);
    expect(result).not.toContain("{{USER_INPUT_CONTEXT}}");
    expect(result).not.toContain("{{USER_REFERENCE_NAMES}}");
  });

  it("treats whitespace-only extraPrompt and referenceNames as empty", () => {
    const result = renderPersonaGenerationContract(
      PERSONA_GENERATION_CONTRACT.join("\n"),
      "   ",
      "\n\t",
    );

    expect(result).toContain(EMPTY_PERSONA_GENERATION_USER_INPUT_CONTEXT);
    expect(result).toContain(EMPTY_PERSONA_GENERATION_REFERENCE_NAMES);
  });
});
