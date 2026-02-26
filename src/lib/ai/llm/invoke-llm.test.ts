import { describe, expect, it } from "vitest";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { LlmProviderRegistry } from "@/lib/ai/llm/registry";
import type { LlmProvider } from "@/lib/ai/llm/types";

function registryWith(input: {
  primary: LlmProvider;
  secondary?: LlmProvider;
}): LlmProviderRegistry {
  const registry = new LlmProviderRegistry({
    defaultRoute: { providerId: input.primary.providerId, modelId: input.primary.modelId },
    taskRoutes: {
      reply: {
        taskType: "reply",
        primary: { providerId: input.primary.providerId, modelId: input.primary.modelId },
        secondary: input.secondary
          ? { providerId: input.secondary.providerId, modelId: input.secondary.modelId }
          : undefined,
      },
    },
  });
  registry.register(input.primary);
  if (input.secondary) {
    registry.register(input.secondary);
  }
  return registry;
}

describe("invokeLLM", () => {
  it("primary success", async () => {
    const primary: LlmProvider = {
      providerId: "mock-primary",
      modelId: "p1",
      capabilities: { supportsToolCalls: true },
      generateText: async () => ({
        text: "ok-primary",
        finishReason: "stop",
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      }),
    };

    const result = await invokeLLM({
      registry: registryWith({ primary }),
      taskType: "reply",
      entityId: "task-1",
      modelInput: { prompt: "hello" },
    });

    expect(result.text).toBe("ok-primary");
    expect(result.providerId).toBe("mock-primary");
    expect(result.usedFallback).toBe(false);
    expect(result.usage.totalTokens).toBe(15);
  });

  it("primary fail then fallback success", async () => {
    const primary: LlmProvider = {
      providerId: "mock-primary",
      modelId: "p1",
      capabilities: { supportsToolCalls: false },
      generateText: async () => {
        throw new Error("primary boom");
      },
    };
    const secondary: LlmProvider = {
      providerId: "mock-secondary",
      modelId: "s1",
      capabilities: { supportsToolCalls: false },
      generateText: async () => ({
        text: "ok-secondary",
        finishReason: "stop",
        usage: { inputTokens: 7, outputTokens: 3, totalTokens: 10 },
      }),
    };

    const result = await invokeLLM({
      registry: registryWith({ primary, secondary }),
      taskType: "reply",
      entityId: "task-2",
      modelInput: { prompt: "hello" },
      retries: 0,
    });

    expect(result.text).toBe("ok-secondary");
    expect(result.providerId).toBe("mock-secondary");
    expect(result.usedFallback).toBe(true);
  });

  it("double fail returns fail-safe empty", async () => {
    const primary: LlmProvider = {
      providerId: "mock-primary",
      modelId: "p1",
      capabilities: { supportsToolCalls: false },
      generateText: async () => {
        throw new Error("primary boom");
      },
    };
    const secondary: LlmProvider = {
      providerId: "mock-secondary",
      modelId: "s1",
      capabilities: { supportsToolCalls: false },
      generateText: async () => {
        throw new Error("secondary boom");
      },
    };

    const result = await invokeLLM({
      registry: registryWith({ primary, secondary }),
      taskType: "reply",
      entityId: "task-3",
      modelInput: { prompt: "hello" },
      retries: 0,
    });

    expect(result.text).toBe("");
    expect(result.finishReason).toBe("error");
    expect(result.error).toContain("secondary boom");
  });

  it("timeout triggers fallback", async () => {
    const primary: LlmProvider = {
      providerId: "mock-primary",
      modelId: "p1",
      capabilities: { supportsToolCalls: false },
      generateText: async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return { text: "late", finishReason: "stop" };
      },
    };
    const secondary: LlmProvider = {
      providerId: "mock-secondary",
      modelId: "s1",
      capabilities: { supportsToolCalls: false },
      generateText: async () => ({
        text: "ok-secondary",
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      }),
    };

    const result = await invokeLLM({
      registry: registryWith({ primary, secondary }),
      taskType: "reply",
      entityId: "task-4",
      modelInput: { prompt: "hello" },
      retries: 0,
      timeoutMs: 10,
    });

    expect(result.text).toBe("ok-secondary");
    expect(result.usedFallback).toBe(true);
  });

  it("usage missing is normalized", async () => {
    const primary: LlmProvider = {
      providerId: "mock-primary",
      modelId: "p1",
      capabilities: { supportsToolCalls: false },
      generateText: async () => ({
        text: "ok",
        finishReason: "stop",
      }),
    };

    const result = await invokeLLM({
      registry: registryWith({ primary }),
      taskType: "reply",
      entityId: "task-5",
      modelInput: { prompt: "hello" },
    });

    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
    expect(result.usage.totalTokens).toBe(0);
    expect(result.usage.normalized).toBe(true);
  });

  it("propagates structured error details", async () => {
    const primary: LlmProvider = {
      providerId: "mock-primary",
      modelId: "p1",
      capabilities: { supportsToolCalls: false },
      generateText: async () => ({
        text: "",
        finishReason: "error",
        error: "Forbidden",
        errorDetails: {
          statusCode: 403,
          code: "forbidden",
          body: '{"error":"quota_exceeded"}',
        },
      }),
    };

    const result = await invokeLLM({
      registry: registryWith({ primary }),
      taskType: "reply",
      entityId: "task-6",
      modelInput: { prompt: "hello" },
      retries: 0,
    });

    expect(result.finishReason).toBe("error");
    expect(result.error).toBe("Forbidden");
    expect(result.errorDetails).toEqual({
      statusCode: 403,
      code: "forbidden",
      body: '{"error":"quota_exceeded"}',
    });
  });
});
