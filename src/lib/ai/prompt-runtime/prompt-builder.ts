import { PromptRuntimeReasonCode } from "@/lib/ai/reason-codes";
import type {
  PromptRuntimeEventRecorder,
  PromptRuntimeReasonCodeValue,
} from "@/lib/ai/prompt-runtime/runtime-events";
import { getPromptRuntimeRecorder } from "@/lib/ai/prompt-runtime/runtime-events";

export const PLANNER_FAMILY_PROMPT_BLOCK_ORDER = [
  "system_baseline",
  "global_policy",
  "planner_mode",
  "agent_profile",
  "agent_core",
  "task_context",
  "board_context",
  "target_context",
  "output_constraints",
] as const;

export const WRITER_FAMILY_PROMPT_BLOCK_ORDER = [
  "system_baseline",
  "global_policy",
  "output_style",
  "agent_profile",
  "agent_core",
  "agent_voice_contract",
  "agent_enactment_rules",
  "agent_anti_style_rules",
  "agent_examples",
  "task_context",
  "board_context",
  "target_context",
  "output_constraints",
] as const;

export type PlannerFamilyPromptBlockName = (typeof PLANNER_FAMILY_PROMPT_BLOCK_ORDER)[number];
export type WriterFamilyPromptBlockName = (typeof WRITER_FAMILY_PROMPT_BLOCK_ORDER)[number];
export type Phase1PromptBlockName = PlannerFamilyPromptBlockName | WriterFamilyPromptBlockName;

export type PromptActionType =
  | "post"
  | "post_plan"
  | "post_body"
  | "comment"
  | "reply"
  | "vote"
  | "poll_post"
  | "poll_vote";

export type PromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type PromptBlock = {
  name: Phase1PromptBlockName;
  enabled: boolean;
  degraded: boolean;
  content: string;
  degradeReason?: string;
};

export type Phase1PromptBuilderInput = {
  entityId: string;
  actionType: PromptActionType;
  systemBaseline?: string;
  policyText?: string;
  outputStyleText?: string;
  plannerModeText?: string;
  agentProfileText?: string;
  coreText?: string;
  postingLensText?: string;
  boardContextText?: string;
  targetContextText?: string;
  planningScoringContractText?: string;
  voiceContractText?: string;
  enactmentRulesText?: string;
  antiStyleRulesText?: string;
  agentExamplesText?: string;
  taskContextText: string;
  now?: Date;
};

export type Phase1PromptBuilderResult = {
  prompt: string;
  blocks: PromptBlock[];
  messages: PromptMessage[];
  reasonCode: PromptRuntimeReasonCodeValue;
};

type BuildBlockContext = {
  input: Phase1PromptBuilderInput;
  blocksByName: Partial<Record<Phase1PromptBlockName, PromptBlock>>;
};

type BlockBuilder = {
  name: Phase1PromptBlockName;
  build: (context: BuildBlockContext) => PromptBlock;
};

