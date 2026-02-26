import { loadDispatcherPolicy } from "@/agents/task-dispatcher/policy/reply-only-policy";
import { createReplyPhase1ToolRegistry } from "@/agents/phase-1-reply-vote/orchestrator/reply-phase1-tools";
import type { RuntimeMemoryContext } from "@/lib/ai/memory/runtime-memory-context";
import { buildPhase1ReplyPrompt, type PromptBlock } from "@/lib/ai/prompt-runtime/prompt-builder";
import type { ModelAdapter } from "@/lib/ai/prompt-runtime/model-adapter";
import {
  VercelAiCoreAdapter,
  generateTextWithToolLoop,
  recordModelFallbackUsed,
  type ModelGenerateTextOutput,
} from "@/lib/ai/prompt-runtime/model-adapter";
import type { RuntimeSoulContext } from "@/lib/ai/soul/runtime-soul-profile";

export type ReplyPromptRuntimeInput = {
  entityId: string;
  personaId: string;
  postId: string;
  title: string;
  postBodySnippet: string;
  focusActor: string;
  focusSnippet: string | null;
  participantCount: number;
  soul: RuntimeSoulContext;
  memoryContext: RuntimeMemoryContext | null;
  deterministicFallbackText: string;
  modelAdapter?: ModelAdapter;
  now?: Date;
};

export type ReplyPromptRuntimeResult = {
  text: string;
  usedFallback: boolean;
  fallbackReason: string | null;
  promptBlocks: PromptBlock[];
  model: {
    provider: string | null;
    model: string | null;
    finishReason: string | null;
    usage: ModelGenerateTextOutput["usage"] | undefined;
  };
};

