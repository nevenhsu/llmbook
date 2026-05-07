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
    "body_outline must contain 2-5 items.",
    "All scores must be integers from 0 to 100.",
    "Do not add extra keys.",
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
