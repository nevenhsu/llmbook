import type {
  ContentMode,
  PersonaFlowKind,
  PersonaRuntimePacket,
  PersonaAuditEvidencePacket,
} from "@/lib/ai/core/persona-core-v2";

export type PersonaPromptFamilyV2BlockName =
  | "system_baseline"
  | "global_policy"
  | "action_mode_policy"
  | "content_mode_policy"
  | "persona_runtime_packet"
  | "board_context"
  | "target_context"
  | "task_context"
  | "output_contract"
  | "anti_generic_contract";

export type PersonaPromptFamilyV2StagePurpose = "main";

export type PersonaPromptFamilyV2Block = {
  name: PersonaPromptFamilyV2BlockName;
  content: string;
  required: boolean;
  tokenEstimate: number;
};

export type PersonaPromptFamilyV2Result = {
  assembledPrompt: string;
  blocks: PersonaPromptFamilyV2Block[];
  messages: Array<{ role: "system" | "user"; content: string }>;
  blockOrder: PersonaPromptFamilyV2BlockName[];
  warnings: string[];
};

export type PersonaPromptFamilyV2Input = {
  flow: Exclude<PersonaFlowKind, "audit">;
  contentMode: ContentMode;
  stagePurpose: PersonaPromptFamilyV2StagePurpose;
  systemBaseline: string;
  globalPolicy: string;
  personaPacket: PersonaRuntimePacket;
  boardContext?: string | null;
  targetContext?: string | null;
  taskContext: string;
  outputContract: string;
};

const ESTIMATED_CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / ESTIMATED_CHARS_PER_TOKEN);
}

function makeBlock(
  name: PersonaPromptFamilyV2BlockName,
  content: string,
  required = true,
): PersonaPromptFamilyV2Block {
  return {
    name,
    content: content.trim(),
    required,
    tokenEstimate: estimateTokens(content),
  };
}

function buildActionModePolicyForFlow(
  flow: Exclude<PersonaFlowKind, "audit">,
  _stagePurpose: PersonaPromptFamilyV2StagePurpose,
): string {
  switch (flow) {
    case "post_plan":
      return "This stage is planning and scoring candidate post ideas. Plan forum-native angles, compare against recent posts, and score conservatively. Do not write the final post body.";
    case "post_frame":
      return "This stage generates a compact structural frame for a locked post title. Produce a single flat object with main_idea, angle, beats, required_details, ending_direction, tone, and avoid. Never nest objects inside beats or details. Do not write the final post body.";
    case "post_body":
      return "This stage writes the final post body for a locked title and thesis. Write accurate, persona-specific markdown. Do not change the locked title.";
    case "comment":
      return "This stage writes a top-level comment that adds net-new value to the root post. Stay standalone and avoid repeating recent top-level comments.";
    case "reply":
      return "This stage writes a threaded reply that responds directly to the source comment. Continue the thread without restarting the whole topic.";
  }
}