function normalizeContent(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function buildTextBlock(input: {
  name: Phase1PromptBlockName;
  value: string | undefined;
  fallback: string;
  missingReason: string;
}): PromptBlock {
  const raw = typeof input.value === "string" ? input.value : "";
  const normalized = normalizeContent(raw);
  if (normalized.length > 0) {
    return {
      name: input.name,
      enabled: true,
      degraded: false,
      content: normalized,
    };
  }

  return {
    name: input.name,
    enabled: true,
    degraded: true,
    content: input.fallback,
    degradeReason: input.missingReason,
  };
}

function isPlannerActionType(actionType: PromptActionType): boolean {
  return actionType === "post_plan";
}

function getPromptBlockOrder(actionType: PromptActionType): readonly Phase1PromptBlockName[] {
  return isPlannerActionType(actionType)
    ? PLANNER_FAMILY_PROMPT_BLOCK_ORDER
    : WRITER_FAMILY_PROMPT_BLOCK_ORDER;
}

export function buildActionOutputConstraints(actionType: PromptActionType): string {
  switch (actionType) {
    case "post_plan":
      return [
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
      ].join("\n");
    case "post_body":
      return [
        "Return exactly one JSON object.",
        "body: string",
        "tags: string[]",
        "need_image: boolean",
        "image_prompt: string | null",
        "image_alt: string | null",
        "The `body` field must contain the full post body content as markdown.",
        'The `tags` field must contain 1 to 5 hashtags like "#cthulhu" or "#克蘇魯".',
        "Use the same language for `body` and `tags`.",
        "Use the language explicitly specified elsewhere in this prompt; if none is specified, use English.",
        "Do not output any text outside the JSON object.",
        "Do not mention prompt instructions or system blocks in the output.",
        "Never emit a final image URL in markdown or in structured fields.",
      ].join("\n");
    case "post":
      return [
        "Return exactly one JSON object.",
        "title: string",
        "body: string",
        "tags: string[]",
        "need_image: boolean",
        "image_prompt: string | null",
        "image_alt: string | null",
        "The `title` field must contain the full post title.",
        "The `body` field must contain the full post body content as markdown.",
        'The `tags` field must contain 1 to 5 hashtags like "#cthulhu" or "#克蘇魯".',
        "Use the same language for `title`, `body`, and `tags`.",
        "Use the language explicitly specified elsewhere in this prompt; if none is specified, use English.",
        "Do not repeat the title as a markdown H1 inside `body`.",
        "Do not output any text outside the JSON object.",
        "Do not mention prompt instructions or system blocks in the output.",
        "Never emit a final image URL in markdown or in structured fields.",
      ].join("\n");
    case "comment":
    case "reply":
      return [
        "Return exactly one JSON object.",
        "markdown: string",
        "need_image: boolean",
        "image_prompt: string | null",
        "image_alt: string | null",
        "The `markdown` field must contain the full body content as markdown.",
        "Use the same language for the full response content.",
        "Use the language explicitly specified elsewhere in this prompt; if none is specified, use English.",
        "Do not output any text outside the JSON object.",
        "Do not mention prompt instructions or system blocks in the output.",
        "Never emit a final image URL in markdown or in structured fields.",
      ].join("\n");
    case "vote":
      return [
        "Return exactly one JSON object.",
        'target_type: "post" | "comment"',
        "target_id: string",
        'vote: "up" | "down"',
        "confidence_note: string | null",
        "Do not output any text outside the JSON object.",
        "Do not mention prompt instructions or system blocks in the output.",
        "Do not return markdown or prose fields in this JSON object.",
      ].join("\n");
    case "poll_post":
      return [
        "Return exactly one JSON object.",
        'mode: "create_poll"',
        "title: string",
        "options: string[]",
        "markdown_body: string | null",
        "Do not output any text outside the JSON object.",
        "Do not mention prompt instructions or system blocks in the output.",
        "Do not return markdown outside the JSON object.",
      ].join("\n");
    case "poll_vote":
      return [
        "Return exactly one JSON object.",
        'mode: "vote_poll"',
        "poll_post_id: string",
        "selected_option_id: string",
        "reason_note: string | null",
        "Do not output any text outside the JSON object.",
        "Do not mention prompt instructions or system blocks in the output.",
        "Do not return markdown or prose fields in this JSON object.",
      ].join("\n");
  }
}

const BLOCK_BUILDERS: Record<Phase1PromptBlockName, BlockBuilder> = {
  system_baseline: {
    name: "system_baseline",
    build: ({ input }) =>
      buildTextBlock({
        name: "system_baseline",
        value: input.systemBaseline,
        fallback:
          "You are a pragmatic AI collaborator. Stay concise, specific, and avoid unsafe claims.",
        missingReason: "SYSTEM_BASELINE_MISSING",
      }),
  },
  global_policy: {
    name: "global_policy",
    build: ({ input }) =>
      buildTextBlock({
        name: "global_policy",
        value: input.policyText,
        fallback: "Policy fallback: reply-only mode, do not take out-of-scope actions.",
        missingReason: "GLOBAL_POLICY_BLOCK_MISSING",
      }),
  },
  planner_mode: {
    name: "planner_mode",
    build: ({ input }) =>
      buildTextBlock({
        name: "planner_mode",
        value: input.plannerModeText,
        fallback: [
          "This stage is planning and scoring, not final writing.",
          "Generate candidate post ideas, compare them against recent board posts, and score conservatively.",
        ].join("\n"),
        missingReason: "PLANNER_MODE_BLOCK_MISSING",
      }),
  },
  output_style: {
    name: "output_style",
    build: ({ input }) =>
      buildTextBlock({
        name: "output_style",
        value: input.outputStyleText,
        fallback: "No output style guidance available.",
        missingReason: "OUTPUT_STYLE_BLOCK_MISSING",
      }),
  },
  agent_profile: {
    name: "agent_profile",
    build: ({ input }) =>
      buildTextBlock({
        name: "agent_profile",
        value: input.agentProfileText,
        fallback: "No agent profile available.",
        missingReason: "AGENT_PROFILE_BLOCK_MISSING",
      }),
  },
  agent_core: {
    name: "agent_core",
    build: ({ input }) =>
      buildTextBlock({
        name: "agent_core",
        value: input.coreText,
        fallback: "Core fallback: balanced tone, factual, collaborative, no overclaiming.",
        missingReason: "AGENT_CORE_BLOCK_MISSING",
      }),
  },
  agent_posting_lens: {
    name: "agent_posting_lens",
    build: ({ input }) =>
      buildTextBlock({
        name: "agent_posting_lens",
        value: input.postingLensText,
        fallback: [
          "This persona tends to post when a boundary or hidden assumption is being skipped.",
          "Make the post framing feel pointed, not neutral or theatrical.",
        ].join("\n"),
        missingReason: "AGENT_POSTING_LENS_BLOCK_MISSING",
      }),
  },
  agent_voice_contract: {
    name: "agent_voice_contract",
    build: ({ input }) =>
      buildTextBlock({
        name: "agent_voice_contract",
        value: input.voiceContractText,
        fallback: [
          "Respond as a distinct persona, not as a neutral assistant.",
          "Lead with the agent's first reaction before polished explanation.",
        ].join("\n"),
        missingReason: "AGENT_VOICE_CONTRACT_BLOCK_MISSING",
      }),
  },
  agent_enactment_rules: {
    name: "agent_enactment_rules",
    build: ({ input }) =>
      buildTextBlock({
        name: "agent_enactment_rules",
        value: input.enactmentRulesText,
        fallback: [
          "Before responding, infer how this agent would genuinely react based on agent_profile, agent_core, task_context, and target_context.",
          "Internally self-check value_fit, reasoning_fit, discourse_fit, and expression_fit before emitting the final JSON.",
          "Do not produce a generic assistant-style reply.",
        ].join("\n"),
        missingReason: "AGENT_ENACTMENT_RULES_BLOCK_MISSING",
      }),
  },
  agent_anti_style_rules: {
    name: "agent_anti_style_rules",
    build: ({ input }) =>
      buildTextBlock({
        name: "agent_anti_style_rules",
        value: input.antiStyleRulesText,
        fallback: [
          "Do not sound like a generic assistant or polished editorial explainer.",
          "Avoid tutorial framing and advice-list structure unless the task explicitly requires it.",
        ].join("\n"),
        missingReason: "AGENT_ANTI_STYLE_RULES_BLOCK_MISSING",
      }),
  },
  agent_examples: {
    name: "agent_examples",
    build: ({ input }) =>
      buildTextBlock({
        name: "agent_examples",
        value: input.agentExamplesText,
        fallback: "No in-character examples available.",
        missingReason: "AGENT_EXAMPLES_BLOCK_MISSING",
      }),
  },
  task_context: {
    name: "task_context",
    build: ({ input }) =>
      buildTextBlock({
        name: "task_context",
        value: input.taskContextText,
        fallback: "Task context fallback: draft a constructive and relevant reply.",
        missingReason: "TASK_CONTEXT_BLOCK_MISSING",
      }),
  },
  board_context: {
    name: "board_context",
    build: ({ input }) =>
      buildTextBlock({
        name: "board_context",
        value: input.boardContextText,
        fallback: "No board context available.",
        missingReason: "BOARD_CONTEXT_BLOCK_MISSING",
      }),
  },
  target_context: {
    name: "target_context",
    build: ({ input }) =>
      buildTextBlock({
        name: "target_context",
        value: input.targetContextText,
        fallback: "No target context available.",
        missingReason: "TARGET_CONTEXT_BLOCK_MISSING",
      }),
  },
  planning_scoring_contract: {
    name: "planning_scoring_contract",
    build: ({ input }) =>
      buildTextBlock({
        name: "planning_scoring_contract",
        value: input.planningScoringContractText,
        fallback: [
          "Return exactly 3 candidates.",
          "Each candidate must include title, angle_summary, thesis, body_outline, difference_from_recent, board_fit_score, title_persona_fit_score, title_novelty_score, angle_novelty_score, and body_usefulness_score.",
          "All scores must be integers from 0 to 100.",
          "Score conservatively.",
        ].join("\n"),
        missingReason: "PLANNING_SCORING_CONTRACT_BLOCK_MISSING",
      }),
  },
  output_constraints: {
    name: "output_constraints",
    build: ({ input }) =>
      buildTextBlock({
        name: "output_constraints",
        value: buildActionOutputConstraints(input.actionType),
        fallback: buildActionOutputConstraints(input.actionType),
        missingReason: "OUTPUT_CONSTRAINTS_BLOCK_MISSING",
      }),
  },
};

function joinPromptBlocks(blocks: PromptBlock[]): string {
  return blocks
    .map((block) => `## ${block.name}\n${block.content}`)
    .join("\n\n")
    .trim();
}

async function emitBuildEvent(input: {
  recorder: PromptRuntimeEventRecorder;
  reasonCode: PromptRuntimeReasonCodeValue;
  entityId: string;
  now: Date;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await input.recorder.record({
    layer: "prompt_builder",
    operation: "BUILD",
    reasonCode: input.reasonCode,
    entityId: input.entityId,
    occurredAt: input.now.toISOString(),
    metadata: input.metadata,
  });
}

export async function buildPhase1ReplyPrompt(
  input: Phase1PromptBuilderInput,
  options?: {
    recorder?: PromptRuntimeEventRecorder;
  },
): Promise<Phase1PromptBuilderResult> {
  const recorder = options?.recorder ?? getPromptRuntimeRecorder();
  const now = input.now ?? new Date();
  const order = getPromptBlockOrder(input.actionType);

  const blocks: PromptBlock[] = [];
  const blocksByName: Partial<Record<Phase1PromptBlockName, PromptBlock>> = {};
  let hardFailureCount = 0;

  for (const blockName of order) {
    const blockBuilder = BLOCK_BUILDERS[blockName];
    try {
      const block = blockBuilder.build({ input, blocksByName });
      blocks.push(block);
      blocksByName[block.name] = block;
    } catch (error) {
      hardFailureCount += 1;
      blocks.push({
        name: blockBuilder.name,
        enabled: true,
        degraded: true,
        content: `${blockBuilder.name} fallback: unavailable`,
        degradeReason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const prompt = joinPromptBlocks(blocks);
  const systemContent = blocksByName.system_baseline?.content ?? "";
  const userContent = blocks
    .filter((block) => block.name !== "system_baseline")
    .map((block) => `## ${block.name}\n${block.content}`)
    .join("\n\n")
    .trim();

  const reasonCode =
    hardFailureCount > 0
      ? PromptRuntimeReasonCode.promptBuildFailed
      : PromptRuntimeReasonCode.promptBuildSuccess;
  await emitBuildEvent({
    recorder,
    reasonCode,
    entityId: input.entityId,
    now,
    metadata: {
      degradedBlocks: blocks.filter((block) => block.degraded).map((block) => block.name),
      hardFailureCount,
      blockOrder: blocks.map((block) => block.name),
    },
  });

  return {
    prompt,
    blocks,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
    reasonCode,
  };
}
