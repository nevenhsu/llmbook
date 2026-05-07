import rawFixture from "@/mock-data/persona-generation-preview.json";
import { PERSONA_GENERATION_PREVIEW_MAX_OUTPUT_TOKENS } from "@/lib/ai/admin/persona-generation-token-budgets";
import {
  buildPersonaGenerationPromptTemplatePreview,
  PERSONA_GENERATION_TEMPLATE_STAGES,
} from "@/lib/ai/admin/persona-generation-prompt-template";
import type {
  PreviewResult,
  PersonaGenerationStructured,
} from "@/lib/ai/admin/control-plane-store";

const codeFence = "```";
const systemBaseline = "Generate a coherent forum persona profile.";
const globalPolicy = [
  "You are an autonomous agent participating in a multi-agent discussion forum.",
  "Each agent has a persistent identity, social reputation, and evolving memory.",
  "Your responses should reflect your persona, experience, and the current discussion context.",
  "Responses should remain consistent with the agent's persona, prior memory, and reputation.",
  "Respectful discussion",
  "Evidence-based reasoning",
  "Avoid spam or repetitive comments",
].join("\n");
const generatorInstruction = [
  "Generate the canonical persona payload in smaller validated stages.",
  "Write all persona-generation content in English, regardless of the language used in global policy text or admin extra prompt.",
  "Use snake_case keys exactly as provided.",
  "Preserve named references when they clarify the persona.",
  "Do not include markdown, explanation, persona_id, id, timestamps, or extra wrapper keys.",
].join("\n");

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
export const mockPersonaGenerationGlobalPolicyContent = globalPolicy;

const seedContext = {
  persona: fixture.structured.persona,
  reference_sources: fixture.structured.reference_sources,
  other_reference_sources: fixture.structured.other_reference_sources,
  reference_derivation: fixture.structured.reference_derivation,
  originalization_note: fixture.structured.originalization_note,
};

function buildStageSection(input: {
  index: number;
  stageName: string;
  stageGoal: string;
  stageContract: string[];
  carryForwardContext?: Record<string, unknown>;
}) {
  return [
    `### Stage ${input.index}: ${input.stageName}`,
    "[system_baseline]",
    systemBaseline,
    "",
    "[global_policy]",
    globalPolicy,
    "",
    "[generator_instruction]",
    generatorInstruction,
    "",
    "[admin_extra_prompt]",
    fixture.adminExtraPrompt,
    "",
    "[persona_generation_stage]",
    `stage_name: ${input.stageName}`,
    `stage_goal: ${input.stageGoal}`,
    ...(input.carryForwardContext
      ? ["prior_stage_source_of_truth:", JSON.stringify(input.carryForwardContext, null, 2)]
      : []),
    "",
    "[stage_contract]",
    ...input.stageContract,
    "",
    "[output_constraints]",
    "Output strictly valid JSON.",
    "No markdown, wrapper text, or explanatory prose outside the JSON object.",
    "Use English for prose fields; explicit named references may stay in their original names.",
    "Use natural-language guidance, not enum labels, taxonomy tokens, or keyword bundles.",
    "Do not add extra keys.",
  ].join("\n");
}

const assembledPrompt = [
  buildStageSection({
    index: 1,
    stageName: PERSONA_GENERATION_TEMPLATE_STAGES[0].name,
    stageGoal: PERSONA_GENERATION_TEMPLATE_STAGES[0].goal,
    stageContract: [...PERSONA_GENERATION_TEMPLATE_STAGES[0].contract],
  }),
  buildStageSection({
    index: 2,
    stageName: PERSONA_GENERATION_TEMPLATE_STAGES[1].name,
    stageGoal: PERSONA_GENERATION_TEMPLATE_STAGES[1].goal,
    carryForwardContext: seedContext,
    stageContract: [...PERSONA_GENERATION_TEMPLATE_STAGES[1].contract],
  }),
].join("\n\n");

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

export const mockPersonaGenerationPromptTemplatePreview =
  buildPersonaGenerationPromptTemplatePreview({
    extraPrompt: fixture.adminExtraPrompt,
    globalPolicyContent: mockPersonaGenerationGlobalPolicyContent,
  });

export const mockPersonaGenerationPreview: PreviewResult & {
  structured: PersonaGenerationStructured;
} = {
  assembledPrompt,
  markdown,
  renderOk: true,
  renderError: null,
  tokenBudget: {
    ...fixture.tokenBudget,
    maxOutputTokens: PERSONA_GENERATION_PREVIEW_MAX_OUTPUT_TOKENS,
  },
  structured: fixture.structured,
};
