import { describe, expect, it } from "vitest";
import { CachedLlmRuntimeConfigProvider } from "@/lib/ai/llm/runtime-config-provider";

describe("CachedLlmRuntimeConfigProvider", () => {
  it("reads capability route from policy release", async () => {
    const provider = new CachedLlmRuntimeConfigProvider({
      fetchLatestActive: async () => ({
        version: 1,
        policy: {
          capabilities: {
            reply: {
              llmRuntime: {
                enabled: true,
                timeoutMs: 9000,
                retries: 2,
                capabilityRoutes: {
                  text_generation: {
                    targets: [
                      { providerId: "xai", modelId: "grok-4-1-fast-reasoning" },
                      { providerId: "mock", modelId: "mock-fallback" },
                    ],
                  },
                },
              },
            },
          },
        },
      }),
    });

    const result = await provider.getConfig("reply", "text_generation");
    expect(result?.enabled).toBe(true);
    expect(result?.timeoutMs).toBe(9000);
    expect(result?.retries).toBe(2);
    expect(result?.route?.targets[0]?.providerId).toBe("xai");
  });

  it("falls back to control-plane active order by capability", async () => {
    const provider = new CachedLlmRuntimeConfigProvider({
      fetchLatestActive: async () => ({
        version: 1,
        policy: {
          capabilities: { reply: {} },
          controlPlane: {
            providers: [
              {
                id: "p1",
                providerKey: "xai",
                status: "active",
                hasKey: true,
              },
            ],
            models: [
              {
                id: "m-text",
                providerId: "p1",
                modelKey: "grok-4-1-fast-reasoning",
                capability: "text_generation",
                status: "active",
                testStatus: "success",
                lifecycleStatus: "active",
                displayOrder: 0,
                supportsImageInputPrompt: false,
              },
              {
                id: "m-text-mm",
                providerId: "p1",
                modelKey: "grok-4-1-fast-reasoning-mm",
                capability: "text_generation",
                status: "active",
                testStatus: "success",
                lifecycleStatus: "active",
                displayOrder: 1,
                supportsImageInputPrompt: true,
              },
              {
                id: "m-image",
                providerId: "p1",
                modelKey: "grok-imagine-image",
                capability: "image_generation",
                status: "active",
                testStatus: "success",
                lifecycleStatus: "active",
                displayOrder: 0,
              },
            ],
          },
        },
      }),
    });

    const text = await provider.getConfig("reply", "text_generation", "text_only");
    const textMultimodal = await provider.getConfig("reply", "text_generation", "text_image");
    const image = await provider.getConfig("reply", "image_generation");
    expect(text?.route?.targets[0]?.modelId).toBe("grok-4-1-fast-reasoning");
    expect(textMultimodal?.route?.targets[0]?.modelId).toBe("grok-4-1-fast-reasoning-mm");
    expect(image?.route?.targets[0]?.modelId).toBe("grok-imagine-image");
  });
});
