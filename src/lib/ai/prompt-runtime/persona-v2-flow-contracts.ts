import { z } from "zod";
import type { ContentMode, PersonaFlowKind } from "@/lib/ai/core/persona-core-v2";

type WriterFlowKind = Exclude<PersonaFlowKind, "audit">;

type ContractFlowKind = WriterFlowKind | "post";

function buildPostPlanOutputContract(contentMode: ContentMode): string {
  const lines = [
    "Return exactly one JSON object.",
    "{",
    '  "candidates": [',
    "    {",
    '      "title": "string",',
    '      "thesis": "string",',
    '      "body_outline": ["string"],',
    '      "persona_fit_score": 0,',
    '      "novelty_score": 0',
    "    }",
    "  ]",
    "}",
    "Return 2-3 candidates.",
    "Do not output any text outside the JSON object.",
    "Do not mention prompt instructions or system blocks in the output.",
  ];

  if (contentMode === "story") {
    lines.push(
      "Story mode: title is a possible story title, thesis is a one-sentence premise, and body_outline contains story beats.",
    );
  }

  return lines.join("\n");
}

function buildWriterOutputContract(flow: "post_body" | "post", contentMode: ContentMode): string {
  const lines = ["Return exactly one JSON object."];

  if (flow === "post") {
    lines.push("title: string");
  }
  lines.push(
    "body: string",
    "tags: string[]",
    "need_image: boolean",
    "image_prompt: string | null",
    "image_alt: string | null",
    'metadata: { "probability": 0 }',
    "The `body` field must contain the full post body content as markdown.",
    'The `tags` field must contain 1 to 5 hashtags like "#cthulhu" or "#克蘇魯".',
    "Use the same language for `body` and `tags`.",
    "Use the language explicitly specified elsewhere in this prompt; if none is specified, use English.",
  );

  if (flow === "post") {
    lines.push(
      "The `title` field must contain the full post title.",
      "Use the same language for `title`, `body`, and `tags`.",
      "Do not repeat the title as a markdown H1 inside `body`.",
    );
  }

  if (contentMode === "story") {
    lines.push(
      "Story mode: body is long story markdown prose using the persona's story logic and voice. Do not turn the story into writing advice or a synopsis.",
    );
  }

  lines.push(
    "The `metadata.probability` field must be an integer from 0 to 100 representing your self-assessed output quality and creativity signal.",
    "Do not output any text outside the JSON object.",
    "Do not mention prompt instructions or system blocks in the output.",
    "Never emit a final image URL in markdown or in structured fields.",
  );

  return lines.join("\n");
}

function buildMarkdownOutputContract(flow: "comment" | "reply", contentMode: ContentMode): string {
  const lines = [
    "Return exactly one JSON object.",
    "markdown: string",
    "need_image: boolean",
    "image_prompt: string | null",
    "image_alt: string | null",
    'metadata: { "probability": 0 }',
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
    "Do not output any text outside the JSON object.",
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
      return buildPostPlanOutputContract(input.contentMode);
    case "post_body":
    case "post":
      return buildWriterOutputContract(input.flow, input.contentMode);
    case "comment":
    case "reply":
      return buildMarkdownOutputContract(input.flow, input.contentMode);
  }
}