function readToolEnabled(): boolean {
  const raw = (process.env.AI_TOOL_RUNTIME_ENABLED ?? "true").trim().toLowerCase();
  return raw !== "0" && raw !== "false";
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function readAllowlist(): string[] {
  const raw = (process.env.AI_TOOL_ALLOWLIST ?? "").trim();
  if (!raw) {
    return ["get_thread_context", "get_persona_memory", "get_global_policy", "create_reply"];
  }
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function formatSoulBlock(soul: RuntimeSoulContext): string {
  return [
    `Identity: ${soul.summary.identity}`,
    `Top values: ${soul.summary.topValues.join(", ") || "n/a"}`,
    `Tradeoff style: ${soul.summary.tradeoffStyle}`,
    `Risk preference: ${soul.summary.riskPreference}`,
    `Collaboration stance: ${soul.summary.collaborationStance}`,
    `Language rhythm: ${soul.summary.rhythm}`,
    `Guardrail count: ${String(soul.summary.guardrailCount)}`,
  ].join("\n");
}

function formatMemoryBlock(memoryContext: RuntimeMemoryContext | null): string | undefined {
  if (!memoryContext) {
    return undefined;
  }

  const threadEntries = memoryContext.threadShortMemory.entries
    .slice(0, 8)
    .map((entry) => `- ${entry.key}: ${entry.value.slice(0, 160)}`);
  const longMemory =
    memoryContext.personaLongMemory?.content.slice(0, 240) ?? "No persona long memory available.";

  return [
    `Policy version: ${memoryContext.policyRefs.policyVersion ?? "none"}`,
    `Memory refs: community=${memoryContext.memoryRefs.communityMemoryVersion ?? "none"}, safety=${
      memoryContext.memoryRefs.safetyMemoryVersion ?? "none"
    }`,
    `Persona long memory: ${longMemory}`,
    `Thread short memory entries (${String(threadEntries.length)}):`,
    ...(threadEntries.length > 0 ? threadEntries : ["- none"]),
  ].join("\n");
}

function formatPolicyBlock(): string {
  const policy = loadDispatcherPolicy();
  return [
    "Phase1 policy:",
    `- replyEnabled: ${String(policy.replyEnabled)}`,
    `- precheckEnabled: ${String(policy.precheckEnabled)}`,
    `- hourlyLimit: ${String(policy.perPersonaHourlyReplyLimit)}`,
    `- postCooldownSeconds: ${String(policy.perPostCooldownSeconds)}`,
    `- precheckSimilarityThreshold: ${String(policy.precheckSimilarityThreshold)}`,
    "- respect safety/review gates, no policy bypass",
  ].join("\n");
}

function formatTaskContext(input: ReplyPromptRuntimeInput): string {
  return [
    `Task: generate a single markdown reply for post ${input.postId} by persona ${input.personaId}.`,
    `Post title: ${input.title}`,
    `Post snippet: ${input.postBodySnippet || "(empty)"}`,
    input.focusSnippet
      ? `Focus comment by ${input.focusActor}: "${input.focusSnippet}"`
      : `No focus comment. Use post context from ${input.focusActor}.`,
    `Participants in thread: ${String(input.participantCount)}`,
  ].join("\n");
}

function formatOutputConstraints(): string {
  return [
    "Output only final markdown reply.",
    "No JSON, no XML, no role tags.",
    "Keep it practical and bounded in scope.",
  ].join("\n");
}

function postProcessModelText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function generateReplyTextWithPromptRuntime(
  input: ReplyPromptRuntimeInput,
): Promise<ReplyPromptRuntimeResult> {
  const now = input.now ?? new Date();
  const modelAdapter = input.modelAdapter ?? new VercelAiCoreAdapter();

  const prompt = await buildPhase1ReplyPrompt({
    entityId: input.entityId,
    now,
    systemBaseline:
      "You are a phase1 reply agent. Be accurate, concise, and constructive. Keep language natural.",
    policyText: formatPolicyBlock(),
    soulText: formatSoulBlock(input.soul),
    memoryText: formatMemoryBlock(input.memoryContext),
    taskContextText: formatTaskContext(input),
    outputConstraintsText: formatOutputConstraints(),
  });

  const toolEnabled = readToolEnabled();
  const allowlist = readAllowlist();
  const maxIterations = readPositiveInt(process.env.AI_TOOL_LOOP_MAX_ITERATIONS, 3);
  const timeoutMs = readPositiveInt(process.env.AI_TOOL_LOOP_TIMEOUT_MS, 2_500);

  let modelResult: ModelGenerateTextOutput;
  try {
    if (!toolEnabled) {
      modelResult = await modelAdapter.generateText({
        model: process.env.AI_MODEL_NAME ?? "grok-2-latest",
        prompt: prompt.prompt,
        messages: prompt.messages,
        maxOutputTokens: 320,
        temperature: 0.4,
        metadata: {
          entityId: input.entityId,
          personaId: input.personaId,
          postId: input.postId,
          promptBlockOrder: prompt.blocks.map((block) => block.name),
          toolRuntimeEnabled: false,
        },
      });
    } else {
      const toolRegistry = createReplyPhase1ToolRegistry({
        context: {
          postId: input.postId,
          personaId: input.personaId,
          title: input.title,
          postBodySnippet: input.postBodySnippet,
          focusActor: input.focusActor,
          focusSnippet: input.focusSnippet,
          participantCount: input.participantCount,
          memoryContext: input.memoryContext,
        },
        allowlist,
      });

      const toolLoop = await generateTextWithToolLoop({
        adapter: modelAdapter,
        modelInput: {
          model: process.env.AI_MODEL_NAME ?? "grok-2-latest",
          prompt: prompt.prompt,
          messages: prompt.messages,
          maxOutputTokens: 320,
          temperature: 0.4,
          metadata: {
            entityId: input.entityId,
            personaId: input.personaId,
            postId: input.postId,
            promptBlockOrder: prompt.blocks.map((block) => block.name),
            toolRuntimeEnabled: true,
          },
        },
        registry: toolRegistry,
        entityId: input.entityId,
        allowlist,
        maxIterations,
        timeoutMs,
      });

      modelResult = toolLoop.output;
    }
  } catch (error) {
    modelResult = {
      text: "",
      finishReason: "error",
      provider: "unknown",
      model: process.env.AI_MODEL_NAME ?? "grok-2-latest",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  const normalizedModelText = postProcessModelText(modelResult.text);
  if (normalizedModelText.length > 0) {
    return {
      text: normalizedModelText,
      usedFallback: false,
      fallbackReason: null,
      promptBlocks: prompt.blocks,
      model: {
        provider: modelResult.provider ?? null,
        model: modelResult.model ?? null,
        finishReason: modelResult.finishReason ?? null,
        usage: modelResult.usage,
      },
    };
  }

  const fallbackReason = modelResult.errorMessage?.trim() || "EMPTY_MODEL_OUTPUT";
  await recordModelFallbackUsed({
    entityId: input.entityId,
    reason: fallbackReason,
    now,
    metadata: {
      provider: modelResult.provider ?? null,
      model: modelResult.model ?? null,
    },
  });

  return {
    text: input.deterministicFallbackText,
    usedFallback: true,
    fallbackReason,
    promptBlocks: prompt.blocks,
    model: {
      provider: modelResult.provider ?? null,
      model: modelResult.model ?? null,
      finishReason: modelResult.finishReason ?? null,
      usage: modelResult.usage,
    },
  };
}
