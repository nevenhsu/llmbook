import { ProviderRuntimeReasonCode } from "@/lib/ai/reason-codes";
import { LlmProviderRegistry } from "@/lib/ai/llm/registry";
import type {
  InvokeLlmOutput,
  LlmErrorDetails,
  LlmGenerateTextInput,
  LlmGenerateTextOutput,
  LlmTaskType,
  LlmUsage,
  ProviderRoute,
} from "@/lib/ai/llm/types";
import {
  getPromptRuntimeRecorder,
  type PromptRuntimeEventRecorder,
} from "@/lib/ai/prompt-runtime/runtime-events";

function normalizeUsage(usage: LlmGenerateTextOutput["usage"] | undefined): LlmUsage {
  const inputTokens = Number.isFinite(usage?.inputTokens) ? Number(usage?.inputTokens) : 0;
  const outputTokens = Number.isFinite(usage?.outputTokens) ? Number(usage?.outputTokens) : 0;
  const totalTokensCandidate = Number.isFinite(usage?.totalTokens)
    ? Number(usage?.totalTokens)
    : inputTokens + outputTokens;
  const totalTokens = Math.max(totalTokensCandidate, inputTokens + outputTokens);
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    normalized:
      usage?.inputTokens === undefined ||
      usage?.outputTokens === undefined ||
      usage?.totalTokens === undefined,
  };
}

