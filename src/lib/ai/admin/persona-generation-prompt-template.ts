import {
  PERSONA_GENERATION_MAX_INPUT_TOKENS,
  PERSONA_GENERATION_PREVIEW_MAX_OUTPUT_TOKENS,
} from "@/lib/ai/admin/persona-generation-token-budgets";

export type PromptBlockStat = {
  name: string;
  tokens: number;
};

export type PromptAssemblyPreview = {
  assembledPrompt: string;
  stages: Array<{
    index: number;
    name: string;
    goal: string;
    rawPrompt: string;
    tokens: number;
  }>;
  tokenBudget: {
    estimatedInputTokens: number;
    maxInputTokens: number;
    maxOutputTokens: number;
    blockStats: PromptBlockStat[];
    compressedStages: Array<"memory" | "long_memory">;
    exceeded: boolean;
    message: string | null;
  };
};

export const PERSONA_GENERATION_SYSTEM_BASELINE = "Generate a coherent forum persona profile.";
export const PERSONA_GENERATION_GENERATOR_INSTRUCTION = [
  "Generate the canonical persona payload in smaller validated stages.",
  "Write all persona-generation content in English, regardless of the language used in global policy text or admin extra prompt.",
  "Use snake_case keys exactly as provided.",
  "Preserve named references when they clarify the persona.",
  "Do not include markdown, explanation, persona_id, id, timestamps, or extra wrapper keys.",
].join("\n");
export const PERSONA_GENERATION_OUTPUT_CONSTRAINTS = [
  "Output strictly valid JSON.",
  "No markdown, wrapper text, or explanatory prose outside the JSON object.",
  "Use English for prose fields; explicit named references may stay in their original names.",
  "Use natural-language guidance, not enum labels, taxonomy tokens, or keyword bundles.",
  "Do not add extra keys.",
].join("\n");
const PERSONA_GENERATION_ADMIN_EXTRA_PROMPT_PLACEHOLDER = "(from Context / Extra Prompt input)";

export const PERSONA_GENERATION_TEMPLATE_STAGES = [
  {
    name: "seed",
    goal: "Establish the persona's identity seed, bio, and explicit references.",
    contract: [
      "Return one JSON object with exactly these top-level keys:",
      "persona: { display_name: string; bio: string }",
      "identity_summary: { archetype: string; core_motivation: string; one_sentence_identity: string }",
      "reference_sources: Array<{ name: string; type: string; contribution: string[] }>",
      "other_reference_sources: Array<{ name: string; type: string; contribution: string[] }>",
      "reference_derivation: string[]",
      "originalization_note: string",
      "The final persona must be reference-inspired, not reference-cosplay.",
      "reference_sources must contain only personality-bearing named references such as real people, historical figures, fictional characters, mythic figures, or iconic personas.",
      "Place works, films, books, concepts, methods, principles, groups, places, and other non-personality references in other_reference_sources instead.",
      "Keep named references inside reference_sources, other_reference_sources, and reference_derivation; do not turn bio or identity_summary into the literal canon character.",
      "Avoid copying in-universe goals, titles, adversaries, or mixed-language artifacts into the final persona identity.",
    ],
  },
  {
    name: "persona_core",
    goal: "Generate the reusable persona guidance that downstream prompts will consume.",
    contract: [
      "Return one JSON object with exactly these top-level keys:",
      "values: { value_hierarchy: Array<{ value: string; priority: number }>; worldview: string[]; judgment_style: string }",
      "aesthetic_profile: { humor_preferences: string[]; narrative_preferences: string[]; creative_preferences: string[]; disliked_patterns: string[]; taste_boundaries: string[] }",
      "lived_context: { familiar_scenes_of_life: string[]; personal_experience_flavors: string[]; cultural_contexts: string[]; topics_with_confident_grounding: string[]; topics_requiring_runtime_retrieval: string[] }",
      "creator_affinity: { admired_creator_types: string[]; structural_preferences: string[]; detail_selection_habits: string[]; creative_biases: string[] }",
      "interaction_defaults: { default_stance: string; discussion_strengths: string[]; friction_triggers: string[]; non_generic_traits: string[] }",
      "guardrails: { hard_no: string[]; deescalation_style: string }",
      "voice_fingerprint: { opening_move: string; metaphor_domains: string[]; attack_style: string; praise_style: string; closing_move: string; forbidden_shapes: string[] }",
      "task_style_matrix: { post: { entry_shape: string; body_shape: string; close_shape: string; forbidden_shapes: string[] }; comment: { entry_shape: string; feedback_shape: string; close_shape: string; forbidden_shapes: string[] } }",
      "Every field marked string[] must be a JSON array of strings, even if it contains only one item.",
      "value_hierarchy must be a JSON array of objects, never a single string or object map.",
      "Use natural-language behavioral descriptions, not enum labels or taxonomy tokens.",
      "Do not output snake_case identifier-style values like impulsive_challenge or bold_declaration.",
      "Every style-bearing string should read like prompt-ready persona guidance another model can directly follow.",
      "Provide enough signal for downstream doctrine derivation across value_fit, reasoning_fit, discourse_fit, and expression_fit.",
      "Do not output value_fit, reasoning_fit, discourse_fit, or expression_fit as direct keys.",
    ],
  },
] as const;

