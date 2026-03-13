import { afterEach, describe, expect, it } from "vitest";
import {
  CachedLlmRuntimeConfigProvider,
  resolveLlmInvocationConfig,
} from "@/lib/ai/llm/runtime-config-provider";

const originalTimeout = process.env.AI_MODEL_TIMEOUT_MS;
const originalRetries = process.env.AI_MODEL_RETRIES;

afterEach(() => {
  if (originalTimeout === undefined) {
    delete process.env.AI_MODEL_TIMEOUT_MS;
  } else {
    process.env.AI_MODEL_TIMEOUT_MS = originalTimeout;
  }
  if (originalRetries === undefined) {
    delete process.env.AI_MODEL_RETRIES;
  } else {
    process.env.AI_MODEL_RETRIES = originalRetries;
  }
});

describe("CachedLlmRuntimeConfigProvider", () => {
  it("returns capability route from DB active order", async () => {
    const provider = new CachedLlmRuntimeConfigProvider({ ttlMs: 30_000 });
    const stub = async (
      capability: "text_generation" | "image_generation",
      promptModality: "text_only" | "text_image",
    ) => {
      if (capability === "text_generation" && promptModality === "text_only") {
        return {
          targets: [
            { providerId: "xai", modelId: "grok-4-1-fast-reasoning" },
            { providerId: "minimax", modelId: "MiniMax-M2.5" },
          ],
        };
      }
      return undefined;
    };
    (provider as unknown as { readDbRoute: typeof stub }).readDbRoute = stub;

    const result = await provider.getConfig("reply", "text_generation", "text_only");
    expect(result?.route?.targets[0]?.providerId).toBe("xai");
    expect(result?.route?.targets[1]?.modelId).toBe("MiniMax-M2.5");
  });

  it("uses prompt modality to switch text route", async () => {
    const provider = new CachedLlmRuntimeConfigProvider({ ttlMs: 30_000 });
    const stub = async (
      capability: "text_generation" | "image_generation",
      promptModality: "text_only" | "text_image",
    ) => {
      if (capability === "text_generation" && promptModality === "text_only") {
        return { targets: [{ providerId: "xai", modelId: "text-only-model" }] };
      }
      if (capability === "text_generation" && promptModality === "text_image") {
        return { targets: [{ providerId: "xai", modelId: "multimodal-model" }] };
      }
      if (capability === "image_generation") {
        return { targets: [{ providerId: "xai", modelId: "grok-imagine-image" }] };
      }
      return undefined;
    };
    (provider as unknown as { readDbRoute: typeof stub }).readDbRoute = stub;

    const text = await provider.getConfig("reply", "text_generation", "text_only");
    const textMultimodal = await provider.getConfig("reply", "text_generation", "text_image");
    const image = await provider.getConfig("reply", "image_generation");

    expect(text?.route?.targets[0]?.modelId).toBe("text-only-model");
    expect(textMultimodal?.route?.targets[0]?.modelId).toBe("multimodal-model");
    expect(image?.route?.targets[0]?.modelId).toBe("grok-imagine-image");
  });

  it("returns env-backed timeout and retries with resolved route config", async () => {
    process.env.AI_MODEL_TIMEOUT_MS = "23456";
    process.env.AI_MODEL_RETRIES = "4";

    const provider = new CachedLlmRuntimeConfigProvider({ ttlMs: 30_000 });
    const stub = async () => ({ targets: [{ providerId: "xai", modelId: "ordered-model" }] });
    (provider as unknown as { readDbRoute: typeof stub }).readDbRoute = stub;

    const result = await provider.getConfig("reply", "text_generation", "text_only");

    expect(result?.timeoutMs).toBe(23_456);
    expect(result?.retries).toBe(4);
    expect(result?.route?.targets[0]?.modelId).toBe("ordered-model");
  });

  it("allows invocation config to override route target while preserving runtime policy", async () => {
    process.env.AI_MODEL_TIMEOUT_MS = "21000";
    process.env.AI_MODEL_RETRIES = "2";

    const provider = new CachedLlmRuntimeConfigProvider({ ttlMs: 30_000 });
    const stub = async () => ({ targets: [{ providerId: "xai", modelId: "ordered-model" }] });
    (provider as unknown as { readDbRoute: typeof stub }).readDbRoute = stub;

    const result = await resolveLlmInvocationConfig({
      taskType: "generic",
      capability: "text_generation",
      promptModality: "text_only",
      configProvider: provider,
      targetOverride: {
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      },
    });

    expect(result.timeoutMs).toBe(21_000);
    expect(result.retries).toBe(2);
    expect(result.route?.targets).toEqual([{ providerId: "minimax", modelId: "MiniMax-M2.5" }]);
  });
});
