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
  "Generate a compact PersonaCoreV2 JSON object for a persona-driven forum system.",
  "Write all persona-generation content in English.",
  "Delete extra wrapper keys; return only the schema-bound JSON object.",
].join("\n");
export const PERSONA_GENERATION_OUTPUT_CONSTRAINTS = [
  "Return only strict JSON.",
  "No markdown, no comments, no explanation.",
].join("\n");
const PERSONA_GENERATION_ADMIN_EXTRA_PROMPT_PLACEHOLDER = "(from Context / Extra Prompt input)";

export const PERSONA_GENERATION_TEMPLATE_STAGES = [
  {
    name: "persona_core_v2",
    goal: "Generate one compact PersonaCoreV2 JSON object.",
    contract: [
      "[task]",
      "Generate one compact PersonaCoreV2 JSON object for a persona-driven forum system.",
      "",
      "The persona will later be used to write forum posts, long stories, comments, replies, and short story fragments.",
      "",
      "Do not write sample content. Generate only the persona's compact operating system: how it reads context, thinks, notices, judges, speaks, participates, and builds stories.",
      "",
      "[input]",
      "user_input_context:",
      "{{USER_INPUT_CONTEXT}}",
      "",
      "reference_names:",
      "{{USER_REFERENCE_NAMES}}",
      "Use reference_names as the persona's core identity anchors.",
      "They should drive the persona's thinking procedure, voice rhythm, forum behavior, narrative logic, and anti-generic traits.",
      "Each core reference should contribute a distinct dimension of the persona.",
      "",
      "[reference_rules]",
      "reference_style.reference_names must contain 1 to 5 core references.",
      "",
      "Use provided references if usable. If none are usable, generate 1 to 5 relevant references from user_input_context. If more than 5 are usable, select the strongest 1 to 5. Choose references that support distinct thinking logic, voice, forum behavior, and narrative behavior.",
      "",
      "References may be any personifiable source: people, characters, archetypes, animals, brands, institutions, roles, or persona-like public image.",
      "",
      "Put secondary inspirations in reference_style.other_references: works, motifs, scenes, cultural contexts, related figures, voice textures, or linked traits. They must support the persona but not become the core identity. Limit: 0 to 8 items.",
      "",
      "[persona_rules]",
      "Generate compact PersonaCore data.",
      "",
      "The persona must be distinct in:",
      "- thinking logic",
      "- context reading",
      "- salience rules",
      "- argument moves",
      "- response moves",
      "- voice rhythm",
      "- forum behavior",
      "- narrative construction",
      "- anti-generic failure modes",
      "",
      "mind.thinking_procedure:",
      "- Required.",
      "- Describe how the persona interprets context before writing.",
      "- Must be persona-specific and not only about tone.",
      "- Must not reveal hidden reasoning or ask to show reasoning.",
      "- Must not include: 'think step by step', 'show reasoning', 'scratchpad', or 'hidden thoughts'.",
      "",
      "narrative:",
      "- Required.",
      "- Describe story logic, not genre labels.",
      "- story_engine describes how this persona turns pressure into story.",
      "- favored_conflicts are tensions, not genres.",
      "- scene_detail_biases describe what this persona notices in scenes.",
      "- ending_preferences describe ending logic.",
      "",
      "forum behavior:",
      "- Derive from the persona's participation instinct.",
      "- Specify how the persona enters a thread, challenges ideas, agrees, disagrees, adds value, and avoids generic comments.",
      "",
      "anti_generic:",
      "- anti_generic.avoid_patterns must contain at least 1 concrete failure mode.",
      "- Avoid bland traits, generic intelligence, vague warmth, empty wit, and style-only personas.",
      "",
      "[fit_probability]",
      "persona_fit_probability must be an integer from 0 to 100.",
      "",
      "It estimates how strongly the generated persona matches user_input_context and selected reference_names.",
      "",
      "Higher score requires:",
      "- strong conceptual alignment",
      "- coherent behavior across all fields",
      "- concrete, non-generic traits",
      "- references that reinforce the same persona",
      "",
      "[compactness]",
      "Use compact JSON only.",
      "Keep strings short and behavior-specific.",
      "Prefer 2 to 5 concrete items in arrays unless a validation rule gives a different limit.",
      "",
      "[internal_design_process]",
      "Perform internally only. Do not reveal.",
      "",
      "1. Read user_input_context.",
      "2. Resolve 1 to 5 core reference_names.",
      "3. Move secondary inspirations into other_references.",
      "4. Convert references into abstract personality traits.",
      "5. Derive identity and core tension.",
      "6. Derive mind.thinking_procedure before voice.",
      "7. Derive forum behavior from the persona's participation instinct.",
      "8. Derive narrative logic from the same mind and values.",
      "9. Remove generic filler.",
      "10. Estimate persona_fit_probability.",
      "11. Output only the final JSON object.",
      "",
      "[output_validation]",
      "Return only strict JSON.",
      "No markdown.",
      "No comments.",
      "No explanation.",
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

function buildViewStageContractText(
  template: string,
  extraPrompt: string,
  referenceNames: string,
): string {
  const hasExtra = extraPrompt.trim().length > 0;
  const hasRefs = referenceNames.trim().length > 0;

  if (!hasExtra && !hasRefs) {
    return template
      .replace(/^\[input\]\n/, "")
      .replace(/user_input_context:\n\{\{USER_INPUT_CONTEXT\}\}\n(\n)?/, "")
      .replace(
        /reference_names:\n\{\{USER_REFERENCE_NAMES\}\}[^]*?Each core reference should contribute a distinct dimension of the persona\.\n(\n)?/,
        "",
      );
  }

  let result = template.replace("{{USER_INPUT_CONTEXT}}", hasExtra ? extraPrompt.trim() : "");
  if (hasRefs) {
    result = result.replace(
      "{{USER_REFERENCE_NAMES}}",
      [
        referenceNames.trim(),
        "",
        "Use reference_names as the persona's core identity anchors.",
        "They should drive the persona's thinking procedure, voice rhythm, forum behavior, narrative logic, and anti-generic traits.",
        "Each core reference should contribute a distinct dimension of the persona.",
      ].join("\n"),
    );
  } else {
    result = result.replace(
      /reference_names:\n\{\{USER_REFERENCE_NAMES\}\}[^]*?Each core reference should contribute a distinct dimension of the persona\.\n(\n)?/,
      "",
    );
  }

  if (!hasExtra) {
    result = result.replace(/user_input_context:\n\{\{USER_INPUT_CONTEXT\}\}\n(\n)?/, "");
  }

  return result;
}

export function buildPersonaGenerationPromptTemplatePreview(input: {
  extraPrompt: string;
  referenceNames: string;
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
        name: stage.name,
        content: [`stage_goal: ${stage.goal}`].join("\n"),
      },
      {
        name: "stage_contract",
        content: buildViewStageContractText(
          stage.contract.join("\n"),
          input.extraPrompt,
          input.referenceNames,
        ),
      },
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
