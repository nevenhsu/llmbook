import type { PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";
import { normalizeText } from "./json-parse-utils";
import { normalizeMetadataProbability } from "./persona-v2-flow-contracts";

export type MarkdownImageRequest = {
  needImage: boolean;
  imagePrompt: string | null;
  imageAlt: string | null;
};

export type ActionOutput = {
  output: {
    markdown: string;
    imageRequest: MarkdownImageRequest;
    metadata: { probability: number };
  } | null;
  error: string | null;
};

export type PostActionOutput = {
  title: string | null;
  body: string;
  tags: string[];
  normalizedTags: string[];
  imageRequest: MarkdownImageRequest;
  metadata: { probability: number };
  error: string | null;
};

export type PostBodyActionOutput = {
  body: string;
  tags: string[];
  normalizedTags: string[];
  imageRequest: MarkdownImageRequest;
  metadata: { probability: number };
  error: string | null;
};

export type VoteActionOutput = {
  target_type: "post" | "comment";
  target_id: string;
  vote: "up" | "down";
  confidence_note: string | null;
};

export type PollPostActionOutput = {
  mode: "create_poll";
  title: string;
  options: string[];
  markdown_body: string | null;
};

export type PollVoteActionOutput = {
  mode: "vote_poll";
  poll_post_id: string;
  selected_option_id: string;
  reason_note: string | null;
};

export function parseMarkdownActionOutput(rawText: string): ActionOutput {
  const normalized = normalizeText(rawText);
  if (!normalized) {
    return {
      output: null,
      error: null,
    };
  }

  try {
    const parsed = parseJsonObject(normalized);
    const keys = Object.keys(parsed);

    // Validate no extra top-level keys
    const allowedKeys = new Set([
      "markdown",
      "need_image",
      "image_prompt",
      "image_alt",
      "metadata",
    ]);
    const hasExtraKeys = keys.some((key) => !allowedKeys.has(key));
    if (hasExtraKeys) {
      return {
        output: null,
        error: "extra top-level keys found",
      };
    }

    // Validate markdown is present and non-empty
    const markdown = readOptionalString(parsed.markdown);
    if (!markdown) {
      return {
        output: null,
        error: "markdown is required and must be non-empty",
      };
    }

    // Validate need_image is boolean
    const needImage = parsed.need_image === true;
    if (
      parsed.need_image !== true &&
      parsed.need_image !== false &&
      parsed.need_image !== undefined
    ) {
      return {
        output: null,
        error: "need_image must be a boolean",
      };
    }

    // Validate image_prompt and image_alt are string or null
    const imagePrompt = readOptionalString(parsed.image_prompt);
    const imageAlt = readOptionalString(parsed.image_alt);

    if (
      parsed.image_prompt !== null &&
      parsed.image_prompt !== undefined &&
      typeof parsed.image_prompt !== "string"
    ) {
      return {
        output: null,
        error: "image_prompt must be a string or null",
      };
    }
    if (
      parsed.image_alt !== null &&
      parsed.image_alt !== undefined &&
      typeof parsed.image_alt !== "string"
    ) {
      return {
        output: null,
        error: "image_alt must be a string or null",
      };
    }

    return {
      output: {
        markdown,
        imageRequest: {
          needImage,
          imagePrompt,
          imageAlt,
        },
        metadata: normalizeMetadataProbability(parsed.metadata),
      },
      error: null,
    };
  } catch (e) {
    return {
      output: null,
      error: e instanceof Error ? e.message : "failed to parse output",
    };
  }
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readStringPreserveEmpty(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  return value.replace(/\r\n/g, "\n").trim();
}

function normalizePostTagForStorage(tag: string): string {
  return tag.replace(/^#+/, "").trim();
}

function extractJsonFromText(text: string): string {
  const trimmed = normalizeText(text);
  if (!trimmed) {
    return "";
  }
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/```\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function parseJsonObject(text: string): Record<string, unknown> {
  const jsonText = extractJsonFromText(text);
  if (!jsonText) {
    throw new Error("structured action output is empty");
  }
  const parsed = JSON.parse(jsonText) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("structured action output must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export function parsePostActionOutput(rawText: string): PostActionOutput {
  const normalized = normalizeText(rawText);
  if (!normalized) {
    return {
      title: null,
      body: "",
      tags: [],
      normalizedTags: [],
      imageRequest: {
        needImage: false,
        imagePrompt: null,
        imageAlt: null,
      },
      metadata: { probability: 0 },
      error: "invalid post output: response is empty",
    };
  }

  try {
    const parsed = parseJsonObject(normalized);
    const title = readOptionalString(parsed.title);
    const body =
      readStringPreserveEmpty(parsed.body) ?? readStringPreserveEmpty(parsed.markdown) ?? "";
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags
          .map((item) => readOptionalString(item))
          .filter((item): item is string => Boolean(item))
      : [];
    const normalizedTags = tags
      .map((tag) => normalizePostTagForStorage(tag))
      .filter((tag) => tag.length > 0);
    const missingFields: string[] = [];

    if (!title) {
      missingFields.push("title");
    }
    if (typeof parsed.body !== "string") {
      missingFields.push("body");
    }
    if (tags.length < 1 || tags.length > 5 || tags.some((tag) => !tag.startsWith("#"))) {
      missingFields.push("tags");
    }

    return {
      title,
      body,
      tags,
      normalizedTags,
      imageRequest: {
        needImage: parsed.need_image === true,
        imagePrompt: readOptionalString(parsed.image_prompt),
        imageAlt: readOptionalString(parsed.image_alt),
      },
      metadata: normalizeMetadataProbability(parsed.metadata),
      error:
        missingFields.length > 0
          ? `invalid post output: missing required field${missingFields.length > 1 ? "s" : ""} ${missingFields.join(", ")}`
          : null,
    };
  } catch {
    return {
      title: null,
      body: normalized,
      tags: [],
      normalizedTags: [],
      imageRequest: {
        needImage: false,
        imagePrompt: null,
        imageAlt: null,
      },
      metadata: { probability: 0 },
      error: "invalid post output: expected one JSON object with title, body, and tags",
    };
  }
}

export function parsePostBodyActionOutput(rawText: string): PostBodyActionOutput {
  const normalized = normalizeText(rawText);
  if (!normalized) {
    return {
      body: "",
      tags: [],
      normalizedTags: [],
      imageRequest: {
        needImage: false,
        imagePrompt: null,
        imageAlt: null,
      },
      metadata: { probability: 0 },
      error: "invalid post_body output: response is empty",
    };
  }

  try {
    const parsed = parseJsonObject(normalized);
    const body =
      readStringPreserveEmpty(parsed.body) ?? readStringPreserveEmpty(parsed.markdown) ?? "";
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags
          .map((item) => readOptionalString(item))
          .filter((item): item is string => Boolean(item))
      : [];
    const normalizedTags = tags
      .map((tag) => normalizePostTagForStorage(tag))
      .filter((tag) => tag.length > 0);
    const issues: string[] = [];

    if (typeof parsed.title === "string" && parsed.title.trim().length > 0) {
      issues.push("title");
    }
    if (typeof parsed.body !== "string") {
      issues.push("body");
    }
    if (tags.length < 1 || tags.length > 5 || tags.some((tag) => !tag.startsWith("#"))) {
      issues.push("tags");
    }

    return {
      body,
      tags,
      normalizedTags,
      imageRequest: {
        needImage: parsed.need_image === true,
        imagePrompt: readOptionalString(parsed.image_prompt),
        imageAlt: readOptionalString(parsed.image_alt),
      },
      metadata: normalizeMetadataProbability(parsed.metadata),
      error:
        issues.length > 0
          ? `invalid post_body output: invalid or forbidden field${issues.length > 1 ? "s" : ""} ${issues.join(", ")}`
          : null,
    };
  } catch {
    return {
      body: normalized,
      tags: [],
      normalizedTags: [],
      imageRequest: {
        needImage: false,
        imagePrompt: null,
        imageAlt: null,
      },
      metadata: { probability: 0 },
      error: "invalid post_body output: expected one JSON object with body and tags",
    };
  }
}

export function parseStructuredActionOutput(
  actionType: Extract<PromptActionType, "vote" | "poll_post" | "poll_vote">,
  rawText: string,
): VoteActionOutput | PollPostActionOutput | PollVoteActionOutput {
  const parsed = parseJsonObject(rawText);

  switch (actionType) {
    case "vote": {
      const targetType = parsed.target_type;
      const targetId = readOptionalString(parsed.target_id);
      const vote = parsed.vote;
      if ((targetType !== "post" && targetType !== "comment") || !targetId) {
        throw new Error("invalid vote output");
      }
      if (vote !== "up" && vote !== "down") {
        throw new Error("invalid vote output");
      }
      return {
        target_type: targetType,
        target_id: targetId,
        vote,
        confidence_note: readOptionalString(parsed.confidence_note),
      };
    }
    case "poll_post": {
      const title = readOptionalString(parsed.title);
      const options = Array.isArray(parsed.options)
        ? parsed.options
            .map((item) => readOptionalString(item))
            .filter((item): item is string => Boolean(item))
        : [];
      if (parsed.mode !== "create_poll" || !title || options.length === 0) {
        throw new Error("invalid poll_post output");
      }
      return {
        mode: "create_poll",
        title,
        options,
        markdown_body: readOptionalString(parsed.markdown_body),
      };
    }
    case "poll_vote": {
      const pollPostId = readOptionalString(parsed.poll_post_id);
      const selectedOptionId = readOptionalString(parsed.selected_option_id);
      if (parsed.mode !== "vote_poll" || !pollPostId || !selectedOptionId) {
        throw new Error("invalid poll_vote output");
      }
      return {
        mode: "vote_poll",
        poll_post_id: pollPostId,
        selected_option_id: selectedOptionId,
        reason_note: readOptionalString(parsed.reason_note),
      };
    }
  }
}

export async function enqueueImageJobForMarkdownAction(input: {
  markdown: string;
  imageRequest: MarkdownImageRequest;
  imageGenerationEnabled: boolean;
  createImageJob: (input: { prompt: string; alt: string | null }) => Promise<{ jobId: string }>;
}): Promise<{
  markdown: string;
  imageJob: { jobId: string; prompt: string; alt: string | null } | null;
}> {
  if (
    !input.imageGenerationEnabled ||
    !input.imageRequest.needImage ||
    !input.imageRequest.imagePrompt
  ) {
    return {
      markdown: input.markdown,
      imageJob: null,
    };
  }

  const imageJob = await input.createImageJob({
    prompt: input.imageRequest.imagePrompt,
    alt: input.imageRequest.imageAlt,
  });

  return {
    markdown: input.markdown,
    imageJob: {
      jobId: imageJob.jobId,
      prompt: input.imageRequest.imagePrompt,
      alt: input.imageRequest.imageAlt,
    },
  };
}

export function insertGeneratedImageMarkdown(input: {
  markdown: string;
  imageUrl: string;
  imageAlt: string | null;
}): string {
  const markdown = normalizeText(input.markdown);
  const imageAlt = readOptionalString(input.imageAlt) ?? "Generated image";
  return `${markdown}\n\n![${imageAlt}](${input.imageUrl})`;
}
