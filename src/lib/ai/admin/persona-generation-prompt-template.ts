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

const PERSONA_GENERATION_SYSTEM_BASELINE = "Generate a coherent forum persona profile.";
const PERSONA_GENERATION_GENERATOR_INSTRUCTION = [
  "Generate the canonical persona payload in smaller validated stages.",
  "Use snake_case keys exactly as provided.",
  "Preserve named references when they clarify the persona.",
  "Do not include markdown, explanation, persona_id, id, timestamps, or extra wrapper keys.",
].join("\n");

const PERSONA_GENERATION_TEMPLATE_STAGES = [
  {
    name: "seed",
    goal: "Establish the persona's identity seed, bio, and explicit references.",
    contract: [
      "Return one JSON object with keys:",
      "personas{display_name,bio,status},",
      "identity_summary{archetype,core_motivation,one_sentence_identity},",
      "reference_sources[{name,type,contribution}],",
      "reference_derivation:string[],",
      "originalization_note:string.",
      "status should be active or inactive.",
    ],
  },
  {
    name: "values_and_aesthetic",
    goal: "Define the persona's values and aesthetic taste using the seed identity.",
    contract: [
      "Return one JSON object with keys:",
      "values{value_hierarchy,worldview,judgment_style},",
      "aesthetic_profile{humor_preferences,narrative_preferences,creative_preferences,disliked_patterns,taste_boundaries}.",
      "value_hierarchy must be an array of {value,priority} objects.",
    ],
  },
  {
    name: "context_and_affinity",
    goal: "Ground the persona in lived context and creator affinity.",
    contract: [
      "Return one JSON object with keys:",
      "lived_context{familiar_scenes_of_life,personal_experience_flavors,cultural_contexts,topics_with_confident_grounding,topics_requiring_runtime_retrieval},",
      "creator_affinity{admired_creator_types,structural_preferences,detail_selection_habits,creative_biases}.",
    ],
  },
  {
    name: "interaction_and_guardrails",
    goal: "Define how the persona behaves in discussion and what it avoids.",
    contract: [
      "Return one JSON object with keys:",
      "interaction_defaults{default_stance,discussion_strengths,friction_triggers,non_generic_traits},",
      "guardrails{hard_no,deescalation_style}.",
    ],
  },
  {
    name: "memories",
    goal: "Optionally add a few useful canonical or recent persona memories.",
    contract: [
      "Return one JSON object with key:",
      "persona_memories[{memory_type,scope,memory_key,content,metadata,expires_in_hours,is_canonical,importance}].",
      "persona_memories may be an empty array if no useful memories should be added.",
      "memory_type must be memory or long_memory.",
      "scope must be persona, thread, or task.",
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
    { name: "admin_extra_prompt", content: input.extraPrompt },
  ];

  const stagePrompts = PERSONA_GENERATION_TEMPLATE_STAGES.map((stage, index) => {
    const prompt = formatPrompt([
      ...commonBlocks,
      {
        name: "persona_generation_stage",
        content: [`stage_name: ${stage.name}`, `stage_goal: ${stage.goal}`].join("\n"),
      },
      { name: "stage_contract", content: stage.contract.join("\n") },
      { name: "output_constraints", content: "Output strictly valid JSON." },
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
