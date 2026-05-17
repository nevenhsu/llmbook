import rawFixture from "@/mock-data/persona-generation-preview.json";
import { PERSONA_GENERATION_BUDGETS } from "@/lib/ai/admin/persona-generation-token-budgets";
import {
  buildPersonaGenerationPrompt,
  renderPersonaGenerationPromptBlock,
} from "@/lib/ai/prompt-runtime/persona/generation-prompt-builder";
import { buildTokenBudgetSignal, DEFAULT_TOKEN_LIMITS } from "@/lib/ai/admin/control-plane-shared";
import type {
  PreviewResult,
  PersonaGenerationStructured,
} from "@/lib/ai/admin/control-plane-store";

const codeFence = "```";

const fixture = (
  rawFixture as {
    preview: {
      modelDisplayName?: string;
      adminExtraPrompt?: string;
      tokenBudget?: PreviewResult["tokenBudget"];
      structured: PersonaGenerationStructured;
    };
  }
).preview as {
  modelDisplayName: string;
  adminExtraPrompt: string;
  tokenBudget: PreviewResult["tokenBudget"];
  structured: PersonaGenerationStructured;
};

export const mockPersonaGenerationModelDisplayName =
  fixture.modelDisplayName ?? "Mock Persona Model";
export const mockPersonaGenerationAdminExtraPrompt =
  fixture.adminExtraPrompt ??
  "A cynical tech journalist persona with a clear opening angle, recurring launch/crime-scene metaphors, sharp attacks on weak claims, and grudging praise only after proof.";
export const mockPersonaGenerationSeedPrompt =
  "Cynical tech journalist persona with John Grisham paranoia and Elon Musk theatrics.";

const promptBuild = buildPersonaGenerationPrompt({
  extraPrompt: fixture.adminExtraPrompt,
  referenceNames: "",
});

const mockTokenBudget = buildTokenBudgetSignal({
  blocks: promptBuild.blocks.map((block) => ({
    name: block.name,
    content: renderPersonaGenerationPromptBlock(block),
  })),
  maxInputTokens: DEFAULT_TOKEN_LIMITS.personaGenerationMaxInputTokens,
  maxOutputTokens: PERSONA_GENERATION_BUDGETS.previewMaxOutputTokens,
});

const markdown = [
  `## Persona Preview (${fixture.modelDisplayName})`,
  "",
  "### persona",
  `- display_name: ${fixture.structured.persona.display_name}`,
  `- status: ${fixture.structured.persona.status}`,
  `- bio: ${fixture.structured.persona.bio}`,
  "",
  "### persona_core",
  `${codeFence}json`,
  JSON.stringify(fixture.structured.persona_core, null, 2),
  codeFence,
  "",
  `### reference_sources (${fixture.structured.reference_sources.length})`,
  `${codeFence}json`,
  JSON.stringify(fixture.structured.reference_sources, null, 2),
  codeFence,
  "",
  `### other_reference_sources (${fixture.structured.other_reference_sources.length})`,
  `${codeFence}json`,
  JSON.stringify(fixture.structured.other_reference_sources, null, 2),
  codeFence,
  "",
  "### reference_derivation",
  `${codeFence}json`,
  JSON.stringify(fixture.structured.reference_derivation, null, 2),
  codeFence,
  "",
  "### originalization_note",
  fixture.structured.originalization_note,
].join("\n");

export const mockPersonaGenerationPreview: PreviewResult & {
  structured: PersonaGenerationStructured;
} = {
  markdown,
  renderOk: true,
  renderError: null,
  tokenBudget: {
    ...mockTokenBudget,
    ...fixture.tokenBudget,
    maxOutputTokens: PERSONA_GENERATION_BUDGETS.previewMaxOutputTokens,
  },
  structured: fixture.structured,
};
