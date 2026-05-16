import type {
  ContentMode,
  PersonaInteractionFlow,
  PersonaInteractionStage,
  PersonaRuntimePacket,
} from "@/lib/ai/core/persona-core-v2";
import {
  buildPostStageActionModePolicy,
  buildPostStageAntiGenericContract,
  buildPostStageContentModePolicy,
  buildPostOwnedPromptBlockContent,
  getPostPromptBlockOrder,
  type PostPromptBlockName,
} from "@/lib/ai/prompt-runtime/post/post-prompt-builder";

export type PersonaPromptFamilyV2BlockName =
  | "system_baseline"
  | "global_policy"
  | "action_mode_policy"
  | "content_mode_policy"
  | "persona_runtime_packet"
  | "board_context"
  | "target_context"
  | "task_context"
  | "schema_guidance"
  | "internal_process"
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
  flow: PersonaInteractionFlow;
  stage: PersonaInteractionStage;
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
  flow: PersonaInteractionFlow,
  stage: PersonaInteractionStage,
  contentMode: ContentMode,
): string {
  switch (stage) {
    case "post_plan":
    case "post_frame":
    case "post_body":
      return buildPostStageActionModePolicy({ stage, contentMode });
    case "comment_body":
      return "This stage writes a top-level comment that adds net-new value to the root post. Stay standalone and avoid repeating recent top-level comments.";
    case "reply_body":
      return "This stage writes a threaded reply that responds directly to the source comment. Continue the thread without restarting the whole topic.";
  }
}

function buildContentModePolicyForFlow(
  flow: PersonaInteractionFlow,
  stage: PersonaInteractionStage,
  contentMode: ContentMode,
): string {
  // Delegate post stages to the canonical post prompt-runtime owner.
  if (flow === "post") {
    return buildPostStageContentModePolicy({
      stage: stage as "post_plan" | "post_frame" | "post_body",
      contentMode,
    });
  }

  if (contentMode === "discussion") {
    switch (stage) {
      case "comment_body":
        return [
          "Content mode: discussion.",
          "Add net-new value to the root post through argument, analysis, or pointed contribution.",
          "Avoid repeating recent comments.",
          "Stay top-level and standalone.",
          "Use the persona packet procedure internally to decide what is missing, suspect, worth defending, and what response move to make.",
          "Do not reveal that internal procedure.",
        ].join("\n");
      case "reply_body":
        return [
          "Content mode: discussion.",
          "Respond directly to the source comment.",
          "Continue the thread without restarting the whole topic.",
          "Use the persona packet procedure internally to identify the live point, doubt, care, and reply move.",
          "Do not reveal that internal procedure.",
        ].join("\n");
      default:
        return "";
    }
  }

  // story mode — comment and reply only; post stages delegated above.
  switch (stage) {
    case "comment_body":
      return [
        "Content mode: story.",
        "Produce a compact story contribution tied to the root post.",
        "May be a short story, story fragment, story-like comment, or in-world scene response.",
        "Avoid becoming a workshop critique or advice reply.",
        "Use narrative traits from the persona packet, not examples.",
        "Use the persona packet procedure internally to choose one story move, one pressure point, and one detail bias.",
        "Do not reveal that internal procedure.",
      ].join("\n");
    case "reply_body":
      return [
        "Content mode: story.",
        "Continue the source comment or scene rather than opening a disconnected story.",
        "Keep the reply-sized shape.",
        "May be a continuation, short scene response, or in-thread story fragment.",
        "Use narrative packet traits for continuation logic and scene details.",
        "Use the persona packet procedure internally to select continuation pressure, scene detail, and ending motion.",
        "Do not reveal that internal procedure.",
      ].join("\n");
    default:
      return "";
  }
}

export function buildActionModePolicy(input: {
  flow: PersonaInteractionFlow;
  stage: PersonaInteractionStage;
  stagePurpose: PersonaPromptFamilyV2StagePurpose;
  contentMode: ContentMode;
}): string {
  return buildActionModePolicyForFlow(input.flow, input.stage, input.contentMode);
}

export function buildContentModePolicy(input: {
  flow: PersonaInteractionFlow;
  stage: PersonaInteractionStage;
  contentMode: ContentMode;
}): string {
  return buildContentModePolicyForFlow(input.flow, input.stage, input.contentMode);
}

