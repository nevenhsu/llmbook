import type { PromptMessage } from "@/lib/ai/prompt-runtime/prompt-builder";
import type { SharedV3ProviderOptions } from "@ai-sdk/provider";
import type { SchemaGateDebug } from "@/lib/ai/json-repair/schema-gate-contracts";
import type { Output as AiOutput } from "ai";

export type LlmTaskType = "reply" | "vote" | "poll_vote" | "dispatch" | "generic";

export type LlmFinishReason = "stop" | "length" | "content-filter" | "tool-calls" | "error";

export type LlmErrorDetails = {
  statusCode?: number;
  code?: string;
  type?: string;
  body?: string;
};

export type LlmUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  normalized: boolean;
};

export type LlmProviderCapability = {
  supportsToolCalls: boolean;
};

export type LlmToolSchema = {
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

export type LlmToolCall = {
  id?: string;
  name: string;
  arguments: unknown;
};

export type LlmToolResult = {
  id?: string;
  name: string;
  ok: boolean;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  validationError?: string;
};

export type LlmGenerateTextInput = {
  modelId: string;
  prompt?: string;
  messages?: PromptMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  providerOptions?: SharedV3ProviderOptions;
  metadata?: Record<string, unknown>;
  tools?: LlmToolSchema[];
  toolResults?: LlmToolResult[];
  output?: AiOutput.Output;
};

export type LlmGenerateTextOutput = {
  text: string;
  finishReason?: LlmFinishReason;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  toolCalls?: LlmToolCall[];
  error?: string;
  errorDetails?: LlmErrorDetails;
  object?: unknown;
};

export type InvokeStructuredLlmOutput<T = unknown> =
  | {
      status: "valid";
      value: T;
      raw: InvokeLlmOutput;
      schemaGateDebug: SchemaGateDebug;
    }
  | {
      status: "schema_failure";
      error: string;
      raw: InvokeLlmOutput;
      schemaGateDebug: SchemaGateDebug;
    };

export type LlmProvider = {
  providerId: string;
  modelId: string;
  capabilities: LlmProviderCapability;
  generateText(input: LlmGenerateTextInput): Promise<LlmGenerateTextOutput>;
};

export type ProviderRouteTarget = {
  providerId: string;
  modelId: string;
};

export type ProviderRoute = {
  targets: ProviderRouteTarget[];
};

export type InvokeLlmOutput = {
  text: string;
  finishReason: LlmFinishReason;
  providerId: string | null;
  modelId: string | null;
  usage: LlmUsage;
  toolCalls?: LlmToolCall[];
  error?: string;
  errorDetails?: LlmErrorDetails;
  usedFallback: boolean;
  attempts: number;
  path: string[];
  object?: unknown;
};

export type LlmProviderErrorEvent = {
  providerId: string;
  modelId: string;
  error: string;
  errorDetails?: LlmErrorDetails;
};
