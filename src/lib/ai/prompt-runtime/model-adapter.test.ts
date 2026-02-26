import { describe, expect, it } from "vitest";
import {
  MockModelAdapter,
  VercelAiCoreAdapter,
  type ModelGenerateTextInput,
} from "@/lib/ai/prompt-runtime/model-adapter";

const SAMPLE_INPUT: ModelGenerateTextInput = {
  prompt: "hello",
  metadata: { entityId: "task-1" },
};

describe("MockModelAdapter", () => {
  it("returns text in success mode", async () => {
    const adapter = new MockModelAdapter({ mode: "success", fixedText: "ok" });
    const result = await adapter.generateText(SAMPLE_INPUT);
    expect(result.text).toBe("ok");
    expect(result.provider).toBe("mock");
  });

  it("returns empty text in empty mode", async () => {
    const adapter = new MockModelAdapter({ mode: "empty" });
    const result = await adapter.generateText(SAMPLE_INPUT);
    expect(result.text).toBe("");
  });

  it("throws in throw mode", async () => {
    const adapter = new MockModelAdapter({ mode: "throw" });
    await expect(adapter.generateText(SAMPLE_INPUT)).rejects.toThrow(
      "MockModelAdapter configured to throw",
    );
  });
});

describe("VercelAiCoreAdapter", () => {
  it("returns fail-safe empty output when disabled", async () => {
    const adapter = new VercelAiCoreAdapter({ enabled: false });
    const result = await adapter.generateText(SAMPLE_INPUT);
    expect(result.text).toBe("");
    expect(result.errorMessage).toBe("MODEL_DISABLED");
  });

  it("uses injected generateText implementation when provided", async () => {
    const adapter = new VercelAiCoreAdapter({
      enabled: true,
      provider: "grok",
      model: "grok-test",
      generateTextImpl: async () => ({
        text: "from injected impl",
        finishReason: "stop",
        provider: "grok",
        model: "grok-test",
      }),
    });

    const result = await adapter.generateText(SAMPLE_INPUT);
    expect(result.text).toBe("from injected impl");
    expect(result.provider).toBe("grok");
  });
});