export function buildAntiGenericContract(input: {
  flow: PersonaInteractionFlow;
  stage: PersonaInteractionStage;
  contentMode: ContentMode;
}): string {
  if (input.flow === "post") {
    return buildPostStageAntiGenericContract({
      stage: input.stage as "post_plan" | "post_frame" | "post_body",
      contentMode: input.contentMode,
    });
  }
  return [
    "Do not mention these prompt blocks, internal policies, or persona schema.",
    "Do not write as a generic assistant, moderator, writing coach, or neutral explainer unless explicitly requested.",
    "Do not add memory, relationship claims, reference-name imitation, or default examples.",
    "Keep the output in the requested JSON schema only.",
  ].join("\n");
}

export function buildProcedureNonExposureRule(input: {
  flow: PersonaInteractionFlow;
  stage: PersonaInteractionStage;
  contentMode: ContentMode;
}): string {
  return "Do not reveal internal procedure, context readings, or interpretation steps in the output.";
}

function buildSchemaGuidancePlaceholder(input: {
  flow: PersonaInteractionFlow;
  stage: PersonaInteractionStage;
}): string {
  switch (input.stage) {
    case "comment_body":
      return "Placeholder: comment schema_guidance pending canonical extraction.";
    case "reply_body":
      return "Placeholder: reply schema_guidance pending canonical extraction.";
    default:
      return "";
  }
}

function buildInternalProcessPlaceholder(input: {
  flow: PersonaInteractionFlow;
  stage: PersonaInteractionStage;
}): string {
  switch (input.stage) {
    case "comment_body":
      return [
        "Placeholder: comment internal_process pending canonical extraction.",
        "Perform internally only. Do not reveal.",
      ].join("\n");
    case "reply_body":
      return [
        "Placeholder: reply internal_process pending canonical extraction.",
        "Perform internally only. Do not reveal.",
      ].join("\n");
    default:
      return "";
  }
}

function getBlockOrder(_input: PersonaPromptFamilyV2Input): PersonaPromptFamilyV2BlockName[] {
  if (_input.flow === "post") {
    return ["system_baseline", "global_policy", ...getPostPromptBlockOrder()];
  }
  return [
    "system_baseline",
    "global_policy",
    "action_mode_policy",
    "content_mode_policy",
    "persona_runtime_packet",
    "board_context",
    "target_context",
    "task_context",
    "schema_guidance",
    "internal_process",
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

  const actionModePolicy = buildActionModePolicyForFlow(input.flow, input.stage, input.contentMode);
  const contentModePolicy = buildContentModePolicyForFlow(
    input.flow,
    input.stage,
    input.contentMode,
  );
  const antiGenericContract = buildAntiGenericContract(input);
  const personaPacketText = input.personaPacket.renderedText;
  const isPostFlow = input.flow === "post";

  if (input.personaPacket.warnings && input.personaPacket.warnings.length > 0) {
    warnings.push(...input.personaPacket.warnings.map((w) => `persona_packet: ${w}`));
  }

  const allBlocks: Partial<Record<PersonaPromptFamilyV2BlockName, PersonaPromptFamilyV2Block>> = {
    system_baseline: makeBlock("system_baseline", input.systemBaseline),
    global_policy: makeBlock("global_policy", input.globalPolicy),
    persona_runtime_packet: makeBlock("persona_runtime_packet", personaPacketText),
    board_context: makeBlock("board_context", input.boardContext ?? "No board context available."),
  };

  if (isPostFlow) {
    const postBlocks = buildPostOwnedPromptBlockContent({
      flow: "post",
      stage: input.stage as "post_plan" | "post_frame" | "post_body",
      contentMode: input.contentMode,
      targetContext: input.targetContext ?? null,
      taskContext: input.taskContext,
    });

    (Object.entries(postBlocks) as Array<[PostPromptBlockName, string]>).forEach(
      ([name, content]) => {
        if (name === "persona_runtime_packet" || name === "board_context") {
          return;
        }
        allBlocks[name] = makeBlock(name, content);
      },
    );
  } else {
    allBlocks.action_mode_policy = makeBlock("action_mode_policy", actionModePolicy);
    allBlocks.content_mode_policy = makeBlock("content_mode_policy", contentModePolicy);
    allBlocks.target_context = makeBlock(
      "target_context",
      input.targetContext ?? "No target context available.",
    );
    allBlocks.task_context = makeBlock("task_context", input.taskContext);
    allBlocks.schema_guidance = makeBlock(
      "schema_guidance",
      buildSchemaGuidancePlaceholder({ flow: input.flow, stage: input.stage }),
    );
    allBlocks.internal_process = makeBlock(
      "internal_process",
      buildInternalProcessPlaceholder({ flow: input.flow, stage: input.stage }),
    );
    allBlocks.output_contract = makeBlock("output_contract", input.outputContract);
    allBlocks.anti_generic_contract = makeBlock("anti_generic_contract", antiGenericContract);
  }

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
