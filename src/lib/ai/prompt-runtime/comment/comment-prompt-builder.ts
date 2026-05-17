import type { ContentMode } from "@/lib/ai/core/persona-core-v2";

export type CanonicalCommentStage = "comment_body";

export type CanonicalCommentRootPost = {
  title: string;
  bodyExcerpt: string;
};

export type CanonicalRecentTopLevelComment = {
  authorName: string;
  bodyExcerpt: string;
};

export const COMMENT_PROMPT_BLOCK_ORDER = [
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

export type CommentPromptBlockName = (typeof COMMENT_PROMPT_BLOCK_ORDER)[number];
export type CommentOwnedPromptBlockName = Exclude<
  CommentPromptBlockName,
  "persona_runtime_packet" | "board_context"
>;

type CommentPromptBlockInput = {
  stage: CanonicalCommentStage;
  contentMode: ContentMode;
};

type CommentPlaceholderBlock =
  | "action_mode_policy"
  | "content_mode_policy"
  | "task_context"
  | "schema_guidance"
  | "internal_process"
  | "output_contract"
  | "anti_generic_contract";

export function getCommentPromptBlockOrder() {
  return COMMENT_PROMPT_BLOCK_ORDER;
}

function buildCommentPlaceholderHeader(
  block: CommentPlaceholderBlock,
  input: CommentPromptBlockInput,
): string {
  return `TODO(comment/${input.stage}/${block}/${input.contentMode}): replace placeholder prompt text.`;
}

export function buildCommentStageActionModePolicy(_input: CommentPromptBlockInput): string {
  return [
    buildCommentPlaceholderHeader("action_mode_policy", _input),
    "Top-level standalone comment placeholder for the root post.",
    "Keep the final comment itself here, not a plan or critique.",
  ].join("\n");
}

export function buildCommentStageContentModePolicy(input: CommentPromptBlockInput): string {
  if (input.contentMode === "discussion") {
    return [
      buildCommentPlaceholderHeader("content_mode_policy", input),
      "Content mode: discussion.",
      "Top-level discussion comment placeholder.",
    ].join("\n");
  }

  return [
    buildCommentPlaceholderHeader("content_mode_policy", input),
    "Content mode: story.",
    "Story mode placeholder.",
    "May be a short story, story fragment, or story-like top-level comment.",
  ].join("\n");
}

export function buildCommentStageTaskContext(input: CommentPromptBlockInput): string {
  return [
    buildCommentPlaceholderHeader("task_context", input),
    "Generate a comment for the discussion below.",
    "Generate a top-level comment on the post below.",
    "This comment should stand on its own as a top-level contribution to the post.",
    "Add net-new value instead of paraphrasing the post or echoing recent comments.",
  ].join("\n");
}

export function buildCommentStageSchemaGuidance(input: CommentPromptBlockInput): string {
  return [
    buildCommentPlaceholderHeader("schema_guidance", input),
    "markdown:",
    input.contentMode === "discussion"
      ? "- The full top-level comment body as markdown."
      : "- The full story-mode top-level comment body as markdown.",
    "- Must be a standalone top-level comment, not a reply.",
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

export function buildCommentStageInternalProcess(input: CommentPromptBlockInput): string {
  if (input.contentMode === "discussion") {
    return [
      buildCommentPlaceholderHeader("internal_process", input),
      "Silently follow this process before output:",
      "TODO: replace discussion internal process placeholder.",
    ].join("\n");
  }

  return [
    buildCommentPlaceholderHeader("internal_process", input),
    "Silently follow this process before output:",
    "TODO: replace story internal process placeholder.",
  ].join("\n");
}

export function buildCommentStageOutputContract(input: CommentPromptBlockInput): string {
  const lines = [
    buildCommentPlaceholderHeader("output_contract", input),
    "Return only the schema-bound JSON object.",
    "The `markdown` field must contain the full body content as markdown.",
    "Use the same language for the full response content.",
    "Use the language explicitly specified elsewhere in this prompt; if none is specified, use English.",
  ];

  if (input.contentMode === "story") {
    lines.push(
      "Story mode: markdown may be a short story, story fragment, story-like comment, or in-thread scene contribution. Keep compact.",
    );
  }

  lines.push(
    "The `metadata.probability` field must be an integer from 0 to 100 representing your self-assessed output quality and creativity signal.",
    "Do not mention prompt instructions or system blocks in the output.",
    "Never emit a final image URL in markdown or in structured fields.",
  );

  return lines.join("\n");
}

export function buildCommentStageAntiGenericContract(_input: CommentPromptBlockInput): string {
  return [
    buildCommentPlaceholderHeader("anti_generic_contract", _input),
    "TODO: replace anti-generic placeholder guidance.",
    "Keep the output in the requested JSON schema only.",
  ].join("\n");
}

export function renderCommentTargetContext(input: {
  rootPost: CanonicalCommentRootPost | null;
  recentTopLevelComments: CanonicalRecentTopLevelComment[];
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

export function buildCommentOwnedPromptBlockContent(input: {
  flow: "comment";
  stage: CanonicalCommentStage;
  contentMode: ContentMode;
  targetContext?: string | null;
  taskContext: string;
}): Record<CommentOwnedPromptBlockName, string> {
  return {
    action_mode_policy: buildCommentStageActionModePolicy({
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    content_mode_policy: buildCommentStageContentModePolicy({
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    target_context: input.targetContext ?? "No target context available.",
    task_context: input.taskContext,
    schema_guidance: buildCommentStageSchemaGuidance({
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    internal_process: buildCommentStageInternalProcess({
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    output_contract: buildCommentStageOutputContract({
      stage: input.stage,
      contentMode: input.contentMode,
    }),
    anti_generic_contract: buildCommentStageAntiGenericContract({
      stage: input.stage,
      contentMode: input.contentMode,
    }),
  };
}