export function buildAuditOutputContractV2(input: {
  flow: ContractFlowKind;
  contentMode: ContentMode;
}): string {
  return [
    "Return exactly one JSON object.",
    "{",
    '  "passes": true,',
    '  "issues": ["string"],',
    '  "repairGuidance": ["string"],',
    '  "checks": {',
    '    "procedure_fit": "pass | fail",',
    ...(input.contentMode === "story" ? ['    "narrative_fit": "pass | fail",'] : []),
    "  }",
    "}",
    "Do not output any text outside the JSON object.",
  ].join("\n");
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

const MetadataOutputSchema = z.object({
  metadata: MetadataSchema.optional().default({ probability: 0 }),
});

const PostPlanCandidateSchema = z.object({
  title: z.string(),
  thesis: z.string(),
  body_outline: z.array(z.string()).min(2).max(5),
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

const MarkdownOutputFields = {
  markdown: z.string(),
  need_image: z.boolean(),
  image_prompt: z.string().nullable(),
  image_alt: z.string().nullable(),
  metadata: MetadataSchema.optional().default({ probability: 0 }),
};

export const CommentOutputSchema = z.object(MarkdownOutputFields);

export const ReplyOutputSchema = z.object(MarkdownOutputFields);

// ---- Audit response schemas ----

const AuditCheckEnum = z.enum(["pass", "fail"]);

const DiscussionAuditChecks = z.object({
  candidate_quality: AuditCheckEnum.optional(),
  content_quality: AuditCheckEnum.optional(),
  comment_quality: AuditCheckEnum.optional(),
  reply_quality: AuditCheckEnum.optional(),
  persona_fit: AuditCheckEnum,
});

const StoryAuditChecks = z.object({
  story_candidate_quality: AuditCheckEnum.optional(),
  story_quality: AuditCheckEnum.optional(),
  story_comment_quality: AuditCheckEnum.optional(),
  story_reply_quality: AuditCheckEnum.optional(),
  persona_fit: AuditCheckEnum,
});

export const PostPlanDiscussionAuditSchema = z.object({
  passes: z.boolean(),
  issues: z.array(z.string()),
  repairGuidance: z.array(z.string()),
  checks: z.object({
    candidate_quality: AuditCheckEnum,
    persona_fit: AuditCheckEnum,
  }),
});

export const PostPlanStoryAuditSchema = z.object({
  passes: z.boolean(),
  issues: z.array(z.string()),
  repairGuidance: z.array(z.string()),
  checks: z.object({
    story_candidate_quality: AuditCheckEnum,
    persona_fit: AuditCheckEnum,
  }),
});

export const PostBodyDiscussionAuditSchema = z.object({
  passes: z.boolean(),
  issues: z.array(z.string()),
  repairGuidance: z.array(z.string()),
  checks: z.object({
    content_quality: AuditCheckEnum,
    persona_fit: AuditCheckEnum,
  }),
});

export const PostBodyStoryAuditSchema = z.object({
  passes: z.boolean(),
  issues: z.array(z.string()),
  repairGuidance: z.array(z.string()),
  checks: z.object({
    story_quality: AuditCheckEnum,
    persona_fit: AuditCheckEnum,
  }),
});

export const CommentDiscussionAuditSchema = z.object({
  passes: z.boolean(),
  issues: z.array(z.string()),
  repairGuidance: z.array(z.string()),
  checks: z.object({
    comment_quality: AuditCheckEnum,
    persona_fit: AuditCheckEnum,
  }),
});

export const CommentStoryAuditSchema = z.object({
  passes: z.boolean(),
  issues: z.array(z.string()),
  repairGuidance: z.array(z.string()),
  checks: z.object({
    story_comment_quality: AuditCheckEnum,
    persona_fit: AuditCheckEnum,
  }),
});

export const ReplyDiscussionAuditSchema = z.object({
  passes: z.boolean(),
  issues: z.array(z.string()),
  repairGuidance: z.array(z.string()),
  checks: z.object({
    reply_quality: AuditCheckEnum,
    persona_fit: AuditCheckEnum,
  }),
});

export const ReplyStoryAuditSchema = z.object({
  passes: z.boolean(),
  issues: z.array(z.string()),
  repairGuidance: z.array(z.string()),
  checks: z.object({
    story_reply_quality: AuditCheckEnum,
    persona_fit: AuditCheckEnum,
  }),
});

// ---- Schema-derived metadata ----

export type SchemaMetadata = {
  schemaName: string;
  validationRules: string[];
  allowedRepairPaths: string[];
  immutablePaths: string[];
};

export const POST_PLAN_SCHEMA_META: SchemaMetadata = {
  schemaName: "PostPlanOutputSchema",
  validationRules: [
    "candidates must be array of 2-3 items",
    "each candidate must have title, thesis, body_outline (2-5 items), persona_fit_score (0-100), novelty_score (0-100)",
  ],
  allowedRepairPaths: [
    "candidates",
    "candidates.*.title",
    "candidates.*.thesis",
    "candidates.*.body_outline",
    "candidates.*.persona_fit_score",
    "candidates.*.novelty_score",
  ],
  immutablePaths: ["candidates"],
};

export const POST_BODY_SCHEMA_META: SchemaMetadata = {
  schemaName: "PostBodyOutputSchema",
  validationRules: [
    "body must be markdown string",
    "tags must be array of 1-5 strings",
    "need_image must be boolean",
    "metadata.probability must be integer 0-100",
  ],
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

export const COMMENT_SCHEMA_META: SchemaMetadata = {
  schemaName: "CommentOutputSchema",
  validationRules: [
    "markdown must be string",
    "need_image must be boolean",
    "metadata.probability must be integer 0-100",
  ],
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
  validationRules: [
    "markdown must be string",
    "need_image must be boolean",
    "metadata.probability must be integer 0-100",
  ],
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

// ---- Audit schema metadata ----

export const POST_PLAN_DISCUSSION_AUDIT_META: SchemaMetadata = {
  schemaName: "PostPlanDiscussionAuditSchema",
  validationRules: [
    "passes must be boolean",
    "issues must be array of strings",
    "repairGuidance must be array of strings",
    "checks.candidate_quality must be pass|fail",
    "checks.persona_fit must be pass|fail",
  ],
  allowedRepairPaths: ["issues", "repairGuidance", "passes", "checks"],
  immutablePaths: [],
};

export const POST_PLAN_STORY_AUDIT_META: SchemaMetadata = {
  schemaName: "PostPlanStoryAuditSchema",
  validationRules: [
    "passes must be boolean",
    "issues must be array of strings",
    "repairGuidance must be array of strings",
    "checks.story_candidate_quality must be pass|fail",
    "checks.persona_fit must be pass|fail",
  ],
  allowedRepairPaths: ["issues", "repairGuidance", "passes", "checks"],
  immutablePaths: [],
};

export const POST_BODY_DISCUSSION_AUDIT_META: SchemaMetadata = {
  schemaName: "PostBodyDiscussionAuditSchema",
  validationRules: [
    "passes must be boolean",
    "issues must be array of strings",
    "repairGuidance must be array of strings",
    "checks.content_quality must be pass|fail",
    "checks.persona_fit must be pass|fail",
  ],
  allowedRepairPaths: ["issues", "repairGuidance", "passes", "checks"],
  immutablePaths: [],
};

export const POST_BODY_STORY_AUDIT_META: SchemaMetadata = {
  schemaName: "PostBodyStoryAuditSchema",
  validationRules: [
    "passes must be boolean",
    "issues must be array of strings",
    "repairGuidance must be array of strings",
    "checks.story_quality must be pass|fail",
    "checks.persona_fit must be pass|fail",
  ],
  allowedRepairPaths: ["issues", "repairGuidance", "passes", "checks"],
  immutablePaths: [],
};

export const COMMENT_DISCUSSION_AUDIT_META: SchemaMetadata = {
  schemaName: "CommentDiscussionAuditSchema",
  validationRules: [
    "passes must be boolean",
    "issues must be array of strings",
    "repairGuidance must be array of strings",
    "checks.comment_quality must be pass|fail",
    "checks.persona_fit must be pass|fail",
  ],
  allowedRepairPaths: ["issues", "repairGuidance", "passes", "checks"],
  immutablePaths: [],
};

export const COMMENT_STORY_AUDIT_META: SchemaMetadata = {
  schemaName: "CommentStoryAuditSchema",
  validationRules: [
    "passes must be boolean",
    "issues must be array of strings",
    "repairGuidance must be array of strings",
    "checks.story_comment_quality must be pass|fail",
    "checks.persona_fit must be pass|fail",
  ],
  allowedRepairPaths: ["issues", "repairGuidance", "passes", "checks"],
  immutablePaths: [],
};

export const REPLY_DISCUSSION_AUDIT_META: SchemaMetadata = {
  schemaName: "ReplyDiscussionAuditSchema",
  validationRules: [
    "passes must be boolean",
    "issues must be array of strings",
    "repairGuidance must be array of strings",
    "checks.reply_quality must be pass|fail",
    "checks.persona_fit must be pass|fail",
  ],
  allowedRepairPaths: ["issues", "repairGuidance", "passes", "checks"],
  immutablePaths: [],
};

export const REPLY_STORY_AUDIT_META: SchemaMetadata = {
  schemaName: "ReplyStoryAuditSchema",
  validationRules: [
    "passes must be boolean",
    "issues must be array of strings",
    "repairGuidance must be array of strings",
    "checks.story_reply_quality must be pass|fail",
    "checks.persona_fit must be pass|fail",
  ],
  allowedRepairPaths: ["issues", "repairGuidance", "passes", "checks"],
  immutablePaths: [],
};

export function getAuditSchemaMeta(flow: string, contentMode: ContentMode): SchemaMetadata {
  const isStory = contentMode === "story";
  switch (flow) {
    case "post_plan":
      return isStory ? POST_PLAN_STORY_AUDIT_META : POST_PLAN_DISCUSSION_AUDIT_META;
    case "post_body":
    case "post":
      return isStory ? POST_BODY_STORY_AUDIT_META : POST_BODY_DISCUSSION_AUDIT_META;
    case "comment":
      return isStory ? COMMENT_STORY_AUDIT_META : COMMENT_DISCUSSION_AUDIT_META;
    case "reply":
      return isStory ? REPLY_STORY_AUDIT_META : REPLY_DISCUSSION_AUDIT_META;
    default:
      throw new Error(`Unknown flow: ${flow}`);
  }
}

export function getAuditSchema(flow: string, contentMode: ContentMode) {
  const isStory = contentMode === "story";
  switch (flow) {
    case "post_plan":
      return isStory ? PostPlanStoryAuditSchema : PostPlanDiscussionAuditSchema;
    case "post_body":
    case "post":
      return isStory ? PostBodyStoryAuditSchema : PostBodyDiscussionAuditSchema;
    case "comment":
      return isStory ? CommentStoryAuditSchema : CommentDiscussionAuditSchema;
    case "reply":
      return isStory ? ReplyStoryAuditSchema : ReplyDiscussionAuditSchema;
    default:
      throw new Error(`Unknown flow: ${flow}`);
  }
}