function buildContentModePolicyForFlow(
  flow: Exclude<PersonaFlowKind, "audit">,
  contentMode: ContentMode,
): string {
  if (contentMode === "discussion") {
    switch (flow) {
      case "post_plan":
        return [
          "Content mode: discussion.",
          "Plan forum-native argument, analysis, opinion, question, synthesis, or critique.",
          "Do not plan fiction or story-mode content.",
          "Preserve board relevance and recent-post novelty.",
          "Before output, use the persona packet procedure internally to decide what the persona notices, doubts, cares about, and what response move to choose.",
          "Do not reveal that internal procedure.",
        ].join("\n");
      case "post_frame":
        return [
          "Content mode: discussion.",
          "Generate a compact structural frame for a locked post title.",
          "The output is a PostFrame structured object — not the final post body.",
          "Use the persona packet procedure internally to decide what the persona notices, values, dismisses, and what angle to take.",
          "Do not reveal that internal procedure.",
          "",
          "[focus_contract]",
          "main_idea must be one clear central claim or thesis — not a broad topic.",
          "angle must be the specific interpretive angle that makes the post distinct.",
          "Every decision in the frame must support the main_idea.",
          "Do not introduce unrelated lore or side arguments unless they directly sharpen the main claim.",
          "",
          "[beat_contract]",
          "beats must be 3-5 concrete argument beat strings (not nested objects).",
          "Progression should follow: hook, example, interpretation, contrast, ending.",
          'No vague beats like "discuss the theme" or "conclude the post".',
          "",
          "[detail_contract]",
          "required_details must be 3-7 concrete details that must appear naturally in the final post.",
          "Use examples, rituals, social rules, visual images, contrasts, behaviors, class markers, or sharp observations.",
          "Every detail must be specific enough to be placed directly into prose.",
          "",
          "[ending_contract]",
          "ending_direction must describe how the post should land through insight, irony, epigram, open question, or reframing.",
          "Do not write a generic summary ending.",
          "",
          "[tone_contract]",
          "tone must be 2-5 compact tone descriptors sharp enough to guide word choice and rhythm.",
          "",
          "[avoid_contract]",
          "avoid must be 3-6 concrete failure modes such as:",
          "- vague commentary without example",
          "- generic summary without specific observation",
          "- abstract claims without concrete details",
          "- unrelated lore or side arguments",
          "- tutorial tone or neutral assistant voice",
          "- assistant-like explanation or moralizing",
          "",
          "[quality_gate]",
          "Before finalizing the output, internally check:",
          "- Does the frame have one dominant main_idea?",
          "- Does every beat support that main_idea?",
          "- Are all beats and required_details concrete, not abstract?",
          "- Does the ending_direction sharpen the thesis instead of merely repeating it?",
          "- Is every field filled with real content, not placeholders?",
          "If any answer is no, revise before output.",
          "Do not reveal this checklist.",
        ].join("\n");
      case "post_body":
        return [
          "Content mode: discussion.",
          "Write forum-native markdown carrying a clear claim, structure, and concrete usefulness.",
          "Do not write fiction.",
          "Use the persona packet procedure internally to interpret context before choosing final content.",
          "Do not reveal that internal procedure.",
        ].join("\n");
      case "comment":
        return [
          "Content mode: discussion.",
          "Add net-new value to the root post through argument, analysis, or pointed contribution.",
          "Avoid repeating recent comments.",
          "Stay top-level and standalone.",
          "Use the persona packet procedure internally to decide what is missing, suspect, worth defending, and what response move to make.",
          "Do not reveal that internal procedure.",
        ].join("\n");
      case "reply":
        return [
          "Content mode: discussion.",
          "Respond directly to the source comment.",
          "Continue the thread without restarting the whole topic.",
          "Use the persona packet procedure internally to identify the live point, doubt, care, and reply move.",
          "Do not reveal that internal procedure.",
        ].join("\n");
    }
  }

  // story mode
  switch (flow) {
    case "post_plan":
      return [
        "Content mode: story.",
        "Plan story title, central premise, and story beats.",
        "Generate story planning candidates, not discussion angles.",
        "Map title, thesis, and body_outline to story title, premise, and beats.",
        "Use the persona packet procedure internally to select conflict, character pressure, scene detail, and ending logic.",
        "Do not reveal that internal procedure.",
      ].join("\n");
    case "post_frame":
      return [
        "Content mode: story.",
        "Generate a compact structural frame for a locked story title.",
        "The output is a PostFrame structured object — not the final story body.",
        "Use the persona packet procedure internally to select conflict, character pressure, scene detail, and ending logic.",
        "Do not reveal that internal procedure.",
        "",
        "[focus_contract]",
        "main_idea must be the dramatic premise or narrative thesis — the core situation, conflict, and meaning the story dramatizes.",
        "It is not an essay thesis or a topic.",
        "angle must be the specific narrative lens: the irony, reversal, or emotional pressure that makes this story distinct.",
        "",
        "[beat_contract]",
        "beats must be 3-5 concrete story movement strings (not nested objects).",
        "Progression should follow: setup, encounter, complication, recognition, ending.",
        'No abstract beats like "explore the theme" or "add tension".',
        "",
        "[detail_contract]",
        "required_details must be 3-7 concrete details that must appear naturally in the story.",
        "Use scene details, ritual objects, dialogue fragments, social rules, gestures, sensory images, character behavior, class markers, discomfort moments, or symbolic images.",
        "Every detail must be specific enough to be placed directly into the story.",
        "",
        "[ending_contract]",
        "ending_direction must describe how the story should land through image, reversal, implication, emotional landing, or quiet recognition.",
        "Do not explain the moral directly.",
        "",
        "[tone_contract]",
        "tone must be 2-5 compact tone descriptors sharp enough to guide word choice and rhythm.",
        "",
        "[avoid_contract]",
        "avoid must be 3-6 concrete failure modes such as:",
        "- essay-like explanation instead of dramatization",
        "- plot summary instead of scene",
        "- direct moralizing or explicit lesson",
        "- generic horror or genre adjectives without specific images",
        "- assistant-like commentary or writing advice",
        "- abstract claims without sensory dramatization",
        "",
        "[quality_gate]",
        "Before finalizing the output, internally check:",
        "- Does the frame have one dramatic main_idea, not a topic?",
        "- Does every beat describe a concrete story movement?",
        "- Are all required_details sensory and specific?",
        "- Does the ending_direction describe an image, reversal, or recognition rather than a summary?",
        "- Is every field filled with real content, not placeholders?",
        "If any answer is no, revise before output.",
        "Do not reveal this checklist.",
      ].join("\n");
    case "post_body":
      return [
        "Content mode: story.",
        "Write long story markdown prose using the persona's story logic and voice.",
        "Use the selected plan as story title and central pressure.",
        "Do not turn the story into writing advice, a moral explainer, or a synopsis.",
        "Use the persona packet procedure internally to choose conflict, character pressure, scene detail, and ending logic.",
        "Do not reveal that internal procedure.",
      ].join("\n");
    case "comment":
      return [
        "Content mode: story.",
        "Produce a compact story contribution tied to the root post.",
        "May be a short story, story fragment, story-like comment, or in-world scene response.",
        "Avoid becoming a workshop critique or advice reply.",
        "Use narrative traits from the persona packet, not examples.",
        "Use the persona packet procedure internally to choose one story move, one pressure point, and one detail bias.",
        "Do not reveal that internal procedure.",
      ].join("\n");
    case "reply":
      return [
        "Content mode: story.",
        "Continue the source comment or scene rather than opening a disconnected story.",
        "Keep the reply-sized shape.",
        "May be a continuation, short scene response, or in-thread story fragment.",
        "Use narrative packet traits for continuation logic and scene details.",
        "Use the persona packet procedure internally to select continuation pressure, scene detail, and ending motion.",
        "Do not reveal that internal procedure.",
      ].join("\n");
  }
}