function estimateTokens(content: string): number {
  const normalized = content.trim();
  if (!normalized) {
    return 0;
  }
  return Math.max(1, Math.ceil(normalized.length / 4));
}

function formatPrompt(blocks: Array<{ name: string; content: string }>): string {
  return blocks.map((block) => `[${block.name}]\n${block.content || "(empty)"}`).join("\n\n");
}

export function buildPersonaGenerationPromptTemplatePreview(input: {
  extraPrompt: string;
  globalPolicyContent: string;
}): PromptAssemblyPreview {
  const commonBlocks = [
    { name: "system_baseline", content: PERSONA_GENERATION_SYSTEM_BASELINE },
    { name: "global_policy", content: input.globalPolicyContent },
    { name: "generator_instruction", content: PERSONA_GENERATION_GENERATOR_INSTRUCTION },
    {
      name: "admin_extra_prompt",
      content: PERSONA_GENERATION_ADMIN_EXTRA_PROMPT_PLACEHOLDER,
    },
  ];

  const stagePrompts = PERSONA_GENERATION_TEMPLATE_STAGES.map((stage, index) => {
    const prompt = formatPrompt([
      ...commonBlocks,
      {
        name: "persona_generation_stage",
        content: [`stage_name: ${stage.name}`, `stage_goal: ${stage.goal}`].join("\n"),
      },
      { name: "stage_contract", content: stage.contract.join("\n") },
      {
        name: "output_constraints",
        content: PERSONA_GENERATION_OUTPUT_CONSTRAINTS,
      },
    ]);

    return {
      name: stage.name,
      assembled: `### Stage ${index + 1}: ${stage.name}\n${prompt}`,
      tokens: estimateTokens(prompt),
    };
  });

  const estimatedInputTokens = stagePrompts.reduce((sum, stage) => sum + stage.tokens, 0);
  const maxInputTokens =
    PERSONA_GENERATION_MAX_INPUT_TOKENS * PERSONA_GENERATION_TEMPLATE_STAGES.length;
  const exceeded = estimatedInputTokens > maxInputTokens;

  return {
    assembledPrompt: stagePrompts.map((stage) => stage.assembled).join("\n\n"),
    stages: stagePrompts.map((stage, index) => ({
      index: index + 1,
      name: stage.name,
      goal: PERSONA_GENERATION_TEMPLATE_STAGES[index]?.goal ?? "",
      rawPrompt: stage.assembled.replace(/^### Stage \d+: [^\n]+\n/, ""),
      tokens: stage.tokens,
    })),
    tokenBudget: {
      estimatedInputTokens,
      maxInputTokens,
      maxOutputTokens: PERSONA_GENERATION_PREVIEW_MAX_OUTPUT_TOKENS,
      blockStats: stagePrompts.map((stage) => ({ name: stage.name, tokens: stage.tokens })),
      compressedStages: [],
      exceeded,
      message: exceeded
        ? "Prompt template exceeds the current persona-generation input budget."
        : null,
    },
  };
}
