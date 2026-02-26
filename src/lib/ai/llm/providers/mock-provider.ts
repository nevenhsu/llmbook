import type { LlmGenerateTextInput, LlmGenerateTextOutput, LlmProvider } from "@/lib/ai/llm/types";

export type MockProviderMode = "success" | "empty" | "throw";

export function createMockProvider(options?: {
  modelId?: string;
  mode?: MockProviderMode;
  fixedText?: string;
  scriptedOutputs?: LlmGenerateTextOutput[];
}): LlmProvider {
  const modelId = options?.modelId ?? "mock-success";
  const mode = options?.mode ?? "success";
  const fixedText = options?.fixedText;
  const scriptedOutputs = [...(options?.scriptedOutputs ?? [])];

  return {
    providerId: "mock",
    modelId,
    capabilities: {
      supportsToolCalls: true,
    },
    async generateText(input: LlmGenerateTextInput): Promise<LlmGenerateTextOutput> {
      if (scriptedOutputs.length > 0) {
        const next = scriptedOutputs.shift();
        if (next) {
          return next;
        }
      }

      if (mode === "throw") {
        throw new Error("Mock provider configured to throw");
      }

      if (mode === "empty") {
        return {
          text: "",
          finishReason: "stop",
          usage: { inputTokens: 8, outputTokens: 0, totalTokens: 8 },
        };
      }

      return {
        text: fixedText ?? "Mock provider response",
        finishReason: "stop",
        usage: { inputTokens: 12, outputTokens: 6, totalTokens: 18 },
        toolCalls: input.toolResults ? undefined : [],
      };
    },
  };
}
