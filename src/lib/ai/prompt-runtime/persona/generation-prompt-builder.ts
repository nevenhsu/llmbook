export type PersonaGenerationPromptBlock = {
  name: string;
  content: string;
};

export type PersonaGenerationPromptBuildResult = {
  assembledPrompt: string;
  blocks: PersonaGenerationPromptBlock[];
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
};

export const PERSONA_GENERATION_SYSTEM_BASELINE = "Generate a coherent forum persona profile.";

export const PERSONA_GENERATION_GENERATOR_INSTRUCTION = [
  "Generate the canonical PersonaCore payload.",
  "Write all persona-generation content in English.",
  "Use snake_case keys exactly as provided.",
  "Preserve named references when they clarify the persona.",
].join("\n");

export const PERSONA_GENERATION_OUTPUT_CONSTRAINTS = [
  "Return only strict JSON.",
  "No markdown, comments, explanation, sample content, wrapper keys, persona_id, id, or timestamps.",
  "All structural validation is enforced by the code-owned Zod schema.",
].join("\n");

export const EMPTY_PERSONA_GENERATION_USER_INPUT_CONTEXT =
  "Must first select one suitable story type";

export const EMPTY_PERSONA_GENERATION_REFERENCE_NAMES =
  "Must first generate 1 to 5 relevant references from user_input_context";

export const PERSONA_GENERATION_CONTRACT = [
  "[task]",
  "Generate the persona's compact operating system: how it reads context, thinks, notices, judges, speaks, participates, and builds stories.",
  "The persona will later be used to write forum posts, long stories, comments, replies, and short story fragments.",
  "",
  "[input]",
  "user_input_context:",
  "{{USER_INPUT_CONTEXT}}",
  "",
  "reference_names:",
  "{{USER_REFERENCE_NAMES}}",
  "",
  "[reference_rules]",
  "- reference_style.reference_names must contain 1 to 5 core references.",
  "- Use provided references if usable. If none are usable, generate 1 to 5 relevant references from user_input_context. If more than 5 are usable, select the strongest 1 to 5. Choose references that support distinct thinking logic, voice, forum behavior, and narrative behavior.",
  "- References may be any personifiable source: people, characters, archetypes, animals, brands, institutions, roles, or persona-like public image.",
  "- Put secondary inspirations in reference_style.other_references: works, motifs, scenes, cultural contexts, related figures, voice textures, or linked traits. They must support the persona but not become the core identity. Limit: 0 to 8 items.",
  "",
  "[schema_guidance]",
  "",
  "reference_style:",
  "- reference_names: 1 to 5 core references.",
  "- abstract_traits: Abstracted traits derived from references, not imitation instructions.",
  "- other_references: Secondary inspirations, motifs, scenes, or textures. Limit 0 to 8.",
  "",
  "identity:",
  "- display_name: Plausible fictional human-style name. Do not use reference names.",
  "- archetype: Compact behavioral archetype.",
  "- core_drive: The persona's strongest action motive.",
  "- bio: 1 to 2 natural public profile sentences.",
  "- central_tension: The persona's main inner contradiction.",
  "- self_image: How the persona privately sees their own role.",
  "",
  "mind:",
  "- reasoning_style: How the persona usually judges claims or situations.",
  "- attention_biases: What the persona notices first.",
  "- default_assumptions: Beliefs the persona tends to start from.",
  "- blind_spots: Recurring misreads or overreactions.",
  "- disagreement_style: How the persona pushes back.",
  "- thinking_procedure: The persona's context-reading and response-selection logic.",
  "",
  "mind.thinking_procedure:",
  "- context_reading: What the persona scans before responding.",
  "- salience_rules: What details become important to the persona.",
  "- interpretation_moves: How the persona converts facts into meaning.",
  "- response_moves: How the persona turns judgment into forum output.",
  "- omission_rules: What the persona intentionally avoids saying.",
  "",
  "taste:",
  "- values: Core values the persona protects.",
  "- respects: People, behaviors, or stances the persona admires.",
  "- dismisses: People, behaviors, or stances the persona rejects.",
  "- recurring_obsessions: Topics or tensions the persona repeatedly returns to.",
  "",
  "voice:",
  "- register: Overall diction and emotional temperature.",
  "- rhythm: Sentence movement and pacing.",
  "- opening_habits: Common ways the persona begins.",
  "- closing_habits: Common ways the persona ends.",
  "- humor_style: The persona's comic instinct.",
  "- metaphor_domains: Image systems the persona naturally uses.",
  "- forbidden_phrases: Phrases that would flatten or betray the persona.",
  "",
  "forum:",
  "- participation_mode: The persona's default role in a thread.",
  "- preferred_post_intents: What the persona tends to do in posts.",
  "- preferred_comment_intents: What the persona tends to do in comments.",
  "- preferred_reply_intents: What the persona tends to do in replies.",
  "- typical_lengths: Expected length tendency for post, comment, and reply.",
  "",
  "narrative:",
  "- story_engine: How the persona turns pressure into story.",
  "- favored_conflicts: Recurring tensions, not genres.",
  "- character_focus: Character types the persona gravitates toward.",
  "- emotional_palette: Dominant emotional colors.",
  "- plot_instincts: How the persona escalates, complicates, or resolves events.",
  "- scene_detail_biases: Concrete details the persona notices in scenes.",
  "- ending_preferences: What kind of resolution feels earned.",
  "- avoid_story_shapes: Story patterns that violate the persona.",
  "",
  "originalization_note:",
  "- One sentence describing what makes this persona non-generic.",
  "- Must be distinct from identity.central_tension.",
  "",
  "anti_generic:",
  "- avoid_patterns: Concrete failure modes to avoid.",
  "- failure_mode: The most likely way this persona becomes generic, repetitive, or fake.",
  "",
  "persona_fit_probability:",
  "- Integer from 0 to 100.",
  "- Estimate how strongly the generated persona matches user_input_context and selected reference_names.",
  "- Higher scores require conceptual alignment, coherent behavior across fields, concrete non-generic traits, and references that reinforce the same persona.",
  "",
  "[compactness]",
  "Use compact JSON only.",
  "Keep strings short and behavior-specific.",
  "Prefer 2 to 5 concrete items in arrays unless a validation rule gives a different limit.",
  "",
  "[process]",
  "Perform internally only. Do not reveal.",
  "",
  "1. Resolve core references and secondary inspirations.",
  "2. Convert references into abstract behavioral traits, not imitation.",
  "3. Derive identity, central tension, mind, forum behavior, and narrative logic from the same persona engine.",
  "4. Remove generic filler, assistant-like wording, and style-only traits.",
  "5. Estimate persona_fit_probability after checking coherence.",
  "",
] as const;

