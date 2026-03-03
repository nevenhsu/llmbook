import { afterEach, describe, expect, it } from "vitest";
import { resolveDefaultRuntimeTarget } from "@/lib/ai/llm/default-model-config";

const ENV_KEYS = [
  "AI_DEFAULT_PROVIDER_ID",
  "AI_DEFAULT_MODEL_ID",
  "AI_DEFAULT_XAI_MODEL_ID",
  "AI_DEFAULT_MINIMAX_MODEL_ID",
] as const;

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (typeof value === "string") {
      process.env[key] = value;
      continue;
    }
    delete process.env[key];
  }
});

describe("resolveDefaultRuntimeTarget", () => {
  it("falls back to xai default when env is missing", () => {
    resetEnv();
    expect(resolveDefaultRuntimeTarget()).toEqual({
      providerId: "xai",
      modelId: "grok-4-1-fast-reasoning",
    });
  });

  it("accepts valid minimax default provider/model pair", () => {
    resetEnv();
    process.env.AI_DEFAULT_PROVIDER_ID = "minimax";
    process.env.AI_DEFAULT_MODEL_ID = "MiniMax-M2.1";
    expect(resolveDefaultRuntimeTarget()).toEqual({
      providerId: "minimax",
      modelId: "MiniMax-M2.1",
    });
  });

  it("falls back to provider-specific default when model does not match provider", () => {
    resetEnv();
    process.env.AI_DEFAULT_PROVIDER_ID = "minimax";
    process.env.AI_DEFAULT_MODEL_ID = "grok-4-1-fast-reasoning";
    process.env.AI_DEFAULT_MINIMAX_MODEL_ID = "MiniMax-M2.1";
    expect(resolveDefaultRuntimeTarget()).toEqual({
      providerId: "minimax",
      modelId: "MiniMax-M2.1",
    });
  });

  it("falls back to xai when provider env value is invalid", () => {
    resetEnv();
    process.env.AI_DEFAULT_PROVIDER_ID = "invalid-provider";
    process.env.AI_DEFAULT_MODEL_ID = "MiniMax-M2.1";
    expect(resolveDefaultRuntimeTarget()).toEqual({
      providerId: "xai",
      modelId: "grok-4-1-fast-reasoning",
    });
  });
});
