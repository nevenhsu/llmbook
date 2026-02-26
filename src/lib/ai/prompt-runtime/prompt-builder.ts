import { PromptRuntimeReasonCode } from "@/lib/ai/reason-codes";
import type {
  PromptRuntimeEventRecorder,
  PromptRuntimeReasonCodeValue,
} from "@/lib/ai/prompt-runtime/runtime-events";
import { getPromptRuntimeRecorder } from "@/lib/ai/prompt-runtime/runtime-events";

export const PHASE1_REPLY_PROMPT_BLOCK_ORDER = [
  "system_baseline",
  "policy",
  "soul",
  "memory",
  "task_context",
  "output_constraints",
] as const;

export type Phase1ReplyPromptBlockName = (typeof PHASE1_REPLY_PROMPT_BLOCK_ORDER)[number];

export type PromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type PromptBlock = {
  name: Phase1ReplyPromptBlockName;
  enabled: boolean;
  degraded: boolean;
  content: string;
  degradeReason?: string;
};

export type Phase1PromptBuilderInput = {
  entityId: string;
  systemBaseline?: string;
  policyText?: string;
  soulText?: string;
  memoryText?: string;
  taskContextText: string;
  outputConstraintsText?: string;
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
  blocksByName: Partial<Record<Phase1ReplyPromptBlockName, PromptBlock>>;
};

type BlockBuilder = {
  name: Phase1ReplyPromptBlockName;
  build: (context: BuildBlockContext) => PromptBlock;
};

function normalizeContent(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function buildTextBlock(input: {
  name: Phase1ReplyPromptBlockName;
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

const BLOCK_BUILDERS: BlockBuilder[] = [
  {
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
  {
    name: "policy",
    build: ({ input }) =>
      buildTextBlock({
        name: "policy",
        value: input.policyText,
        fallback: "Policy fallback: reply-only mode, do not take out-of-scope actions.",
        missingReason: "POLICY_BLOCK_MISSING",
      }),
  },
  {
    name: "soul",
    build: ({ input }) =>
      buildTextBlock({
        name: "soul",
        value: input.soulText,
        fallback: "Soul fallback: balanced tone, factual, collaborative, no overclaiming.",
        missingReason: "SOUL_BLOCK_MISSING",
      }),
  },
  {
    name: "memory",
    build: ({ input }) =>
      buildTextBlock({
        name: "memory",
        value: input.memoryText,
        fallback: "Memory fallback: no durable memory available for this thread.",
        missingReason: "MEMORY_BLOCK_MISSING",
      }),
  },
  {
    name: "task_context",
    build: ({ input }) =>
      buildTextBlock({
        name: "task_context",
        value: input.taskContextText,
        fallback: "Task context fallback: draft a constructive and relevant reply.",
        missingReason: "TASK_CONTEXT_BLOCK_MISSING",
      }),
  },
  {
    name: "output_constraints",
    build: ({ input }) =>
      buildTextBlock({
        name: "output_constraints",
        value: input.outputConstraintsText,
        fallback:
          "Output constraints: return only final markdown reply text; no JSON, no XML, no extra labels.",
        missingReason: "OUTPUT_CONSTRAINTS_BLOCK_MISSING",
      }),
  },
];

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

  const blocks: PromptBlock[] = [];
  const blocksByName: Partial<Record<Phase1ReplyPromptBlockName, PromptBlock>> = {};
  let hardFailureCount = 0;

  for (const blockBuilder of BLOCK_BUILDERS) {
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
