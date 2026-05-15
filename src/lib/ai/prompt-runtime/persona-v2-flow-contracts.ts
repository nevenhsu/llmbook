import { z } from "zod";
import type { ContentMode, PersonaFlowKind } from "@/lib/ai/core/persona-core-v2";
import { buildPostStageOutputContract } from "@/lib/ai/prompt-runtime/post/post-prompt-builder";

type WriterFlowKind = PersonaFlowKind;

type ContractFlowKind = WriterFlowKind | "post" | "post_frame";

function buildMarkdownOutputContract(flow: "comment" | "reply", contentMode: ContentMode): string {
  const lines = [
    "The `markdown` field must contain the full body content as markdown.",
    "Use the same language for the full response content.",
    "Use the language explicitly specified elsewhere in this prompt; if none is specified, use English.",
  ];

  if (contentMode === "story") {
    lines.push(
      "Story mode: markdown may be a short story, story fragment, story-like comment, continuation, short scene response, or in-thread story fragment. Keep compact.",
    );
  }

  lines.push(
    "The `metadata.probability` field must be an integer from 0 to 100 representing your self-assessed output quality and creativity signal.",
    "Do not mention prompt instructions or system blocks in the output.",
    "Never emit a final image URL in markdown or in structured fields.",
  );

  return lines.join("\n");
}

export function buildOutputContractV2(input: {
  flow: ContractFlowKind;
  contentMode: ContentMode;
}): string {
  switch (input.flow) {
    case "post_plan":
      return buildPostStageOutputContract({
        stage: "post_plan",
        contentMode: input.contentMode,
      });
    case "post_frame":
      return buildPostStageOutputContract({
        stage: "post_frame",
        contentMode: input.contentMode,
      });
    case "post_body":
      return buildPostStageOutputContract({
        stage: "post_body",
        contentMode: input.contentMode,
      });
    case "post": {
      const bodyContract = buildPostStageOutputContract({
        stage: "post_body",
        contentMode: input.contentMode,
      });
      return [
        "The `title` field must contain the full post title.",
        "Use the same language for `title`, `body`, and `tags`.",
        "Do not repeat the title as a markdown H1 inside `body`.",
        bodyContract,
      ].join("\n");
    }
    case "comment":
    case "reply":
      return buildMarkdownOutputContract(input.flow, input.contentMode);
  }
}

export function parseMetadataProbability(raw: unknown): number {
  if (typeof raw !== "number") {
    return 0;
  }
  if (!Number.isInteger(raw)) {
    return 0;
  }
  if (!Number.isFinite(raw)) {
    return 0;
  }
  if (raw < 0 || raw > 100) {
    return 0;
  }
  return raw;
}

export function normalizeMetadataProbability(raw: unknown): { probability: number } {
  if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
    return { probability: 0 };
  }
  const record = raw as Record<string, unknown>;
  return {
    probability: parseMetadataProbability(record.probability),
  };
}

// ---- Code-owned Zod output schemas ----

const MetadataSchema = z.preprocess(
  (val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      const prob = obj.probability;
      obj.probability =
        Number.isInteger(prob) && (prob as number) >= 0 && (prob as number) <= 100 ? prob : 0;
    }
    return val;
  },
  z.object({
    probability: z.number().int().min(0).max(100).default(0),
  }),
);

const PostPlanCandidateSchema = z.object({
  title: z.string(),
  idea: z.string(),
  outline: z.array(z.string()).min(1).max(3),
  persona_fit_score: z.number().int().min(0).max(100),
  novelty_score: z.number().int().min(0).max(100),
});

export const PostPlanOutputSchema = z.object({
  candidates: z.array(PostPlanCandidateSchema).min(2).max(3),
});

export const PostBodyOutputSchema = z.object({
  body: z.string(),
  tags: z.array(z.string()).min(1).max(5),
  need_image: z.boolean(),
  image_prompt: z.string().nullable(),
  image_alt: z.string().nullable(),
  metadata: MetadataSchema.optional().default({ probability: 0 }),
});

export const PostFrameSchema = z.object({
  main_idea: z.string().min(1),
  angle: z.string().min(1),
  beats: z.array(z.string().min(1)).min(3).max(5),
  required_details: z.array(z.string().min(1)).min(3).max(7),
  ending_direction: z.string().min(1),
  tone: z.array(z.string().min(1)).min(2).max(5),
  avoid: z.array(z.string().min(1)).min(3).max(6),
});

export type PostFrame = z.infer<typeof PostFrameSchema>;

const MarkdownOutputFields = {
  markdown: z.string(),
  need_image: z.boolean(),
  image_prompt: z.string().nullable(),
  image_alt: z.string().nullable(),
  metadata: MetadataSchema.optional().default({ probability: 0 }),
};

export const CommentOutputSchema = z.object(MarkdownOutputFields);

export const ReplyOutputSchema = z.object(MarkdownOutputFields);

// ---- Schema-derived metadata ----

export type SchemaMetadata = {
  schemaName: string;
  allowedRepairPaths: string[];
  immutablePaths: string[];
};

export const POST_PLAN_SCHEMA_META: SchemaMetadata = {
  schemaName: "PostPlanOutputSchema",
  allowedRepairPaths: [
    "candidates",
    "candidates.*.title",
    "candidates.*.idea",
    "candidates.*.outline",
    "candidates.*.persona_fit_score",
    "candidates.*.novelty_score",
  ],
  immutablePaths: ["candidates"],
};

export const POST_BODY_SCHEMA_META: SchemaMetadata = {
  schemaName: "PostBodyOutputSchema",
  allowedRepairPaths: [
    "body",
    "tags",
    "need_image",
    "image_prompt",
    "image_alt",
    "metadata",
    "metadata.probability",
  ],
  immutablePaths: ["body"],
};

export const POST_FRAME_SCHEMA_META: SchemaMetadata = {
  schemaName: "PostFrameSchema",
  allowedRepairPaths: [
    "main_idea",
    "angle",
    "beats",
    "required_details",
    "ending_direction",
    "tone",
    "avoid",
  ],
  immutablePaths: [],
};

export const COMMENT_SCHEMA_META: SchemaMetadata = {
  schemaName: "CommentOutputSchema",
  allowedRepairPaths: [
    "markdown",
    "need_image",
    "image_prompt",
    "image_alt",
    "metadata",
    "metadata.probability",
  ],
  immutablePaths: ["markdown"],
};

export const REPLY_SCHEMA_META: SchemaMetadata = {
  schemaName: "ReplyOutputSchema",
  allowedRepairPaths: [
    "markdown",
    "need_image",
    "image_prompt",
    "image_alt",
    "metadata",
    "metadata.probability",
  ],
  immutablePaths: ["markdown"],
};

export function getFlowSchemaMeta(flow: string): SchemaMetadata {
  switch (flow) {
    case "post_plan":
      return POST_PLAN_SCHEMA_META;
    case "post_frame":
      return POST_FRAME_SCHEMA_META;
    case "post_body":
    case "post":
      return POST_BODY_SCHEMA_META;
    case "comment":
      return COMMENT_SCHEMA_META;
    case "reply":
      return REPLY_SCHEMA_META;
    default:
      throw new Error(`Unknown flow: ${flow}`);
  }
}
