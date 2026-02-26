import { describe, expect, it } from "vitest";
import { CachedLlmRuntimeConfigProvider } from "@/lib/ai/llm/runtime-config-provider";

describe("CachedLlmRuntimeConfigProvider", () => {
  it("reads reply route from policy release", async () => {
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
                taskRoutes: {
                  reply: {
                    primary: { providerId: "xai", modelId: "grok-4-1-fast-reasoning" },
                    secondary: { providerId: "mock", modelId: "mock-fallback" },
                  },
                },
              },
            },
          },
        },
      }),
    });

    const result = await provider.getConfig("reply");
    expect(result?.enabled).toBe(true);
    expect(result?.timeoutMs).toBe(9000);
    expect(result?.retries).toBe(2);
    expect(result?.route?.primary?.providerId).toBe("xai");
  });

  it("returns null when llmRuntime block is missing", async () => {
    const provider = new CachedLlmRuntimeConfigProvider({
      fetchLatestActive: async () => ({
        version: 1,
        policy: { capabilities: { reply: {} } },
      }),
    });

    const result = await provider.getConfig("reply");
    expect(result).toBeNull();
  });
});
