import {
  MockModelAdapter,
  generateTextWithToolLoop,
  type ModelGenerateTextInput,
} from "@/lib/ai/prompt-runtime/model-adapter";
import { getPromptRuntimeStatus } from "@/lib/ai/prompt-runtime/runtime-events";
import { ToolRegistry } from "@/lib/ai/prompt-runtime/tool-registry";

async function main(): Promise<void> {
  const registry = new ToolRegistry({
    allowlist: ["get_global_policy", "create_reply"],
  });

  registry.register({
    name: "get_global_policy",
    description: "Read policy",
    schema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: async () => ({ replyEnabled: true, precheckEnabled: true }),
  });

  registry.register({
    name: "create_reply",
    description: "Create reply draft",
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
    handler: async (args) => ({
      accepted: true,
      postId: String(args.post_id),
      markdownLength: String(args.markdown_content).length,
    }),
  });

  const modelInput: ModelGenerateTextInput = {
    prompt: "Return final answer after checking policy.",
    metadata: { entityId: "verify:tool-runtime" },
  };

  const adapter = new MockModelAdapter({
    scriptedOutputs: [
      {
        text: "",
        finishReason: "tool-calls",
        toolCalls: [{ id: "t1", name: "get_global_policy", arguments: {} }],
      },
      {
        text: "tool runtime verify ok",
        finishReason: "stop",
      },
    ],
  });

  const result = await generateTextWithToolLoop({
    adapter,
    modelInput,
    registry,
    entityId: "verify:tool-runtime",
    maxIterations: 3,
    timeoutMs: 1500,
  });

  const status = getPromptRuntimeStatus();

  console.log(
    JSON.stringify(
      {
        loop: {
          iterations: result.iterations,
          timedOut: result.timedOut,
          hitMaxIterations: result.hitMaxIterations,
          toolCalls: result.toolResults.map((item) => ({
            name: item.name,
            ok: item.ok,
            error: item.error ?? null,
          })),
        },
        output: {
          text: result.output.text,
          finishReason: result.output.finishReason ?? null,
          errorMessage: result.output.errorMessage ?? null,
        },
        recentToolEvents: {
          validationFailure: status.lastToolValidationFailure,
          handlerFailure: status.lastToolHandlerFailure,
          notAllowed: status.lastToolNotAllowed,
          timeout: status.lastToolTimeout,
          maxIterations: status.lastToolMaxIterations,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
