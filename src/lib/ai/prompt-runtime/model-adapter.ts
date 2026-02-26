import { PromptRuntimeReasonCode, ToolRuntimeReasonCode } from "@/lib/ai/reason-codes";
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

export type MockModelMode = "success" | "empty" | "throw";

export class MockModelAdapter implements ModelAdapter {
  private readonly mode: MockModelMode;
  private readonly fixedText?: string;
  private readonly scriptedOutputs: ModelGenerateTextOutput[];

  public constructor(options?: {
    mode?: MockModelMode;
    fixedText?: string;
    scriptedOutputs?: ModelGenerateTextOutput[];
  }) {
    this.mode = options?.mode ?? "success";
    this.fixedText = options?.fixedText;
    this.scriptedOutputs = [...(options?.scriptedOutputs ?? [])];
  }

  public async generateText(input: ModelGenerateTextInput): Promise<ModelGenerateTextOutput> {
    if (this.scriptedOutputs.length > 0) {
      const next = this.scriptedOutputs.shift();
      if (next) {
        return {
          provider: next.provider ?? "mock",
          model: next.model ?? input.model ?? "mock-scripted",
          finishReason: next.finishReason ?? "stop",
          usage: next.usage,
          text: next.text,
          errorMessage: next.errorMessage,
          toolCalls: next.toolCalls,
        };
      }
    }

    if (this.mode === "throw") {
      throw new Error("MockModelAdapter configured to throw");
    }

    if (this.mode === "empty") {
      return {
        text: "",
        finishReason: "stop",
        usage: {
          inputTokens: 8,
          outputTokens: 0,
          totalTokens: 8,
        },
        provider: "mock",
        model: input.model ?? "mock-empty",
      };
    }

    return {
      text: this.fixedText ?? "Mock adapter response",
      finishReason: "stop",
      usage: {
        inputTokens: 12,
        outputTokens: 6,
        totalTokens: 18,
      },
      provider: "mock",
      model: input.model ?? "mock-success",
    };
  }
}

type VercelAiCoreAdapterOptions = {
  provider?: string;
  model?: string;
  enabled?: boolean;
  recorder?: PromptRuntimeEventRecorder;
  generateTextImpl?: (input: ModelGenerateTextInput) => Promise<ModelGenerateTextOutput>;
};

type EnvConfig = {
  enabled: boolean;
  provider: string;
  model: string;
  apiKey: string | null;
};

function readEnvConfig(): EnvConfig {
  const enabledRaw = (process.env.AI_MODEL_ENABLED ?? "").toLowerCase();
  const enabled = enabledRaw === "1" || enabledRaw === "true";
  const provider = (process.env.AI_MODEL_PROVIDER ?? "grok").trim().toLowerCase();
  const model = (process.env.AI_MODEL_NAME ?? "grok-2-latest").trim();
  const apiKey = process.env.GROK_API_KEY ?? process.env.XAI_API_KEY ?? null;
  return { enabled, provider, model, apiKey };
}

function normalizeTextOutput(text: unknown): string {
  if (typeof text !== "string") {
    return "";
  }
  return text.replace(/\r\n/g, "\n").trim();
}

async function callXaiResponsesApi(input: {
  apiKey: string;
  model: string;
  prompt: string;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<ModelGenerateTextOutput> {
  const response = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      input: input.prompt,
      max_output_tokens: input.maxOutputTokens,
      temperature: input.temperature,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`xAI response error (${response.status}): ${payload}`);
  }

  const payload = (await response.json()) as {
    output_text?: unknown;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
    };
    status?: string;
  };

  return {
    text: normalizeTextOutput(payload.output_text),
    finishReason: payload.status === "completed" ? "stop" : "error",
    usage: {
      inputTokens: payload.usage?.input_tokens,
      outputTokens: payload.usage?.output_tokens,
      totalTokens: payload.usage?.total_tokens,
    },
    provider: "grok",
    model: input.model,
  };
}

export class VercelAiCoreAdapter implements ModelAdapter {
  private readonly provider: string;
  private readonly model: string;
  private readonly enabled: boolean;
  private readonly apiKey: string | null;
  private readonly recorder: PromptRuntimeEventRecorder;
  private readonly generateTextImpl?: (
    input: ModelGenerateTextInput,
  ) => Promise<ModelGenerateTextOutput>;

  public constructor(options?: VercelAiCoreAdapterOptions) {
    const env = readEnvConfig();
    this.provider = options?.provider ?? env.provider;
    this.model = options?.model ?? env.model;
    this.enabled = options?.enabled ?? env.enabled;
    this.apiKey = env.apiKey;
    this.recorder = options?.recorder ?? getPromptRuntimeRecorder();
    this.generateTextImpl = options?.generateTextImpl;
  }

  public async generateText(input: ModelGenerateTextInput): Promise<ModelGenerateTextOutput> {
    const now = new Date();
    const entityId =
      typeof input.metadata?.entityId === "string" ? String(input.metadata.entityId) : "unknown";

    if (!this.enabled) {
      await emitModelEvent({
        recorder: this.recorder,
        entityId,
        now,
        reasonCode: PromptRuntimeReasonCode.modelCallFailed,
        operation: "CALL",
        metadata: {
          reason: "MODEL_DISABLED",
          provider: this.provider,
          model: this.model,
        },
      });
      return {
        text: "",
        finishReason: "error",
        provider: this.provider,
        model: this.model,
        errorMessage: "MODEL_DISABLED",
      };
    }

    if (this.generateTextImpl) {
      try {
        return await this.generateTextImpl({
          ...input,
          model: input.model ?? this.model,
        });
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

    if (this.provider === "grok" && !this.apiKey) {
      await emitModelEvent({
        recorder: this.recorder,
        entityId,
        now,
        reasonCode: PromptRuntimeReasonCode.modelCallFailed,
        operation: "CALL",
        metadata: {
          reason: "MISSING_GROK_API_KEY",
          provider: this.provider,
          model: this.model,
        },
      });
      return {
        text: "",
        finishReason: "error",
        provider: this.provider,
        model: this.model,
        errorMessage: "MISSING_GROK_API_KEY",
      };
    }

    try {
      const prompt =
        typeof input.prompt === "string" && input.prompt.trim().length > 0
          ? input.prompt
          : (input.messages
              ?.map((message) => `[${message.role}] ${message.content}`)
              .join("\n\n") ?? "");

      if (!prompt) {
        return {
          text: "",
          finishReason: "error",
          provider: this.provider,
          model: input.model ?? this.model,
          errorMessage: "EMPTY_PROMPT",
        };
      }

      if (this.provider === "grok" && this.apiKey) {
        return await callXaiResponsesApi({
          apiKey: this.apiKey,
          model: input.model ?? this.model,
          prompt,
          maxOutputTokens: input.maxOutputTokens,
          temperature: input.temperature,
        });
      }

      return {
        text: "",
        finishReason: "error",
        provider: this.provider,
        model: input.model ?? this.model,
        errorMessage: "UNSUPPORTED_PROVIDER",
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
