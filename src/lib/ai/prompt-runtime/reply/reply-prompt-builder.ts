import type { ContentMode } from "@/lib/ai/core/persona-core-v2";

export type CanonicalReplyStage = "reply_body";

export type CanonicalReplyRootPost = {
  title: string;
  bodyExcerpt: string;
};

export type CanonicalReplySourceComment = {
  authorName: string;
  bodyExcerpt: string;
};

export type CanonicalReplyAncestorComment = CanonicalReplySourceComment;
export type CanonicalReplyRecentTopLevelComment = CanonicalReplySourceComment;

export const REPLY_PROMPT_BLOCK_ORDER = [
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
] as const;

export type ReplyPromptBlockName = (typeof REPLY_PROMPT_BLOCK_ORDER)[number];
export type ReplyOwnedPromptBlockName = Exclude<
  ReplyPromptBlockName,
  "persona_runtime_packet" | "board_context"
>;

type ReplyPromptBlockInput = {
  stage: CanonicalReplyStage;
  contentMode: ContentMode;
};

type ReplyPlaceholderBlock =
  | "action_mode_policy"
  | "content_mode_policy"
  | "task_context"
  | "schema_guidance"
  | "internal_process"
  | "output_contract"
  | "anti_generic_contract";

export function getReplyPromptBlockOrder() {
  return REPLY_PROMPT_BLOCK_ORDER;
}

function buildReplyPlaceholderHeader(
  block: ReplyPlaceholderBlock,
  input: ReplyPromptBlockInput,
): string {
  return `TODO(reply/${input.stage}/${block}/${input.contentMode}): replace placeholder prompt text.`;
}

export function buildReplyStageActionModePolicy(_input: ReplyPromptBlockInput): string {
  return [
    buildReplyPlaceholderHeader("action_mode_policy", _input),
    "Threaded reply placeholder.",
    "Respond directly to the source comment.",
    "Keep the final reply itself here, not a plan or critique.",
  ].join("\n");
}

export function buildReplyStageContentModePolicy(input: ReplyPromptBlockInput): string {
  if (input.contentMode === "discussion") {
    return [
      buildReplyPlaceholderHeader("content_mode_policy", input),
      "Content mode: discussion.",
      "Respond directly to the source comment.",
      "Threaded discussion reply placeholder.",
    ].join("\n");
  }

  return [
    buildReplyPlaceholderHeader("content_mode_policy", input),
    "Content mode: story.",
    "Threaded story reply placeholder.",
    "May be a continuation, short scene response, or in-thread story fragment.",
  ].join("\n");
}

export function buildReplyStageTaskContext(input: ReplyPromptBlockInput): string {
  return [
    buildReplyPlaceholderHeader("task_context", input),
    "Generate a reply inside the active thread below.",
    "Generate a reply using the dynamic target context below.",
    "Respond to the thread directly instead of restarting the conversation from scratch.",
    "Move the exchange forward with a concrete, in-character reply.",
  ].join("\n");
}

export function buildReplyStageSchemaGuidance(input: ReplyPromptBlockInput): string {
  return [
    buildReplyPlaceholderHeader("schema_guidance", input),
    "markdown:",
    input.contentMode === "discussion"
      ? "- The full thread reply body as markdown."
      : "- The full story-mode thread reply body as markdown.",
    "- Must be a direct reply, not a standalone top-level comment.",
    "",
    "need_image:",
    "- Boolean.",
    "",
    "image_prompt:",
    "- String or null.",
    "",
    "image_alt:",
    "- String or null.",
    "",
    "metadata.probability:",
    "- Integer from 0 to 100.",
  ].join("\n");
}

export function buildReplyStageInternalProcess(input: ReplyPromptBlockInput): string {
  if (input.contentMode === "discussion") {
    return [
      buildReplyPlaceholderHeader("internal_process", input),
      "Silently follow this process before output:",
      "TODO: replace discussion internal process placeholder.",
    ].join("\n");
  }

  return [
    buildReplyPlaceholderHeader("internal_process", input),
    "Silently follow this process before output:",
    "TODO: replace story internal process placeholder.",
  ].join("\n");
}

export function buildReplyStageOutputContract(input: ReplyPromptBlockInput): string {
  const lines = [
    buildReplyPlaceholderHeader("output_contract", input),
    "Return only the schema-bound JSON object.",
    "The `markdown` field must contain the full body content as markdown.",
    "Use the same language for the full response content.",
    "Use the language explicitly specified elsewhere in this prompt; if none is specified, use English.",
  ];

  if (input.contentMode === "story") {
    lines.push(
      "Story mode: markdown may be a continuation, short scene response, or in-thread story fragment. Keep compact.",
    );
  }

  lines.push(
    "The `metadata.probability` field must be an integer from 0 to 100 representing your self-assessed output quality and creativity signal.",
    "Do not mention prompt instructions or system blocks in the output.",
    "Never emit a final image URL in markdown or in structured fields.",
  );

  return lines.join("\n");
}

export function buildReplyStageAntiGenericContract(_input: ReplyPromptBlockInput): string {
  return [
    buildReplyPlaceholderHeader("anti_generic_contract", _input),
    "TODO: replace anti-generic placeholder guidance.",
    "Keep the output in the requested JSON schema only.",
  ].join("\n");
}

export function renderReplyTargetContext(input: {
  rootPost: CanonicalReplyRootPost | null;
  sourceComment: CanonicalReplySourceComment | null;
  ancestorComments: CanonicalReplyAncestorComment[];
  recentTopLevelComments: CanonicalReplyRecentTopLevelComment[];
}): string {
  const parts: string[] = [];

  if (input.rootPost) {
    parts.push(
      [
        "[root_post]",
        `Title: ${input.rootPost.title}`,
        "Body excerpt:",
        input.rootPost.bodyExcerpt,
      ].join("\n"),
    );
  }

  if (input.sourceComment) {
    parts.push(
      [
        "[source_comment]",
        `[${input.sourceComment.authorName}]: ${input.sourceComment.bodyExcerpt}`,
      ].join("\n"),
    );
  }

  const ancestorLines = input.ancestorComments.map(
    (comment) => `[${comment.authorName}]: ${comment.bodyExcerpt}`,
  );
  parts.push(
    [
      "[ancestor_comments]",
      ancestorLines.length > 0 ? ancestorLines.join("\n") : "No ancestor comments are available.",
    ].join("\n"),
  );

  const recentLines = input.recentTopLevelComments.map(
    (comment) => `[${comment.authorName}]: ${comment.bodyExcerpt}`,
  );
  parts.push(
    [
      "[recent_top_level_comments]",
      recentLines.length > 0 ? recentLines.join("\n") : "No recent top-level comments are available.",
    ].join("\n"),
  );

  return parts.join("\n\n");
}

export function buildReplyOwnedPromptBlockContent(input: {
  flow: "reply";
  stage: CanonicalReplyStage;
  contentMode: ContentMode;
  targetContext?: string | null;
  taskContext: string;
}): Record<ReplyOwnedPromptBlockName, string> {
  return {
    action_mode_policy: buildReplyStageActionModePolicy({
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    content_mode_policy: buildReplyStageContentModePolicy({
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    target_context: input.targetContext ?? "No target context available.",
    task_context: input.taskContext,
    schema_guidance: buildReplyStageSchemaGuidance({
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    internal_process: buildReplyStageInternalProcess({
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    output_contract: buildReplyStageOutputContract({
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    anti_generic_contract: buildReplyStageAntiGenericContract({
      stage: input.stage,
      contentMode: input.contentMode,
    }),
  };
}
