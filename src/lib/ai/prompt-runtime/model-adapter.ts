import { PromptRuntimeReasonCode, ToolRuntimeReasonCode } from "@/lib/ai/reason-codes";
import { createDefaultLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import { LlmProviderRegistry } from "@/lib/ai/llm/registry";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { createMockProvider, type MockProviderMode } from "@/lib/ai/llm/providers/mock-provider";
import {
  CachedLlmRuntimeConfigProvider,
  type LlmRuntimeConfigProvider,
} from "@/lib/ai/llm/runtime-config-provider";
import type { PromptMessage } from "@/lib/ai/prompt-runtime/prompt-builder";
import type { PromptRuntimeEventRecorder } from "@/lib/ai/prompt-runtime/runtime-events";
import { getPromptRuntimeRecorder } from "@/lib/ai/prompt-runtime/runtime-events";
import type { ToolRegistry } from "@/lib/ai/prompt-runtime/tool-registry";

export type ModelFinishReason = "stop" | "length" | "content-filter" | "tool-calls" | "error";

export type ModelUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type ModelToolSchema = {
  name: string;
  description: string;
  schema: {
    type: "object";
    properties: Record<
      string,
      {
        type: "string" | "number" | "boolean";
        description?: string;
        enum?: string[];
      }
    >;
    required?: string[];
    additionalProperties?: boolean;
  };
};

export type ModelToolCall = {
  id?: string;
  name: string;
  arguments: unknown;
};

export type ModelToolResult = {
  id?: string;
  name: string;
  ok: boolean;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  validationError?: string;
};

export type ModelGenerateTextInput = {
  model?: string;
  prompt?: string;
  messages?: PromptMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  metadata?: Record<string, unknown>;
  tools?: ModelToolSchema[];
  toolResults?: ModelToolResult[];
};

export type ModelGenerateTextOutput = {
  text: string;
  finishReason?: ModelFinishReason;
  usage?: ModelUsage;
  provider?: string;
  model?: string;
  errorMessage?: string;
  toolCalls?: ModelToolCall[];
};

export interface ModelAdapter {
  generateText(input: ModelGenerateTextInput): Promise<ModelGenerateTextOutput>;
}

async function emitModelEvent(input: {
  recorder: PromptRuntimeEventRecorder;
  entityId: string;
  now: Date;
  reasonCode:
    | typeof PromptRuntimeReasonCode.modelCallFailed
    | typeof PromptRuntimeReasonCode.modelFallbackUsed
    | (typeof ToolRuntimeReasonCode)[keyof typeof ToolRuntimeReasonCode];
  operation: "CALL" | "FALLBACK" | "TOOL_CALL" | "TOOL_LOOP";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await input.recorder.record({
    layer:
      input.operation === "TOOL_CALL" || input.operation === "TOOL_LOOP"
        ? "tool_runtime"
        : "model_adapter",
    operation: input.operation,
    reasonCode: input.reasonCode,
    entityId: input.entityId,
    occurredAt: input.now.toISOString(),
    metadata: input.metadata,
  });
}

export class MockModelAdapter implements ModelAdapter {
  private provider = createMockProvider({
    mode: "success",
    modelId: "mock-success",
  });

  public constructor(options?: {
    mode?: MockProviderMode;
    fixedText?: string;
    scriptedOutputs?: ModelGenerateTextOutput[];
  }) {
    this.provider = createMockProvider({
      mode: options?.mode ?? "success",
      fixedText: options?.fixedText,
      modelId: "mock-success",
      scriptedOutputs: options?.scriptedOutputs?.map((item) => ({
        text: item.text,
        finishReason: item.finishReason,
        usage: item.usage,
        toolCalls: item.toolCalls,
        error: item.errorMessage,
      })),
    });
  }

  public async generateText(input: ModelGenerateTextInput): Promise<ModelGenerateTextOutput> {
    const result = await this.provider.generateText({
      modelId: input.model ?? "mock-success",
      prompt: input.prompt,
      messages: input.messages,
      maxOutputTokens: input.maxOutputTokens,
      temperature: input.temperature,
      metadata: input.metadata,
      tools: input.tools,
      toolResults: input.toolResults,
    });
    return {
      text: result.text,
      finishReason: result.finishReason ?? "stop",
      usage: result.usage,
      provider: "mock",
      model: input.model ?? "mock-success",
      errorMessage: result.error,
      toolCalls: result.toolCalls,
    };
  }
}

type LlmRuntimeAdapterOptions = {
  provider?: string;
  model?: string;
  fallbackProvider?: string;
  fallbackModel?: string;
  enabled?: boolean;
  timeoutMs?: number;
  retries?: number;
  registry?: LlmProviderRegistry;
  configProvider?: LlmRuntimeConfigProvider;
  recorder?: PromptRuntimeEventRecorder;
};

type EnvConfig = {
  provider: string;
  model: string;
  timeoutMs: number;
  retries: number;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function readEnvConfig(): EnvConfig {
  const provider = (process.env.AI_MODEL_PROVIDER ?? "xai").trim().toLowerCase();
  const model = (process.env.AI_MODEL_NAME ?? "grok-4-1-fast-reasoning").trim();
  const timeoutMs = parsePositiveInt(process.env.AI_MODEL_TIMEOUT_MS, 12_000);
  const retries = parseNonNegativeInt(process.env.AI_MODEL_RETRIES, 1);
  return { provider, model, timeoutMs, retries };
}

export class LlmRuntimeAdapter implements ModelAdapter {
  private readonly provider: string;
  private readonly model: string;
  private readonly fallbackProvider: string | null;
  private readonly fallbackModel: string | null;
  private readonly enabled: boolean;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly registry: LlmProviderRegistry;
  private readonly configProvider: LlmRuntimeConfigProvider;
  private readonly recorder: PromptRuntimeEventRecorder;

  public constructor(options?: LlmRuntimeAdapterOptions) {
    const env = readEnvConfig();
    this.provider = options?.provider ?? env.provider;
    this.model = options?.model ?? env.model;
    this.fallbackProvider =
      options?.fallbackProvider ?? process.env.AI_MODEL_FALLBACK_PROVIDER ?? null;
    this.fallbackModel = options?.fallbackModel ?? process.env.AI_MODEL_FALLBACK_NAME ?? null;
    this.enabled = options?.enabled ?? true;
    this.timeoutMs = Math.max(1, options?.timeoutMs ?? env.timeoutMs);
    this.retries = Math.max(0, options?.retries ?? env.retries);
    this.registry = options?.registry ?? createDefaultLlmProviderRegistry();
    this.configProvider = options?.configProvider ?? new CachedLlmRuntimeConfigProvider();
    this.recorder = options?.recorder ?? getPromptRuntimeRecorder();
  }

  public async generateText(input: ModelGenerateTextInput): Promise<ModelGenerateTextOutput> {
    const now = new Date();
    const entityId =
      typeof input.metadata?.entityId === "string" ? String(input.metadata.entityId) : "unknown";

    try {
      const taskTypeRaw = input.metadata?.taskType;
      const taskType =
        taskTypeRaw === "reply" || taskTypeRaw === "vote" || taskTypeRaw === "dispatch"
          ? taskTypeRaw
          : "generic";
      const runtimeConfig = await this.configProvider.getConfig(taskType);
      const routePrimary = runtimeConfig?.route?.primary ?? {
        providerId: this.provider,
        modelId: input.model ?? this.model,
      };
      const routeSecondary = runtimeConfig?.route?.secondary ?? {
        providerId: this.fallbackProvider ?? "",
        modelId: this.fallbackModel ?? "",
      };
      const enabled = runtimeConfig?.enabled ?? this.enabled;
      if (!enabled) {
        await emitModelEvent({
          recorder: this.recorder,
          entityId,
          now,
          reasonCode: PromptRuntimeReasonCode.modelCallFailed,
          operation: "CALL",
          metadata: {
            reason: "MODEL_DISABLED",
            provider: routePrimary.providerId,
            model: routePrimary.modelId,
          },
        });
        return {
          text: "",
          finishReason: "error",
          provider: routePrimary.providerId,
          model: routePrimary.modelId,
          errorMessage: "MODEL_DISABLED",
        };
      }

      const result = await invokeLLM({
        registry: this.registry,
        taskType,
        entityId,
        timeoutMs: Math.max(1, runtimeConfig?.timeoutMs ?? this.timeoutMs),
        retries: Math.max(0, runtimeConfig?.retries ?? this.retries),
        recorder: this.recorder,
        routeOverride: {
          primary: routePrimary,
          secondary:
            routeSecondary.providerId.trim().length > 0 && routeSecondary.modelId.trim().length > 0
              ? routeSecondary
              : undefined,
        },
        modelInput: {
          prompt: input.prompt,
          messages: input.messages,
          maxOutputTokens: input.maxOutputTokens,
          temperature: input.temperature,
          metadata: input.metadata,
          tools: input.tools,
          toolResults: input.toolResults,
        },
      });
      return {
        text: result.text,
        finishReason: result.finishReason,
        usage: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
        },
        provider: result.providerId ?? routePrimary.providerId,
        model: result.modelId ?? routePrimary.modelId,
        errorMessage: result.error,
        toolCalls: result.toolCalls,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await emitModelEvent({
        recorder: this.recorder,
        entityId,
        now: new Date(),
        reasonCode: PromptRuntimeReasonCode.modelCallFailed,
        operation: "CALL",
        metadata: {
          reason: "MODEL_EXCEPTION",
          error: message,
          provider: this.provider,
          model: this.model,
        },
      });
      return {
        text: "",
        finishReason: "error",
        provider: this.provider,
        model: input.model ?? this.model,
        errorMessage: message,
      };
    }
  }
}

export type ToolLoopResult = {
  output: ModelGenerateTextOutput;
  iterations: number;
  timedOut: boolean;
  hitMaxIterations: boolean;
  toolResults: ModelToolResult[];
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`tool loop timeout after ${String(timeoutMs)}ms`));
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

function inferToolFailureReason(
  toolResult: ModelToolResult,
): (typeof ToolRuntimeReasonCode)[keyof typeof ToolRuntimeReasonCode] | null {
  if (toolResult.validationError) {
    return ToolRuntimeReasonCode.toolValidationFailed;
  }
  if (toolResult.error?.startsWith("tool not allowed")) {
    return ToolRuntimeReasonCode.toolNotAllowed;
  }
  if (toolResult.error?.startsWith("tool not found")) {
    return ToolRuntimeReasonCode.toolNotFound;
  }
  if (toolResult.error) {
    return ToolRuntimeReasonCode.toolHandlerFailed;
  }
  return null;
}

async function emitToolEvent(input: {
  recorder: PromptRuntimeEventRecorder;
  entityId: string;
  reasonCode: (typeof ToolRuntimeReasonCode)[keyof typeof ToolRuntimeReasonCode];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await emitModelEvent({
    recorder: input.recorder,
    entityId: input.entityId,
    now: new Date(),
    reasonCode: input.reasonCode,
    operation:
      input.reasonCode === ToolRuntimeReasonCode.toolLoopMaxIterations ||
      input.reasonCode === ToolRuntimeReasonCode.toolLoopTimeout
        ? "TOOL_LOOP"
        : "TOOL_CALL",
    metadata: input.metadata,
  });
}

export async function generateTextWithToolLoop(input: {
  adapter: ModelAdapter;
  modelInput: ModelGenerateTextInput;
  registry: ToolRegistry;
  entityId: string;
  allowlist?: string[];
  maxIterations?: number;
  timeoutMs?: number;
  recorder?: PromptRuntimeEventRecorder;
}): Promise<ToolLoopResult> {
  const recorder = input.recorder ?? getPromptRuntimeRecorder();
  const maxIterations = Math.max(1, input.maxIterations ?? 3);
  const timeoutMs = Math.max(1, input.timeoutMs ?? 2_500);
  const start = Date.now();

  const availableTools = input.registry.listForModel(input.allowlist);
  const toolResults: ModelToolResult[] = [];

  const loop = async (): Promise<ToolLoopResult> => {
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations += 1;
      const output = await input.adapter.generateText({
        ...input.modelInput,
        tools: availableTools,
        toolResults,
        metadata: {
          ...(input.modelInput.metadata ?? {}),
          entityId: input.entityId,
          toolLoopIteration: iterations,
        },
      });

      const toolCalls = output.toolCalls ?? [];
      if (toolCalls.length === 0) {
        return {
          output,
          iterations,
          timedOut: false,
          hitMaxIterations: false,
          toolResults,
        };
      }

      for (const toolCall of toolCalls) {
        const exec = await input.registry.execute({
          name: toolCall.name,
          args: toolCall.arguments,
          context: {
            entityId: input.entityId,
            occurredAt: new Date().toISOString(),
            metadata: {
              iteration: iterations,
              toolCallId: toolCall.id,
            },
          },
          allowlist: input.allowlist,
        });

        const toolResult: ModelToolResult = {
          id: toolCall.id,
          name: exec.name,
          ok: exec.ok,
          arguments: exec.args,
          result: exec.result,
          error: exec.error,
          validationError: exec.validationError,
        };
        toolResults.push(toolResult);

        if (toolResult.ok) {
          await emitToolEvent({
            recorder,
            entityId: input.entityId,
            reasonCode: ToolRuntimeReasonCode.toolCallSucceeded,
            metadata: {
              toolName: toolResult.name,
              iteration: iterations,
              durationMs: Date.now() - start,
            },
          });
        } else {
          const reasonCode = inferToolFailureReason(toolResult);
          if (reasonCode) {
            await emitToolEvent({
              recorder,
              entityId: input.entityId,
              reasonCode,
              metadata: {
                toolName: toolResult.name,
                iteration: iterations,
                error: toolResult.validationError ?? toolResult.error,
              },
            });
          }
        }
      }
    }

    await emitToolEvent({
      recorder,
      entityId: input.entityId,
      reasonCode: ToolRuntimeReasonCode.toolLoopMaxIterations,
      metadata: {
        iterations: maxIterations,
        timeoutMs,
      },
    });

    return {
      output: {
        text: "",
        finishReason: "error",
        provider: undefined,
        model: input.modelInput.model,
        errorMessage: ToolRuntimeReasonCode.toolLoopMaxIterations,
      },
      iterations: maxIterations,
      timedOut: false,
      hitMaxIterations: true,
      toolResults,
    };
  };

  try {
    return await withTimeout(loop(), timeoutMs);
  } catch {
    await emitToolEvent({
      recorder,
      entityId: input.entityId,
      reasonCode: ToolRuntimeReasonCode.toolLoopTimeout,
      metadata: {
        timeoutMs,
        iterations: maxIterations,
      },
    });
    return {
      output: {
        text: "",
        finishReason: "error",
        provider: undefined,
        model: input.modelInput.model,
        errorMessage: ToolRuntimeReasonCode.toolLoopTimeout,
      },
      iterations: maxIterations,
      timedOut: true,
      hitMaxIterations: false,
      toolResults,
    };
  }
}

export async function recordModelFallbackUsed(input: {
  entityId: string;
  reason: string;
  metadata?: Record<string, unknown>;
  now?: Date;
  recorder?: PromptRuntimeEventRecorder;
}): Promise<void> {
  const recorder = input.recorder ?? getPromptRuntimeRecorder();
  await emitModelEvent({
    recorder,
    entityId: input.entityId,
    now: input.now ?? new Date(),
    reasonCode: PromptRuntimeReasonCode.modelFallbackUsed,
    operation: "FALLBACK",
    metadata: {
      reason: input.reason,
      ...(input.metadata ?? {}),
    },
  });
}