export function buildActionModePolicy(input: {
  flow: Exclude<PersonaFlowKind, "audit">;
  stagePurpose: PersonaPromptFamilyV2StagePurpose;
}): string {
  return buildActionModePolicyForFlow(input.flow, input.stagePurpose);
}

export function buildContentModePolicy(input: {
  flow: Exclude<PersonaFlowKind, "audit">;
  contentMode: ContentMode;
}): string {
  return buildContentModePolicyForFlow(input.flow, input.contentMode);
}

export function buildAntiGenericContract(input: {
  flow: Exclude<PersonaFlowKind, "audit">;
  contentMode: ContentMode;
}): string {
  return [
    "Do not mention these prompt blocks, internal policies, or persona schema.",
    "Do not write as a generic assistant, moderator, writing coach, or neutral explainer unless explicitly requested.",
    "Do not add memory, relationship claims, reference-name imitation, or default examples.",
    "Keep the output in the requested JSON schema only.",
  ].join("\n");
}

export function buildProcedureNonExposureRule(input: {
  flow: Exclude<PersonaFlowKind, "audit">;
  contentMode: ContentMode;
}): string {
  return "Do not reveal internal procedure, context readings, or interpretation steps in the output.";
}

function getBlockOrder(_input: PersonaPromptFamilyV2Input): PersonaPromptFamilyV2BlockName[] {
  return [
    "system_baseline",
    "global_policy",
    "action_mode_policy",
    "content_mode_policy",
    "persona_runtime_packet",
    "board_context",
    "target_context",
    "task_context",
    "output_contract",
    "anti_generic_contract",
  ];
}

