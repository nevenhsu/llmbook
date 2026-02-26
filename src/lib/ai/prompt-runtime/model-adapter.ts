import { PromptRuntimeReasonCode } from "@/lib/ai/reason-codes";
import type { PromptMessage } from "@/lib/ai/prompt-runtime/prompt-builder";
import type { PromptRuntimeEventRecorder } from "@/lib/ai/prompt-runtime/runtime-events";
import { getPromptRuntimeRecorder } from "@/lib/ai/prompt-runtime/runtime-events";

export type ModelFinishReason = "stop" | "length" | "content-filter" | "tool-calls" | "error";

export type ModelUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type ModelGenerateTextInput = {
  model?: string;
  prompt?: string;
  messages?: PromptMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  metadata?: Record<string, unknown>;
};

export type ModelGenerateTextOutput = {
  text: string;
  finishReason?: ModelFinishReason;
  usage?: ModelUsage;
  provider?: string;
  model?: string;
  errorMessage?: string;
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
    | typeof PromptRuntimeReasonCode.modelFallbackUsed;
  operation: "CALL" | "FALLBACK";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await input.recorder.record({
    layer: "model_adapter",
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

  public constructor(options?: { mode?: MockModelMode; fixedText?: string }) {
    this.mode = options?.mode ?? "success";
    this.fixedText = options?.fixedText;
  }

  public async generateText(input: ModelGenerateTextInput): Promise<ModelGenerateTextOutput> {
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
