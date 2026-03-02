import { describe, expect, it, vi } from "vitest";
import { createMinimaxProvider } from "@/lib/ai/llm/providers/minimax-provider";

describe("createMinimaxProvider", () => {
  it("returns missing key error when api key is absent", async () => {
    const provider = createMinimaxProvider({
      modelId: "MiniMax-M2.1",
      apiKey: "",
    });

    const result = await provider.generateText({
      modelId: "MiniMax-M2.1",
      prompt: "ping",
      maxOutputTokens: 1,
      temperature: 0,
    });

    expect(result.finishReason).toBe("error");
    expect(result.error).toBe("MISSING_MINIMAX_API_KEY");
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

    const provider = createMinimaxProvider({
      modelId: "MiniMax-M2.1",
      apiKey: "test-key",
      generateTextImpl,
    });

    const result = await provider.generateText({
      modelId: "MiniMax-M2.1",
      prompt: "ping",
      maxOutputTokens: 1,
      temperature: 0,
    });

    expect(result.finishReason).toBe("stop");
    expect(result.text).toBe("ok");
    expect(result.error).toBeUndefined();
    expect(generateTextImpl).toHaveBeenCalledTimes(1);
  });

  it("surfaces provider 404 details with active minimax baseURL", async () => {
    const generateTextImpl = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("Not Found"), {
          statusCode: 404,
          code: "not_found",
          responseBody: { message: "route not found" },
        }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error("Not Found"), {
          statusCode: 404,
          code: "not_found",
          responseBody: { message: "route not found" },
        }),
      );

    const provider = createMinimaxProvider({
      modelId: "MiniMax-M2.1",
      apiKey: "test-key",
      generateTextImpl,
    });

    const result = await provider.generateText({
      modelId: "MiniMax-M2.1",
      prompt: "ping",
      maxOutputTokens: 1,
      temperature: 0,
    });

    expect(result.finishReason).toBe("error");
    expect(result.error).toContain("Not Found");
    expect(result.error).toContain("status=404");
    expect(result.error).toContain("code=not_found");
    expect(result.error).toContain("mode=anthropic");
    expect(result.error).toContain("baseURL=https://api.minimaxi.com/anthropic");
    expect(result.errorDetails).toEqual(
      expect.objectContaining({
        statusCode: 404,
        code: "not_found",
      }),
    );
    expect(generateTextImpl).toHaveBeenCalledTimes(2);
  });

  it("returns diagnostic error when provider responds with finishReason=error without details", async () => {
    const generateTextImpl = vi.fn(async () => ({
      text: "",
      finishReason: "error",
      usage: {
        inputTokens: 1,
        outputTokens: 0,
        totalTokens: 1,
      },
    }));

    const provider = createMinimaxProvider({
      modelId: "MiniMax-M2.1",
      apiKey: "test-key",
      generateTextImpl,
    });

    const result = await provider.generateText({
      modelId: "MiniMax-M2.1",
      prompt: "ping",
      maxOutputTokens: 1,
      temperature: 0,
    });

    expect(result.finishReason).toBe("error");
    expect(result.error).toContain("MINIMAX_ERROR_OUTPUT_WITHOUT_DETAILS");
    expect(result.error).toContain("mode=anthropic");
    expect(result.error).toContain("baseURL=https://api.minimaxi.com/anthropic/v1");
  });
});