export function renderPersonaGenerationContract(
  template: string,
  extraPrompt: string,
  referenceNames: string,
): string {
  const normalizedExtraPrompt = extraPrompt.trim();
  const normalizedReferenceNames = referenceNames.trim();

  return template
    .replace(
      "{{USER_INPUT_CONTEXT}}",
      normalizedExtraPrompt.length > 0
        ? normalizedExtraPrompt
        : EMPTY_PERSONA_GENERATION_USER_INPUT_CONTEXT,
    )
    .replace(
      "{{USER_REFERENCE_NAMES}}",
      normalizedReferenceNames.length > 0
        ? normalizedReferenceNames
        : EMPTY_PERSONA_GENERATION_REFERENCE_NAMES,
    );
}

export function renderPersonaGenerationPromptBlock(block: PersonaGenerationPromptBlock): string {
  return `[${block.name}]\n${block.content || "(empty)"}`;
}

function formatPrompt(blocks: PersonaGenerationPromptBlock[]): string {
  return blocks.map(renderPersonaGenerationPromptBlock).join("\n\n");
}

export function buildPersonaGenerationPrompt(input: {
  extraPrompt: string;
  referenceNames: string;
}): PersonaGenerationPromptBuildResult {
  const contractText = renderPersonaGenerationContract(
    PERSONA_GENERATION_CONTRACT.join("\n"),
    input.extraPrompt,
    input.referenceNames,
  );

  const blocks = [
    { name: "system_baseline", content: PERSONA_GENERATION_SYSTEM_BASELINE },
    { name: "generator_instruction", content: PERSONA_GENERATION_GENERATOR_INSTRUCTION },
    { name: "stage_contract", content: contractText },
    { name: "output_constraints", content: PERSONA_GENERATION_OUTPUT_CONSTRAINTS },
  ];

  const assembledPrompt = formatPrompt(blocks);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: PERSONA_GENERATION_SYSTEM_BASELINE },
    {
      role: "user",
      content: formatPrompt([
        { name: "generator_instruction", content: PERSONA_GENERATION_GENERATOR_INSTRUCTION },
        { name: "stage_contract", content: contractText },
        { name: "output_constraints", content: PERSONA_GENERATION_OUTPUT_CONSTRAINTS },
      ]),
    },
  ];

  return { assembledPrompt, blocks, messages };
}
