import { describe, expect, it } from "vitest";
import { ToolRuntimeReasonCode } from "@/lib/ai/reason-codes";
import {
  MockModelAdapter,
  VercelAiCoreAdapter,
  generateTextWithToolLoop,
  type ModelGenerateTextInput,
} from "@/lib/ai/prompt-runtime/model-adapter";
import { PromptRuntimeEventRecorder } from "@/lib/ai/prompt-runtime/runtime-events";
import { ToolRegistry } from "@/lib/ai/prompt-runtime/tool-registry";

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

describe("generateTextWithToolLoop", () => {
  it("completes with tool success and returns final text", async () => {
    const registry = new ToolRegistry({ allowlist: ["get_global_policy"] });
    registry.register({
      name: "get_global_policy",
      description: "policy",
      schema: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
      handler: async () => ({ replyEnabled: true }),
    });

    const adapter = new MockModelAdapter({
      scriptedOutputs: [
        {
          text: "",
          finishReason: "tool-calls",
          toolCalls: [{ id: "tool-1", name: "get_global_policy", arguments: {} }],
        },
        {
          text: "final from model",
          finishReason: "stop",
        },
      ],
    });

    const result = await generateTextWithToolLoop({
      adapter,
      modelInput: SAMPLE_INPUT,
      registry,
      entityId: "task-1",
      maxIterations: 3,
      timeoutMs: 1000,
      recorder: new PromptRuntimeEventRecorder(),
    });

    expect(result.output.text).toBe("final from model");
    expect(result.toolResults).toHaveLength(1);
    expect(result.toolResults[0]?.ok).toBe(true);
  });

  it("records schema validation failure and continues loop", async () => {
    const recorder = new PromptRuntimeEventRecorder();
    const registry = new ToolRegistry({ allowlist: ["create_reply"] });
    registry.register({
      name: "create_reply",
      description: "create",
      schema: {
        type: "object",
        properties: {
          post_id: { type: "string" },
          markdown_content: { type: "string" },
          idempotency_key: { type: "string" },
        },
        required: ["post_id", "markdown_content", "idempotency_key"],
        additionalProperties: false,
      },
      handler: async () => ({ accepted: true }),
    });

    const adapter = new MockModelAdapter({
      scriptedOutputs: [
        {
          text: "",
          finishReason: "tool-calls",
          toolCalls: [{ id: "tool-1", name: "create_reply", arguments: { post_id: "post-1" } }],
        },
        {
          text: "final",
          finishReason: "stop",
        },
      ],
    });

    const result = await generateTextWithToolLoop({
      adapter,
      modelInput: SAMPLE_INPUT,
      registry,
      entityId: "task-2",
      recorder,
    });

    expect(result.output.text).toBe("final");
    expect(result.toolResults[0]?.ok).toBe(false);
    expect(result.toolResults[0]?.validationError).toContain("missing required arg");
    expect(
      recorder
        .getStatus()
        .events.some((event) => event.reasonCode === ToolRuntimeReasonCode.toolValidationFailed),
    ).toBe(true);
  });

  it("records handler throw and continues loop", async () => {
    const recorder = new PromptRuntimeEventRecorder();
    const registry = new ToolRegistry({ allowlist: ["boom"] });
    registry.register({
      name: "boom",
      description: "throw",
      schema: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
      handler: async () => {
        throw new Error("handler exploded");
      },
    });

    const adapter = new MockModelAdapter({
      scriptedOutputs: [
        {
          text: "",
          finishReason: "tool-calls",
          toolCalls: [{ id: "tool-2", name: "boom", arguments: {} }],
        },
        {
          text: "recovered",
          finishReason: "stop",
        },
      ],
    });

    const result = await generateTextWithToolLoop({
      adapter,
      modelInput: SAMPLE_INPUT,
      registry,
      entityId: "task-3",
      recorder,
    });

    expect(result.output.text).toBe("recovered");
    expect(result.toolResults[0]?.ok).toBe(false);
    expect(result.toolResults[0]?.error).toContain("handler exploded");
    expect(
      recorder
        .getStatus()
        .events.some((event) => event.reasonCode === ToolRuntimeReasonCode.toolHandlerFailed),
    ).toBe(true);
  });

  it("fails safe when loop times out", async () => {
    const registry = new ToolRegistry({ allowlist: ["slow"] });
    registry.register({
      name: "slow",
      description: "slow",
      schema: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
      handler: async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return { ok: true };
      },
    });

    const adapter = new MockModelAdapter({
      scriptedOutputs: [
        {
          text: "",
          finishReason: "tool-calls",
          toolCalls: [{ id: "tool-3", name: "slow", arguments: {} }],
        },
      ],
    });

    const result = await generateTextWithToolLoop({
      adapter,
      modelInput: SAMPLE_INPUT,
      registry,
      entityId: "task-timeout",
      maxIterations: 3,
      timeoutMs: 20,
      recorder: new PromptRuntimeEventRecorder(),
    });

    expect(result.timedOut).toBe(true);
    expect(result.output.text).toBe("");
    expect(result.output.errorMessage).toBe(ToolRuntimeReasonCode.toolLoopTimeout);
  });
});
