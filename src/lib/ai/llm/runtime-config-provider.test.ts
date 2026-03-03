import { describe, expect, it } from "vitest";
import { CachedLlmRuntimeConfigProvider } from "@/lib/ai/llm/runtime-config-provider";

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
            { providerId: "minimax", modelId: "MiniMax-M2.1" },
          ],
        };
      }
      return undefined;
    };
    (provider as unknown as { readDbRoute: typeof stub }).readDbRoute = stub;

    const result = await provider.getConfig("reply", "text_generation", "text_only");
    expect(result?.route?.targets[0]?.providerId).toBe("xai");
    expect(result?.route?.targets[1]?.modelId).toBe("MiniMax-M2.1");
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
});
