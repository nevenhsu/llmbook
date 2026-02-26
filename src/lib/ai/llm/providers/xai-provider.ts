import { generateText } from "ai";
import { createXai } from "@ai-sdk/xai";
import type {
  LlmErrorDetails,
  LlmGenerateTextInput,
  LlmGenerateTextOutput,
  LlmProvider,
} from "@/lib/ai/llm/types";

function normalizeTextOutput(text: unknown): string {
  if (typeof text !== "string") {
    return "";
  }
  return text.replace(/\r\n/g, "\n").trim();
}

function stringifyBody(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.slice(0, 600);
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }
  try {
    return JSON.stringify(value).slice(0, 600);
  } catch {
    return undefined;
  }
}

function extractErrorDetails(error: unknown): LlmErrorDetails {
  const candidate = error as {
    statusCode?: unknown;
    code?: unknown;
    name?: unknown;
    responseBody?: unknown;
    body?: unknown;
    cause?: unknown;
  };

  const cause = (candidate?.cause ?? null) as {
    statusCode?: unknown;
    code?: unknown;
    name?: unknown;
    responseBody?: unknown;
    body?: unknown;
  } | null;

  const statusCodeSource = candidate?.statusCode ?? cause?.statusCode;
  const codeSource = candidate?.code ?? cause?.code;
  const typeSource = candidate?.name ?? cause?.name;
  const bodySource =
    candidate?.responseBody ?? candidate?.body ?? cause?.responseBody ?? cause?.body;

  const details: LlmErrorDetails = {};
  if (typeof statusCodeSource === "number" && Number.isFinite(statusCodeSource)) {
    details.statusCode = statusCodeSource;
  }
  if (typeof codeSource === "string" && codeSource.trim().length > 0) {
    details.code = codeSource.trim();
  }
  if (typeof typeSource === "string" && typeSource.trim().length > 0) {
    details.type = typeSource.trim();
  }
  const body = stringifyBody(bodySource);
  if (body) {
    details.body = body;
  }
  return details;
}

function buildErrorMessage(error: unknown, details: LlmErrorDetails): string {
  const base = error instanceof Error ? error.message : String(error);
  const tokens: string[] = [];
  if (typeof details.statusCode === "number") {
    tokens.push(`status=${String(details.statusCode)}`);
  }
  if (details.code) {
    tokens.push(`code=${details.code}`);
  }
  return tokens.length > 0 ? `${base} (${tokens.join(", ")})` : base;
}

type XaiProviderOptions = {
  modelId?: string;
  apiKey?: string | null;
  generateTextImpl?: typeof generateText;
};

export function createXaiProvider(options?: XaiProviderOptions): LlmProvider {
  const modelId =
    options?.modelId ?? (process.env.AI_MODEL_NAME ?? "grok-4-1-fast-reasoning").trim();
  const apiKey = options?.apiKey ?? process.env.XAI_API_KEY ?? null;
  const callGenerateText = options?.generateTextImpl ?? generateText;

  return {
    providerId: "xai",
    modelId,
    capabilities: {
      supportsToolCalls: false,
    },
    async generateText(input: LlmGenerateTextInput): Promise<LlmGenerateTextOutput> {
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
          error: "EMPTY_PROMPT",
        };
      }

      if (!apiKey) {
        return {
          text: "",
          finishReason: "error",
          error: "MISSING_XAI_API_KEY",
        };
      }

      const providerClient = createXai({ apiKey });
      const model = providerClient.responses?.(input.modelId || modelId);
      if (!model) {
        return {
          text: "",
          finishReason: "error",
          error: "XAI_RESPONSES_MODEL_UNAVAILABLE",
        };
      }
      try {
        const payload = await callGenerateText({
          model,
          prompt,
          maxOutputTokens: input.maxOutputTokens,
          temperature: input.temperature,
        });
        const usage = payload.usage as
          | {
              inputTokens?: number;
              outputTokens?: number;
              totalTokens?: number;
            }
          | undefined;

        return {
          text: normalizeTextOutput(payload.text),
          finishReason: (payload.finishReason ?? "stop") as
            | "stop"
            | "length"
            | "content-filter"
            | "tool-calls"
            | "error",
          usage: {
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
            totalTokens: usage?.totalTokens,
          },
        };
      } catch (error) {
        const errorDetails = extractErrorDetails(error);
        return {
          text: "",
          finishReason: "error",
          error: buildErrorMessage(error, errorDetails),
          errorDetails,
        };
      }
    },
  };
}
