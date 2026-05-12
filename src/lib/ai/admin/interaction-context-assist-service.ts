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
  contentMode: "discussion" | "story";
}): string {
  const hasContext = input.taskContext.length > 0;
  const isDiscussion = input.contentMode === "discussion";
  const thinkingStep1 = hasContext
    ? "Consider the background data provided as reference direction."
    : isDiscussion
      ? "Generate a random discussion topic related to a story forum."
      : "Generate a random story premise related to a story forum.";

  switch (input.taskType) {
    case "post":
      return [
        "[task context]",
        isDiscussion
          ? "Your task is to generate a detailed task context for a discussion post. Generate an article title direction and content direction for a forum discussion."
          : "Your task is to generate a detailed task context for a story post. Generate a story title direction and premise for a narrative post.",
        "",
        "[background data]",
        `Task context: ${hasContext ? input.taskContext : "none"}`,
        "",
        "[detailed tasks and rules]",
        isDiscussion
          ? "Only generate article direction and content reference for a discussion. Do not write the full article."
          : "Only generate story direction and premise. Do not write the full story.",
        "",
        "[immediate task]",
        isDiscussion
          ? "Generate a detailed task context for a discussion post. Create a direction for an article title and its content."
          : "Generate a detailed task context for a story post. Create a direction for a story title and its premise.",
        "",
        "[thinking step by step]",
        `1. ${thinkingStep1}`,
        "2. Generate the task context as a handoff for the next stage.",
      ].join("\n");

    case "comment":
      return [
        "[task context]",
        isDiscussion
          ? "Your task is to generate a detailed task context for a comment interaction. Generate a fictional discussion article title and simple outline for the persona to comment on."
          : "Your task is to generate a detailed task context for a comment interaction. Generate a fictional story article title and simple outline for the persona to comment on.",
        "",
        "[background data]",
        `Task context: ${hasContext ? input.taskContext : "none"}`,
        "",
        "[detailed tasks and rules]",
        isDiscussion
          ? "Only generate a fictional discussion article outline. The persona will write a comment on it later."
          : "Only generate a fictional story article outline. The persona will write a comment on it later.",
        "",
        "[immediate task]",
        isDiscussion
          ? "Generate a detailed task context for a comment. Create a fictional discussion article outline to comment on."
          : "Generate a detailed task context for a comment. Create a fictional story article outline to comment on.",
        "",
        "[thinking step by step]",
        `1. ${thinkingStep1}`,
        "2. Generate the task context as a handoff for the next stage.",
      ].join("\n");

    case "reply":
      return [
        "[task context]",
        isDiscussion
          ? "Your task is to generate a detailed task context for a reply interaction. Generate a discussion article simple outline and a comment thread with 3 comments for the persona to reply to."
          : "Your task is to generate a detailed task context for a reply interaction. Generate a story article simple outline and a comment thread with 3 comments for the persona to reply to.",
        "",
        "[background data]",
        `Task context: ${hasContext ? input.taskContext : "none"}`,
        "",
        "[detailed tasks and rules]",
        isDiscussion
          ? "Only generate a discussion article outline and a comment thread. Each comment should be up to 2 sentences. The comments should be related discussion around the article."
          : "Only generate a story article outline and a comment thread. Each comment should be up to 2 sentences. The comments should be related story discussion around the article.",
        "",
        "[immediate task]",
        isDiscussion
          ? "Generate a detailed task context for a reply. Create a discussion article outline and 3 comments to reply to."
          : "Generate a detailed task context for a reply. Create a story article outline and 3 comments to reply to.",
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
  contentMode?: "discussion" | "story";
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
    contentMode: input.contentMode ?? "discussion",
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
