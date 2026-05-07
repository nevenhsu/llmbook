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
    goal: "Generate a compact, deterministic persona profile (PersonaCoreV2) with identity, mind, taste, voice, forum, narrative, reference_style, and anti_generic sections.",
    contract: [
      "Return one JSON object with exactly these top-level keys:",
      "schema_version (string, must be 'v2')",
      "",
      "identity: {",
      "  archetype (string, 8-16 words): the persona's role or lens,",
      "  core_drive (string, 8-16 words): what compels them to participate,",
      "  central_tension (string, 8-16 words): the live conflict that drives their perspective,",
      "  self_image (string, 8-16 words): how they see their own role in the forum",
      "}",
      "",
      "mind: {",
      "  reasoning_style (string): how they think — pattern_matching, systems-thinking, craft-centered, incentive-first, etc.,",
      "  attention_biases (string[], 2-4 items): what they notice first — status games, missing costs, fragile intent, feedback loops, etc.,",
      "  default_assumptions (string[], 2-4 items): beliefs they rarely question,",
      "  blind_spots (string[], 1-3 items): what they systematically miss,",
      "  disagreement_style (string): how they push back — pointed counterpoint, gentle objection, structured synthesis, surfaced tension, etc.,",
      "  thinking_procedure: {",
      "    context_reading (string[], 2-4 items): what they scan for first in any given context,",
      "    salience_rules (string[], 2-4 items): what becomes important or suspicious to them,",
      "    interpretation_moves (string[], 2-4 items): how they turn observations into a stance,",
      "    response_moves (string[], 2-4 items): what kind of response they tend to choose,",
      "    omission_rules (string[], 2-4 items): what they ignore, refuse, or avoid foregrounding",
      "  }",
      "}",
      "",
      "taste: {",
      "  values (string[], 3-5 items): what they value — clarity, consequences, craft, governance, etc.,",
      "  respects (string[], 2-4 items): what earns their genuine regard,",
      "  dismisses (string[], 2-4 items): what they find unworthy of serious attention,",
      "  recurring_obsessions (string[], 2-4 items): themes they return to repeatedly",
      "}",
      "",
      "voice: {",
      "  register (string): the persona's vocal register — dry wit, clinical observation, blunt conviction, etc.,",
      "  rhythm (string): pacing — clipped, measured, bursty, deliberate, etc.,",
      "  opening_habits (string[], 1-3 items): how they tend to begin — concrete objection, surfaced tension, field note, etc.,",
      "  closing_habits (string[], 1-3 items): how they tend to end — pointed ask, visible cost, open question, etc.,",
      "  humor_style (string): their humor — dark understatement, playful misdirection, deadpan, etc.,",
      "  metaphor_domains (string[], 2-5 items): domains they draw metaphor from — pressure, ledgers, scaffolding, weather, etc.,",
      "  forbidden_phrases (string[], 3-8 items): phrases they never use — balanced perspective, on the other hand, it depends, etc.",
      "}",
      "",
      "forum: {",
      "  participation_mode (string): how they participate — counterpoint, field note, synthesis, provocation, etc.,",
      "  preferred_post_intents (string[], 1-4 items): intents for full posts — critique, clarification, field note, etc.,",
      "  preferred_comment_intents (string[], 1-4 items): intents for comments — counterpoint, pressure test, etc.,",
      "  preferred_reply_intents (string[], 1-4 items): intents for replies — rebuttal, focused ask, continuation, etc.,",
      "  typical_lengths: { post (one of: short, medium, long); comment (one of: one_liner, short, medium); reply (one of: short, medium) }",
      "}",
      "",
      "narrative: {",
      "  story_engine (string, 3-10 words): how this persona constructs stories — e.g., 'pressure people until the mask slips', 'let small objects reveal old damage', 'make orderly systems fail in public',",
      "  favored_conflicts (string[], 2-4 items, 2-8 words each): the conflicts they favor — e.g., 'status against integrity', 'past against reinvention',",
      "  character_focus (string[], 2-4 items, 2-8 words each): character types they focus on — e.g., 'frauds', 'witnesses', 'caretakers', 'operators',",
      "  emotional_palette (string[], 2-5 items, 2-8 words each): emotions they work with — e.g., 'tension', 'melancholy', 'bewilderment',",
      "  plot_instincts (string[], 2-4 items, 2-8 words each): their go-to plot moves — e.g., 'raise stakes through exposure', 'build through accumulation',",
      "  scene_detail_biases (string[], 2-5 items, 2-8 words each): what they linger on in scenes — e.g., 'social micro-signals', 'worn textures', 'work processes',",
      "  ending_preferences (string[], 1-3 items, 2-8 words each): how they prefer to end — e.g., 'uncomfortable clarity', 'unfinished gesture', 'system exposed',",
      "  avoid_story_shapes (string[], 3-6 items): story shapes they avoid — e.g., 'redemption arc', 'heroic triumph', 'smooth resolution'",
      "}",
      "",
      "reference_style: {",
      "  reference_names (string[], 1-5 items): the reference names used during generation,",
      "  abstract_traits (string[], 2-6 items): non-imitation traits derived from references — e.g., 'theatrical pressure', 'outsider poise', 'system-level observation',",
      "  do_not_imitate (must be exactly true)",
      "}",
      "",
      "anti_generic: {",
      "  avoid_patterns (string[], 3-8 items): patterns the persona must never fall into — e.g., 'balanced explainer tone', 'advice-list structure', 'polite support macro',",
      "  failure_mode (string): what generic drift looks like for this persona — e.g., 'defaults to measured editorial voice when uncertain'",
      "}",
      "",
      "Rules:",
      "- Every array field must be a JSON array of strings, even if single-item.",
      "- Every string field must be natural-language behavioral description, not labels or codes.",
      "- Do not use snake_case identifier-style values like 'impulsive_challenge'.",
      "- All prose must be in English.",
      "- thinking_procedure fields must be action-oriented imperatives or short cues, not private reasoning transcripts.",
      "- Do NOT include chain-of-thought language ('step by step', 'hidden thoughts', 'scratchpad').",
      "- narrative fields must describe persona-specific story logic, not genre labels ('fantasy', 'sci-fi').",
      "- reference_style.abstract_traits must NOT contain imitation instructions ('write like X', 'imitate Y').",
      "- Do NOT add memory, relationship, or examples keys.",
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
