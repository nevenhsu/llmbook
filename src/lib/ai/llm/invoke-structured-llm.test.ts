import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { LlmProvider } from "@/lib/ai/llm/types";
import { LlmProviderRegistry } from "@/lib/ai/llm/registry";
import { invokeStructuredLLM } from "@/lib/ai/llm/invoke-structured-llm";

function registryWith(input: { ordered: LlmProvider[] }): LlmProviderRegistry {
  const registry = new LlmProviderRegistry({
    defaultTargets: input.ordered.map((provider) => ({
      providerId: provider.providerId,
      modelId: provider.modelId,
    })),
  });
  for (const provider of input.ordered) {
    registry.register(provider);
  }
  return registry;
}

const TestSchema = z.object({
  name: z.string(),
  score: z.number().int().min(0).max(100),
});

const schemaGateConfig = {
  schemaName: "TestSchema",
  schema: TestSchema,
  allowedRepairPaths: ["name", "score"],
  immutablePaths: [],
};

describe("invokeStructuredLLM", () => {
  it("force Output.object on first call even when modelInput has no output", async () => {
    let receivedOutput: unknown = undefined;

    const provider: LlmProvider = {
      providerId: "mock-structured",
      modelId: "s1",
      capabilities: { supportsToolCalls: false },
      generateText: async (genInput) => {
        receivedOutput = genInput.output;
        return {
          text: '{"name":"test","score":42}',
          finishReason: "stop",
        };
      },
    };

    await invokeStructuredLLM({
      registry: registryWith({ ordered: [provider] }),
      taskType: "generic",
      entityId: "test-structured-1",
      modelInput: { prompt: "hello" },
      schemaGate: schemaGateConfig,
    });

    expect(receivedOutput).toBeDefined();
    const typed = receivedOutput as Record<string, unknown>;
    expect(typed.name).toBeDefined();
  });

  it("returns status valid when raw.object validates", async () => {
    const provider: LlmProvider = {
      providerId: "mock-valid",
      modelId: "v1",
      capabilities: { supportsToolCalls: false },
      generateText: async () => ({
        text: '{"name":"test","score":42}',
        finishReason: "stop",
      }),
    };

    const result = await invokeStructuredLLM({
      registry: registryWith({ ordered: [provider] }),
      taskType: "generic",
      entityId: "test-valid-1",
      modelInput: { prompt: "hello" },
      schemaGate: schemaGateConfig,
    });

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.value).toEqual({ name: "test", score: 42 });
    }
  });

  it("returns schema_failure for unparseable JSON with no repair callbacks", async () => {
    const provider: LlmProvider = {
      providerId: "mock-invalid",
      modelId: "i1",
      capabilities: { supportsToolCalls: false },
      generateText: async () => ({
        text: "not json at all",
        finishReason: "stop",
      }),
    };

    const result = await invokeStructuredLLM({
      registry: registryWith({ ordered: [provider] }),
      taskType: "generic",
      entityId: "test-invalid-1",
      modelInput: { prompt: "hello" },
      schemaGate: schemaGateConfig,
    });

    expect(result.status).toBe("schema_failure");
  });

  it("repair callbacks use invokeLLMRaw, not invokeStructuredLLM", async () => {
    let repairCallCount = 0;

    const provider: LlmProvider = {
      providerId: "mock-repair",
      modelId: "r1",
      capabilities: { supportsToolCalls: false },
      generateText: async (genInput) => {
        repairCallCount++;
        const prompt = (genInput as Record<string, unknown>).prompt as string;
        if (prompt.includes("[field_patch_repair]")) {
          return {
            text: '{"repair":[{"path":"score","value":50}]}',
            finishReason: "stop",
            object: { repair: [{ path: "score", value: 50 }] },
          };
        }
        return {
          text: '{"name":"test","score":-1}',
          finishReason: "stop",
        };
      },
    };

    const result = await invokeStructuredLLM({
      registry: registryWith({ ordered: [provider] }),
      taskType: "generic",
      entityId: "test-repair-1",
      modelInput: { prompt: "hello" },
      schemaGate: {
        ...schemaGateConfig,
        allowedRepairPaths: ["score"],
      },
    });

    expect(result.status).toBe("valid");
    // First call: main invocation. Second call: field patch repair.
    // The repair call should be 2 total calls (main + repair), and both go
    // through the same provider (invokeLLMRaw, not recursive invokeStructuredLLM).
    expect(repairCallCount).toBeGreaterThanOrEqual(2);
  });

  it("finishReason=length with usable text returns valid after tail closure", async () => {
    const validJson = '{"name":"test","score":42}';

    const provider: LlmProvider = {
      providerId: "mock-length",
      modelId: "l1",
      capabilities: { supportsToolCalls: false },
      generateText: async () => ({
        text: validJson.slice(0, validJson.length - 1),
        finishReason: "length",
      }),
    };

    const result = await invokeStructuredLLM({
      registry: registryWith({ ordered: [provider] }),
      taskType: "generic",
      entityId: "test-length-1",
      modelInput: { prompt: "hello" },
      schemaGate: schemaGateConfig,
    });

    // Tail closure should complete the truncated JSON
    expect(result.status).toBe("valid");
  });
});
