import { generateText } from "ai";
import { createMinimaxOpenAI } from "vercel-minimax-ai-provider";
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

type MinimaxProviderOptions = {
  modelId?: string;
  apiKey?: string | null;
  generateTextImpl?: typeof generateText;
};

export function createMinimaxProvider(options?: MinimaxProviderOptions): LlmProvider {
  const modelId = options?.modelId ?? "MiniMax-M2.5";
  const apiKey = options?.apiKey ?? null;
  const callGenerateText = options?.generateTextImpl ?? generateText;
  const baseURL = "https://api.minimaxi.com/v1";

  return {
    providerId: "minimax",
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
          error: "MISSING_MINIMAX_API_KEY",
        };
      }

      const callWithProvider = async (
        providerFactory: typeof createMinimaxOpenAI,
      ): Promise<LlmGenerateTextOutput> => {
        const providerClient = providerFactory({ apiKey, baseURL });
        const model = providerClient(input.modelId || modelId);
        if (!model) {
          return {
            text: "",
            finishReason: "error",
            error: "MINIMAX_MODEL_UNAVAILABLE",
          };
        }

        const payload = await callGenerateText({
          model,
          prompt,
          maxOutputTokens: input.maxOutputTokens,
          temperature: input.temperature,
          ...(input.output ? { output: input.output } : {}),
        });
        const usage = payload.usage as
          | {
              inputTokens?: number;
              outputTokens?: number;
              totalTokens?: number;
            }
          | undefined;

        const text = normalizeTextOutput(payload.text);
        const finishReason = (payload.finishReason ?? "stop") as
          | "stop"
          | "length"
          | "content-filter"
          | "tool-calls"
          | "error";

        // Some SDK responses can return finishReason=error without a thrown exception.
        if (finishReason === "error" && text.length === 0) {
          return {
            text: "",
            finishReason: "error",
            error: `MINIMAX_ERROR_OUTPUT_WITHOUT_DETAILS [baseURL=${baseURL}]`,
            usage: {
              inputTokens: usage?.inputTokens,
              outputTokens: usage?.outputTokens,
              totalTokens: usage?.totalTokens,
            },
          };
        }

        return {
          text,
          finishReason,
          usage: {
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
            totalTokens: usage?.totalTokens,
          },
          ...(payload.output ? { object: payload.output } : {}),
        };
      };

      try {
        return await callWithProvider(createMinimaxOpenAI);
      } catch (error) {
        const details = extractErrorDetails(error);
        return {
          text: "",
          finishReason: "error",
          error: `${buildErrorMessage(error, details)} [baseURL=${baseURL}]`,
          errorDetails: details,
        };
      }
    },
  };
}
