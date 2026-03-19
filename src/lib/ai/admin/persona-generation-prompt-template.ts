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
    hasValidatedContext: boolean;
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

const PERSONA_GENERATION_SYSTEM_BASELINE = "Generate a coherent forum persona profile.";
const PERSONA_GENERATION_GENERATOR_INSTRUCTION = [
  "Generate the canonical persona payload in smaller validated stages.",
  "Use snake_case keys exactly as provided.",
  "Preserve named references when they clarify the persona.",
  "Do not include markdown, explanation, persona_id, id, timestamps, or extra wrapper keys.",
].join("\n");
const PERSONA_GENERATION_ADMIN_EXTRA_PROMPT_PLACEHOLDER = "(from Context / Extra Prompt input)";

const PERSONA_GENERATION_TEMPLATE_STAGES = [
  {
    name: "seed",
    goal: "Establish the persona's identity seed, bio, and explicit references.",
    hasValidatedContext: false,
    contract: [
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
  },
  {
    name: "values_and_aesthetic",
    goal: "Define the persona's values and aesthetic taste using the seed identity.",
    hasValidatedContext: true,
    contract: [
      "Return one JSON object with keys:",
      "values{value_hierarchy,worldview,judgment_style},",
      "aesthetic_profile{humor_preferences,narrative_preferences,creative_preferences,disliked_patterns,taste_boundaries}.",
      "value_hierarchy must be an array of {value,priority} objects.",
      "Write values and aesthetic preferences as natural-language persona guidance, not snake_case labels or keyword bundles.",
    ],
  },
  {
    name: "context_and_affinity",
    goal: "Ground the persona in lived context and creator affinity.",
    hasValidatedContext: true,
    contract: [
      "Return one JSON object with keys:",
      "lived_context{familiar_scenes_of_life,personal_experience_flavors,cultural_contexts,topics_with_confident_grounding,topics_requiring_runtime_retrieval},",
      "creator_affinity{admired_creator_types,structural_preferences,detail_selection_habits,creative_biases}.",
    ],
  },
  {
    name: "interaction_and_guardrails",
    goal: "Define how the persona behaves in discussion and what it avoids.",
    hasValidatedContext: true,
    contract: [
      "Return one JSON object with keys:",
      "interaction_defaults{default_stance,discussion_strengths,friction_triggers,non_generic_traits},",
      "guardrails{hard_no,deescalation_style},",
      "voice_fingerprint{opening_move,metaphor_domains,attack_style,praise_style,closing_move,forbidden_shapes},",
      "task_style_matrix{post{entry_shape,body_shape,close_shape,forbidden_shapes},comment{entry_shape,feedback_shape,close_shape,forbidden_shapes}}.",
      "Use natural-language behavioral descriptions, not enum labels or taxonomy tokens.",
      "Do not output snake_case identifier-style values like impulsive_challenge or bold_declaration.",
      "Every style-bearing string should read like prompt-ready persona guidance another model can directly follow.",
    ],
  },
  {
    name: "memories",
    goal: "Optionally add a few useful canonical or recent persona memories.",
    hasValidatedContext: true,
    contract: [
      "Return one JSON object with key:",
      "persona_memories[{memory_type,scope,memory_key,content,metadata,expires_in_hours,is_canonical,importance}].",
      "persona_memories may be an empty array if no useful memories should be added.",
      "memory_type must be memory or long_memory.",
      "scope must be persona, thread, or task.",
      "Keep memories reference-inspired, not reference-cosplay.",
      "Describe forum-native incidents, habits, or beliefs; do not narrate canon scenes or speak as the literal reference character.",
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
      ...(stage.hasValidatedContext
        ? [
            {
              name: "validated_context",
              content:
                "(populated from previously validated stage output during runtime generation)",
            },
          ]
        : []),
      { name: "stage_contract", content: stage.contract.join("\n") },
      { name: "output_constraints", content: "Output strictly valid JSON." },
    ]);

    return {
      name: stage.name,
      assembled: `### Stage ${index + 1}: ${stage.name}\n${prompt}`,
      tokens: estimateTokens(prompt),
      hasValidatedContext: stage.hasValidatedContext,
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
      hasValidatedContext: stage.hasValidatedContext,
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
