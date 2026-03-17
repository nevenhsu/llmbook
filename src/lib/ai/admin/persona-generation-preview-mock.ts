import rawFixture from "@/mock-data/persona-generation-preview.json";
import { PERSONA_GENERATION_PREVIEW_MAX_OUTPUT_TOKENS } from "@/lib/ai/admin/persona-generation-token-budgets";
import { buildPersonaGenerationPromptTemplatePreview } from "@/lib/ai/admin/persona-generation-prompt-template";
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
  personas: fixture.structured.personas,
  identity_summary: fixture.structured.persona_core.identity_summary,
  reference_sources: fixture.structured.reference_sources,
  reference_derivation: fixture.structured.reference_derivation,
  originalization_note: fixture.structured.originalization_note,
};

const valuesAestheticContext = {
  ...seedContext,
  values: fixture.structured.persona_core.values,
  aesthetic_profile: fixture.structured.persona_core.aesthetic_profile,
};

const interactionContext = {
  ...valuesAestheticContext,
  lived_context: fixture.structured.persona_core.lived_context,
  creator_affinity: fixture.structured.persona_core.creator_affinity,
};

const memoriesContext = {
  personas: fixture.structured.personas,
  persona_core: fixture.structured.persona_core,
  reference_sources: fixture.structured.reference_sources,
};

function buildStageSection(input: {
  index: number;
  stageName: string;
  stageGoal: string;
  stageContract: string[];
  validatedContext?: Record<string, unknown>;
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
    "",
    ...(input.validatedContext
      ? ["[validated_context]", JSON.stringify(input.validatedContext, null, 2), ""]
      : []),
    "[stage_contract]",
    ...input.stageContract,
    "",
    "[output_constraints]",
    "Output strictly valid JSON.",
  ].join("\n");
}

const assembledPrompt = [
  buildStageSection({
    index: 1,
    stageName: "seed",
    stageGoal: "Establish the persona's identity seed, bio, and explicit references.",
    stageContract: [
      "Return one JSON object with keys:",
      "personas{display_name,bio,status},",
      "identity_summary{archetype,core_motivation,one_sentence_identity},",
      "reference_sources[{name,type,contribution}],",
      "reference_derivation:string[],",
      "originalization_note:string.",
      "status should be active or inactive.",
      "The final persona must be reference-inspired, not reference-cosplay.",
      "Keep named references inside reference_sources and reference_derivation; do not turn bio or identity_summary into the literal canon character.",
      "Avoid copying in-universe goals, titles, adversaries, or mixed-language artifacts into the final persona identity.",
    ],
  }),
  buildStageSection({
    index: 2,
    stageName: "values_and_aesthetic",
    stageGoal: "Define the persona's values and aesthetic taste using the seed identity.",
    validatedContext: seedContext,
    stageContract: [
      "Return one JSON object with keys:",
      "values{value_hierarchy,worldview,judgment_style},",
      "aesthetic_profile{humor_preferences,narrative_preferences,creative_preferences,disliked_patterns,taste_boundaries}.",
      "value_hierarchy must be an array of {value,priority} objects.",
      "Write values and aesthetic preferences as natural-language persona guidance, not snake_case labels or keyword bundles.",
    ],
  }),
  buildStageSection({
    index: 3,
    stageName: "context_and_affinity",
    stageGoal: "Ground the persona in lived context and creator affinity.",
    validatedContext: valuesAestheticContext,
    stageContract: [
      "Return one JSON object with keys:",
      "lived_context{familiar_scenes_of_life,personal_experience_flavors,cultural_contexts,topics_with_confident_grounding,topics_requiring_runtime_retrieval},",
      "creator_affinity{admired_creator_types,structural_preferences,detail_selection_habits,creative_biases}.",
    ],
  }),
  buildStageSection({
    index: 4,
    stageName: "interaction_and_guardrails",
    stageGoal: "Define how the persona behaves in discussion and what it avoids.",
    validatedContext: interactionContext,
    stageContract: [
      "Return one JSON object with keys:",
      "interaction_defaults{default_stance,discussion_strengths,friction_triggers,non_generic_traits},",
      "guardrails{hard_no,deescalation_style},",
      "voice_fingerprint{opening_move,metaphor_domains,attack_style,praise_style,closing_move,forbidden_shapes},",
      "task_style_matrix{post{entry_shape,body_shape,close_shape,forbidden_shapes},comment{entry_shape,feedback_shape,close_shape,forbidden_shapes}}.",
      "Use natural-language behavioral descriptions, not enum labels or taxonomy tokens.",
      "Do not output snake_case identifier-style values like impulsive_challenge or bold_declaration.",
      "Every style-bearing string should read like prompt-ready persona guidance another model can directly follow.",
    ],
  }),
  buildStageSection({
    index: 5,
    stageName: "memories",
    stageGoal: "Optionally add a few useful canonical or recent persona memories.",
    validatedContext: memoriesContext,
    stageContract: [
      "Return one JSON object with key:",
      "persona_memories[{memory_type,scope,memory_key,content,metadata,expires_in_hours,is_canonical,importance}].",
      "persona_memories may be an empty array if no useful memories should be added.",
      "memory_type must be memory or long_memory.",
      "scope must be persona, thread, or task.",
    ],
  }),
].join("\n\n");

const markdown = [
  `## Persona Preview (${fixture.modelDisplayName})`,
  "",
  "### personas",
  `- display_name: ${fixture.structured.personas.display_name}`,
  `- status: ${fixture.structured.personas.status}`,
  `- bio: ${fixture.structured.personas.bio}`,
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
  "### reference_derivation",
  `${codeFence}json`,
  JSON.stringify(fixture.structured.reference_derivation, null, 2),
  codeFence,
  "",
  "### originalization_note",
  fixture.structured.originalization_note,
  "",
  `### persona_memories (${fixture.structured.persona_memories.length})`,
  `${codeFence}json`,
  JSON.stringify(fixture.structured.persona_memories, null, 2),
  codeFence,
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
