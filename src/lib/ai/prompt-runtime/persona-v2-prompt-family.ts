import type {
  ContentMode,
  PersonaInteractionFlow,
  PersonaInteractionStage,
  PersonaRuntimePacket,
} from "@/lib/ai/core/persona-core-v2";
import {
  buildCommentOwnedPromptBlockContent,
  getCommentPromptBlockOrder,
  type CommentPromptBlockName,
} from "@/lib/ai/prompt-runtime/comment/comment-prompt-builder";
import {
  buildPostStageActionModePolicy,
  buildPostStageAntiGenericContract,
  buildPostStageContentModePolicy,
  buildPostOwnedPromptBlockContent,
  getPostPromptBlockOrder,
  type PostPromptBlockName,
} from "@/lib/ai/prompt-runtime/post/post-prompt-builder";
import {
  buildReplyOwnedPromptBlockContent,
  getReplyPromptBlockOrder,
  type ReplyPromptBlockName,
} from "@/lib/ai/prompt-runtime/reply/reply-prompt-builder";

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
  _flow: PersonaInteractionFlow,
  stage: PersonaInteractionStage,
  contentMode: ContentMode,
): string {
  switch (stage) {
    case "post_plan":
    case "post_frame":
    case "post_body":
      return buildPostStageActionModePolicy({ stage, contentMode });
    case "comment_body":
    case "reply_body":
      return "";
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
  return "";
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
  return "";
}

export function buildProcedureNonExposureRule(_input: {
  flow: PersonaInteractionFlow;
  stage: PersonaInteractionStage;
  contentMode: ContentMode;
}): string {
  return "Do not reveal internal procedure, context readings, or interpretation steps in the output.";
}

function getBlockOrder(_input: PersonaPromptFamilyV2Input): PersonaPromptFamilyV2BlockName[] {
  switch (_input.flow) {
    case "post":
      return ["system_baseline", "global_policy", ...getPostPromptBlockOrder()];
    case "comment":
      return ["system_baseline", "global_policy", ...getCommentPromptBlockOrder()];
    case "reply":
      return ["system_baseline", "global_policy", ...getReplyPromptBlockOrder()];
  }
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
  } else if (input.flow === "comment") {
    const commentBlocks = buildCommentOwnedPromptBlockContent({
      flow: "comment",
      stage: input.stage as "comment_body",
      contentMode: input.contentMode,
      targetContext: input.targetContext ?? null,
      taskContext: input.taskContext,
    });

    (Object.entries(commentBlocks) as Array<[CommentPromptBlockName, string]>).forEach(
      ([name, content]) => {
        if (name === "persona_runtime_packet" || name === "board_context") {
          return;
        }
        allBlocks[name] = makeBlock(name, content);
      },
    );
  } else {
    const replyBlocks = buildReplyOwnedPromptBlockContent({
      flow: "reply",
      stage: input.stage as "reply_body",
      contentMode: input.contentMode,
      targetContext: input.targetContext ?? null,
      taskContext: input.taskContext,
    });

    (Object.entries(replyBlocks) as Array<[ReplyPromptBlockName, string]>).forEach(
      ([name, content]) => {
        if (name === "persona_runtime_packet" || name === "board_context") {
          return;
        }
        allBlocks[name] = makeBlock(name, content);
      },
    );
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