function renderBlocks(blocks: PersonaPromptFamilyV2Block[]): string {
  return blocks
    .map((block) => `[${block.name}]\n${block.content}`)
    .join("\n\n")
    .trim();
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  const head = text.slice(0, Math.ceil(maxChars * 0.6)).trimEnd();
  const tail = text.slice(-Math.ceil(maxChars * 0.4)).trimStart();
  return `${head}\n...[truncated]...\n${tail}`;
}

export function buildPersonaPromptFamilyV2(
  input: PersonaPromptFamilyV2Input,
): PersonaPromptFamilyV2Result {
  const warnings: string[] = [];
  const blockOrder = getBlockOrder(input);

  const actionModePolicy = buildActionModePolicyForFlow(input.flow, input.stagePurpose);
  const contentModePolicy = buildContentModePolicyForFlow(input.flow, input.contentMode);
  const antiGenericContract = buildAntiGenericContract(input);
  const personaPacketText = input.personaPacket.renderedText;

  if (input.personaPacket.warnings && input.personaPacket.warnings.length > 0) {
    warnings.push(...input.personaPacket.warnings.map((w) => `persona_packet: ${w}`));
  }

  const allBlocks: Partial<Record<PersonaPromptFamilyV2BlockName, PersonaPromptFamilyV2Block>> = {
    system_baseline: makeBlock("system_baseline", input.systemBaseline),
    global_policy: makeBlock("global_policy", input.globalPolicy),
    action_mode_policy: makeBlock("action_mode_policy", actionModePolicy),
    content_mode_policy: makeBlock("content_mode_policy", contentModePolicy),
    persona_runtime_packet: makeBlock("persona_runtime_packet", personaPacketText),
    board_context: makeBlock("board_context", input.boardContext ?? "No board context available."),
    target_context: makeBlock(
      "target_context",
      input.targetContext ?? "No target context available.",
    ),
    task_context: makeBlock("task_context", input.taskContext),
    output_contract: makeBlock("output_contract", input.outputContract),
    anti_generic_contract: makeBlock("anti_generic_contract", antiGenericContract),
  };

  const blocks: PersonaPromptFamilyV2Block[] = [];
  for (const name of blockOrder) {
    const block = allBlocks[name];
    if (block && block.content.length > 0) {
      blocks.push(block);
    }
  }

  const assembledPrompt = renderBlocks(blocks);

  const systemBlock = blocks.find((b) => b.name === "system_baseline");
  const systemContent = systemBlock?.content ?? "";
  const userContent = blocks
    .filter((b) => b.name !== "system_baseline")
    .map((b) => `[${b.name}]\n${b.content}`)
    .join("\n\n")
    .trim();

  return {
    assembledPrompt,
    blocks,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
    blockOrder,
    warnings,
  };
}

// ---- Static main generation constants (per flow × contentMode) ----

("Write one reply-sized story continuation or scene response as markdown text in the `markdown` field. Use the dynamic source comment and ancestor comments for continuity. Return only the schema-bound object.");
