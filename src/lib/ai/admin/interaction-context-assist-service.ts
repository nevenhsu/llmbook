import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import { invokeStructuredLLM } from "@/lib/ai/llm/invoke-structured-llm";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-contract";
import { resolvePersonaTextModel } from "@/lib/ai/admin/control-plane-model-resolution";
import {
  InteractionContextAssistSchema,
  type InteractionContextAssistOutput,
} from "@/lib/ai/admin/interaction-context-assist-schema";

function buildPrompt(input: {
  taskType: "post" | "comment" | "reply";
  taskContext: string;
}): string {
  const hasContext = input.taskContext.length > 0;
  const thinkingStep1 = hasContext
    ? "Consider the background data provided as reference direction."
    : "Generate a random content direction related to a story forum.";

  switch (input.taskType) {
    case "post":
      return [
        "[task context]",
        "Your task is to generate a detailed task context for a post interaction. Generate an article title direction and content direction.",
        "",
        "[background data]",
        `Task context: ${hasContext ? input.taskContext : "none"}`,
        "",
        "[detailed tasks and rules]",
        "Only generate article direction and content reference. Do not write the full article.",
        "",
        "[immediate task]",
        "Generate a detailed task context for a post. Create a direction for an article title and its content.",
        "",
        "[thinking step by step]",
        `1. ${thinkingStep1}`,
        "2. Generate the task context as a handoff for the next stage.",
      ].join("\n");

    case "comment":
      return [
        "[task context]",
        "Your task is to generate a detailed task context for a comment interaction. Generate a fictional article title and simple outline for the persona to comment on.",
        "",
        "[background data]",
        `Task context: ${hasContext ? input.taskContext : "none"}`,
        "",
        "[detailed tasks and rules]",
        "Only generate a fictional article outline. The persona will write a comment on it later.",
        "",
        "[immediate task]",
        "Generate a detailed task context for a comment. Create a fictional article outline to comment on.",
        "",
        "[thinking step by step]",
        `1. ${thinkingStep1}`,
        "2. Generate the task context as a handoff for the next stage.",
      ].join("\n");

    case "reply":
      return [
        "[task context]",
        "Your task is to generate a detailed task context for a reply interaction. Generate an article simple outline and a comment thread with 3 comments for the persona to reply to.",
        "",
        "[background data]",
        `Task context: ${hasContext ? input.taskContext : "none"}`,
        "",
        "[detailed tasks and rules]",
        "Only generate an article outline and a comment thread. Each comment should be up to 2 sentences. The comments should be related discussion around the article.",
        "",
        "[immediate task]",
        "Generate a detailed task context for a reply. Create an article outline and 3 comments to reply to.",
        "",
        "[thinking step by step]",
        `1. ${thinkingStep1}`,
        "2. Generate the task context as a handoff for the next stage.",
      ].join("\n");
  }
}

export async function assistInteractionTaskContext(input: {
  modelId: string;
  taskType: "post" | "comment" | "reply";
  taskContext?: string;
  providers: AiProviderConfig[];
  models: AiModelConfig[];
  recordLlmInvocationError: (input: {
    providerKey: string;
    modelKey: string;
    error: string;
    errorDetails?: {
      statusCode?: number;
      code?: string;
      type?: string;
      body?: string;
    };
  }) => Promise<void>;
}): Promise<InteractionContextAssistOutput> {
  const { model, provider } = resolvePersonaTextModel({
    modelId: input.modelId,
    models: input.models,
    providers: input.providers,
    featureLabel: "interaction context assist",
  });

  const invocationConfig = await resolveLlmInvocationConfig({
    taskType: "generic",
    capability: "text_generation",
    promptModality: "text_only",
    targetOverride: {
      providerId: provider.providerKey,
      modelId: model.modelKey,
    },
  });

  const registry = await createDbBackedLlmProviderRegistry({
    includeMock: true,
    includeXai: true,
    includeDeepSeek: true,
  });

  const existingTaskContext = input.taskContext?.trim() ?? "";
  const prompt = buildPrompt({
    taskType: input.taskType,
    taskContext: existingTaskContext,
  });

  const entityId = `interaction-context-assist:${model.id}`;

  const result = await invokeStructuredLLM({
    registry,
    taskType: "generic",
    routeOverride: invocationConfig.route,
    modelInput: {
      prompt,
      maxOutputTokens: 2000,
      temperature: 0.7,
    },
    entityId,
    timeoutMs: invocationConfig.timeoutMs,
    retries: 0,
    onProviderError: async (event) => {
      await input.recordLlmInvocationError({
        providerKey: event.providerId,
        modelKey: event.modelId,
        error: event.error,
        errorDetails: event.errorDetails,
      });
    },
    schemaGate: {
      schemaName: "InteractionContextAssist",
      schema: InteractionContextAssistSchema,
      validationRules: [
        "taskType must match the requested interaction type",
        "Each comment content must be 1-2 sentences (reply only)",
        "comments must contain exactly 3 items (reply only)",
      ],
      allowedRepairPaths: ["comments", "comments.*.content"],
      immutablePaths: ["taskType"],
    },
  });

  if (result.status === "schema_failure") {
    throw new Error(`interaction context assist schema failure: ${result.error}`);
  }

  return result.value;
}
