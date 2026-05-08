import { describe, expect, it, vi } from "vitest";
import { createDeepSeekProvider } from "@/lib/ai/llm/providers/deepseek-provider";

describe("createDeepSeekProvider", () => {
  it("returns missing key error when api key is absent", async () => {
    const provider = createDeepSeekProvider({
      modelId: "deepseek-v4-flash",
      apiKey: "",
    });

    const result = await provider.generateText({
      modelId: "deepseek-v4-flash",
      prompt: "ping",
      maxOutputTokens: 1,
      temperature: 0,
    });

    expect(result.finishReason).toBe("error");
    expect(result.error).toBe("MISSING_DEEPSEEK_API_KEY");
  });

  it("normalizes successful text output", async () => {
    const generateTextImpl = vi.fn(async () => ({
      text: "  ok\r\n",
      finishReason: "stop",
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      },
    }));

    const provider = createDeepSeekProvider({
      modelId: "deepseek-v4-flash",
      apiKey: "test-key",
      generateTextImpl: generateTextImpl as never,
    });

    const result = await provider.generateText({
      modelId: "deepseek-v4-flash",
      prompt: "ping",
      maxOutputTokens: 1,
      temperature: 0,
    });

    expect(result.finishReason).toBe("stop");
    expect(result.text).toBe("ok");
    expect(result.error).toBeUndefined();
    expect(generateTextImpl).toHaveBeenCalledTimes(1);
  });

  it("formats message input as a prompt", async () => {
    const generateTextImpl = vi.fn(async ({ prompt }) => ({
      text: prompt,
      finishReason: "stop",
    }));

    const provider = createDeepSeekProvider({
      modelId: "deepseek-v4-flash",
      apiKey: "test-key",
      generateTextImpl: generateTextImpl as never,
    });

    const result = await provider.generateText({
      modelId: "deepseek-v4-flash",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hello" },
      ],
    });

    expect(result.text).toContain("[system] sys");
    expect(result.text).toContain("[user] hello");
    expect(generateTextImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        maxOutputTokens: undefined,
        temperature: undefined,
      }),
    );
  });

  it("forwards providerOptions to the DeepSeek SDK call", async () => {
    const generateTextImpl = vi.fn(async () => ({
      text: "ok",
      finishReason: "stop",
    }));

    const provider = createDeepSeekProvider({
      modelId: "deepseek-v4-flash",
      apiKey: "test-key",
      generateTextImpl: generateTextImpl as never,
    });

    await provider.generateText({
      modelId: "deepseek-v4-flash",
      prompt: "ping",
      providerOptions: {
        deepseek: {
          reasoningEffort: "low",
        },
      },
    });

    expect(generateTextImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          deepseek: {
            reasoningEffort: "low",
          },
        },
      }),
    );
  });
});
