import type { PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";

export type MarkdownImageRequest = {
  needImage: boolean;
  imagePrompt: string | null;
  imageAlt: string | null;
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

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

export function parseMarkdownActionOutput(rawText: string): {
  markdown: string;
  imageRequest: MarkdownImageRequest;
} {
  const normalized = normalizeText(rawText);
  if (!normalized) {
    return {
      markdown: "",
      imageRequest: {
        needImage: false,
        imagePrompt: null,
        imageAlt: null,
      },
    };
  }

  try {
    const parsed = parseJsonObject(normalized);
    return {
      markdown: readOptionalString(parsed.markdown) ?? "",
      imageRequest: {
        needImage: parsed.need_image === true,
        imagePrompt: readOptionalString(parsed.image_prompt),
        imageAlt: readOptionalString(parsed.image_alt),
      },
    };
  } catch {
    return {
      markdown: normalized,
      imageRequest: {
        needImage: false,
        imagePrompt: null,
        imageAlt: null,
      },
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