async function recordProviderEvent(input: {
  recorder: PromptRuntimeEventRecorder;
  entityId: string;
  reasonCode: (typeof ProviderRuntimeReasonCode)[keyof typeof ProviderRuntimeReasonCode];
  operation: "CALL" | "FALLBACK" | "RETRY";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await input.recorder.record({
    layer: "provider_runtime",
    operation: input.operation,
    reasonCode: input.reasonCode,
    entityId: input.entityId,
    occurredAt: new Date().toISOString(),
    metadata: input.metadata,
  });
}

async function recordProviderFailure(input: {
  recorder: PromptRuntimeEventRecorder;
  entityId: string;
  target: { providerId: string; modelId: string };
  attempts: number;
  error: string;
  errorDetails?: LlmErrorDetails;
  reasonCode?: (typeof ProviderRuntimeReasonCode)[keyof typeof ProviderRuntimeReasonCode];
}): Promise<void> {
  await recordProviderEvent({
    recorder: input.recorder,
    entityId: input.entityId,
    reasonCode: input.reasonCode ?? ProviderRuntimeReasonCode.providerCallFailed,
    operation: "CALL",
    metadata: {
      providerId: input.target.providerId,
      modelId: input.target.modelId,
      attempts: input.attempts,
      error: input.error,
      errorDetails: input.errorDetails,
    },
  });
}

async function recordProviderRetry(input: {
  recorder: PromptRuntimeEventRecorder;
  entityId: string;
  target: { providerId: string; modelId: string };
  nextAttempt: number;
}): Promise<void> {
  await recordProviderEvent({
    recorder: input.recorder,
    entityId: input.entityId,
    reasonCode: ProviderRuntimeReasonCode.providerRetrying,
    operation: "RETRY",
    metadata: {
      providerId: input.target.providerId,
      modelId: input.target.modelId,
      nextAttempt: input.nextAttempt,
    },
  });
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function normalizeErrorDetails(error: unknown): LlmErrorDetails | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const candidate = error as {
    statusCode?: unknown;
    code?: unknown;
    name?: unknown;
    responseBody?: unknown;
    body?: unknown;
    cause?: unknown;
  };
  const cause = (candidate.cause ?? null) as {
    statusCode?: unknown;
    code?: unknown;
    name?: unknown;
    responseBody?: unknown;
    body?: unknown;
  } | null;

  const details: LlmErrorDetails = {};
  const statusCode = candidate.statusCode ?? cause?.statusCode;
  const code = candidate.code ?? cause?.code;
  const type = candidate.name ?? cause?.name;
  const body = candidate.responseBody ?? candidate.body ?? cause?.responseBody ?? cause?.body;

  if (typeof statusCode === "number" && Number.isFinite(statusCode)) {
    details.statusCode = statusCode;
  }
  if (typeof code === "string" && code.trim().length > 0) {
    details.code = code.trim();
  }
  if (typeof type === "string" && type.trim().length > 0) {
    details.type = type.trim();
  }
  if (typeof body === "string" && body.trim().length > 0) {
    details.body = body.slice(0, 600);
  }
  return Object.keys(details).length > 0 ? details : undefined;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`LLM_TIMEOUT_${String(timeoutMs)}MS`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function runOnTarget(input: {
  registry: LlmProviderRegistry;
  target: { providerId: string; modelId: string };
  modelInput: Omit<LlmGenerateTextInput, "modelId">;
  timeoutMs: number;
  retries: number;
  entityId: string;
  recorder: PromptRuntimeEventRecorder;
  path: string[];
}): Promise<{
  output: LlmGenerateTextOutput | null;
  error: string | null;
  errorDetails?: LlmErrorDetails;
  attempts: number;
}> {
  let attempts = 0;
  let lastError: string | null = null;
  let lastErrorDetails: LlmErrorDetails | undefined;
  const provider = input.registry.getProvider(input.target.providerId);
  if (!provider) {
    return {
      output: null,
      error: `PROVIDER_NOT_FOUND:${input.target.providerId}`,
      attempts: 0,
      errorDetails: undefined,
    };
  }

  for (let index = 0; index <= input.retries; index += 1) {
    attempts += 1;
    try {
      const output = await withTimeout(
        provider.generateText({
          ...input.modelInput,
          modelId: input.target.modelId,
        }),
        input.timeoutMs,
      );

      if (output.error || output.finishReason === "error") {
        lastError = output.error ?? "PROVIDER_ERROR_OUTPUT";
        lastErrorDetails = output.errorDetails;
        await recordProviderFailure({
          recorder: input.recorder,
          entityId: input.entityId,
          target: input.target,
          attempts,
          error: lastError,
          errorDetails: output.errorDetails,
        });
        if (index < input.retries) {
          await recordProviderRetry({
            recorder: input.recorder,
            entityId: input.entityId,
            target: input.target,
            nextAttempt: attempts + 1,
          });
        }
        continue;
      }

      await recordProviderEvent({
        recorder: input.recorder,
        entityId: input.entityId,
        reasonCode: ProviderRuntimeReasonCode.providerCallSucceeded,
        operation: "CALL",
        metadata: {
          providerId: input.target.providerId,
          modelId: input.target.modelId,
          attempts,
        },
      });

      input.path.push(`${input.target.providerId}:${input.target.modelId}`);
      return { output, error: null, attempts };
    } catch (error) {
      const message = normalizeError(error);
      lastError = message;
      lastErrorDetails = normalizeErrorDetails(error);
      const reasonCode = message.startsWith("LLM_TIMEOUT_")
        ? ProviderRuntimeReasonCode.providerTimeout
        : ProviderRuntimeReasonCode.providerCallFailed;

      await recordProviderFailure({
        recorder: input.recorder,
        entityId: input.entityId,
        target: input.target,
        attempts,
        error: message,
        errorDetails: lastErrorDetails,
        reasonCode,
      });

      if (index < input.retries) {
        await recordProviderRetry({
          recorder: input.recorder,
          entityId: input.entityId,
          target: input.target,
          nextAttempt: attempts + 1,
        });
      }
    }
  }

  input.path.push(`${input.target.providerId}:${input.target.modelId}`);
  return {
    output: null,
    error: lastError,
    attempts,
    errorDetails: lastErrorDetails,
  };
}

export async function invokeLLM(input: {
  registry: LlmProviderRegistry;
  taskType?: LlmTaskType;
  routeOverride?: Partial<ProviderRoute>;
  modelInput: Omit<LlmGenerateTextInput, "modelId">;
  entityId: string;
  timeoutMs?: number;
  retries?: number;
  recorder?: PromptRuntimeEventRecorder;
}): Promise<InvokeLlmOutput> {
  const recorder = input.recorder ?? getPromptRuntimeRecorder();
  const taskType = input.taskType ?? "generic";
  const timeoutMs = Math.max(1, input.timeoutMs ?? 12_000);
  const retries = Math.max(0, input.retries ?? 1);
  const route = input.registry.resolveRoute(taskType, input.routeOverride);
  const path: string[] = [];

  const primary = await runOnTarget({
    registry: input.registry,
    target: route.primary,
    modelInput: input.modelInput,
    timeoutMs,
    retries,
    entityId: input.entityId,
    recorder,
    path,
  });

  if (primary.output) {
    const usage = normalizeUsage(primary.output.usage);
    if (usage.normalized) {
      await recordProviderEvent({
        recorder,
        entityId: input.entityId,
        reasonCode: ProviderRuntimeReasonCode.providerUsageNormalized,
        operation: "CALL",
        metadata: {
          providerId: route.primary.providerId,
          modelId: route.primary.modelId,
        },
      });
    }
    return {
      text: primary.output.text,
      finishReason: primary.output.finishReason ?? "stop",
      providerId: route.primary.providerId,
      modelId: route.primary.modelId,
      usage,
      error: primary.output.error,
      errorDetails: primary.output.errorDetails,
      toolCalls: primary.output.toolCalls,
      usedFallback: false,
      attempts: primary.attempts,
      path,
    };
  }

  if (route.secondary) {
    await recordProviderEvent({
      recorder,
      entityId: input.entityId,
      reasonCode: ProviderRuntimeReasonCode.providerFallbackUsed,
      operation: "FALLBACK",
      metadata: {
        taskType,
        from: route.primary,
        to: route.secondary,
        primaryError: primary.error,
        primaryErrorDetails: primary.errorDetails,
      },
    });

    const secondary = await runOnTarget({
      registry: input.registry,
      target: route.secondary,
      modelInput: input.modelInput,
      timeoutMs,
      retries,
      entityId: input.entityId,
      recorder,
      path,
    });

    if (secondary.output) {
      const usage = normalizeUsage(secondary.output.usage);
      if (usage.normalized) {
        await recordProviderEvent({
          recorder,
          entityId: input.entityId,
          reasonCode: ProviderRuntimeReasonCode.providerUsageNormalized,
          operation: "CALL",
          metadata: {
            providerId: route.secondary.providerId,
            modelId: route.secondary.modelId,
          },
        });
      }
      return {
        text: secondary.output.text,
        finishReason: secondary.output.finishReason ?? "stop",
        providerId: route.secondary.providerId,
        modelId: route.secondary.modelId,
        usage,
        error: secondary.output.error,
        errorDetails: secondary.output.errorDetails,
        toolCalls: secondary.output.toolCalls,
        usedFallback: true,
        attempts: primary.attempts + secondary.attempts,
        path,
      };
    }

    const fallbackError = secondary.error ?? primary.error ?? "PROVIDER_FALLBACK_FAILED";
    const fallbackErrorDetails = secondary.errorDetails ?? primary.errorDetails;
    await recordProviderEvent({
      recorder,
      entityId: input.entityId,
      reasonCode: ProviderRuntimeReasonCode.providerFailSafeReturned,
      operation: "FALLBACK",
      metadata: {
        error: fallbackError,
        errorDetails: fallbackErrorDetails,
        taskType,
      },
    });

    return {
      text: "",
      finishReason: "error",
      providerId: route.secondary.providerId,
      modelId: route.secondary.modelId,
      usage: normalizeUsage(undefined),
      error: fallbackError,
      errorDetails: fallbackErrorDetails,
      usedFallback: true,
      attempts: primary.attempts + secondary.attempts,
      path,
    };
  }

  const error = primary.error ?? "PROVIDER_CALL_FAILED";
  const errorDetails = primary.errorDetails;
  await recordProviderEvent({
    recorder,
    entityId: input.entityId,
    reasonCode: ProviderRuntimeReasonCode.providerFailSafeReturned,
    operation: "FALLBACK",
    metadata: {
      error,
      errorDetails,
      taskType,
    },
  });

  return {
    text: "",
    finishReason: "error",
    providerId: route.primary.providerId,
    modelId: route.primary.modelId,
    usage: normalizeUsage(undefined),
    error,
    errorDetails,
    usedFallback: false,
    attempts: primary.attempts,
    path,
  };
}
