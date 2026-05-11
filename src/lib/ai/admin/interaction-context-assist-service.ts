import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
import { ADMIN_UI_LLM_PROVIDER_RETRIES } from "@/lib/ai/admin/persona-generation-token-budgets";
import type {
  AiModelConfig,
  AiProviderConfig,
  PersonaProfile,
} from "@/lib/ai/admin/control-plane-contract";
import { resolvePersonaTextModel } from "@/lib/ai/admin/control-plane-model-resolution";
import { asRecord } from "@/lib/ai/admin/control-plane-shared";

export async function assistInteractionTaskContext(input: {
  modelId: string;
  taskType: "post" | "comment" | "reply";
  personaId?: string;
  taskContext?: string;
  providers: AiProviderConfig[];
  models: AiModelConfig[];
  getPersonaProfile: (personaId: string) => Promise<PersonaProfile>;
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
}): Promise<string> {
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

  let personaProfile: PersonaProfile | null = null;
  if (input.personaId) {
    try {
      personaProfile = await input.getPersonaProfile(input.personaId);
    } catch {
      personaProfile = null;
    }
  }

  const personaName = personaProfile?.persona.display_name ?? "the selected persona";
  const personaCore = asRecord(personaProfile?.personaCore ?? {});
  const referenceStyle = (personaCore?.reference_style ?? {}) as Record<string, unknown>;
  const referenceSourceNames = Array.isArray(referenceStyle.reference_names)
    ? (referenceStyle.reference_names as string[]).filter((name) => name.length > 0)
    : [];
  const existingTaskContext = input.taskContext?.trim() ?? "";

  const prompt = [
    existingTaskContext
      ? "Write one short Interaction Preview scenario related to the current task context."
      : "Write one short random Interaction Preview scenario.",
    `Task type: ${input.taskType}.`,
    `Persona: ${personaName}.`,
    referenceSourceNames.length > 0
      ? `Reference anchors: ${referenceSourceNames.join(", ")}.`
      : null,
    existingTaskContext ? `Existing task context:\n${existingTaskContext}` : null,
    "Return plain text only.",
    existingTaskContext
      ? "Keep it clearly related, but do not copy or paraphrase the input."
      : "Make it realistic and specific.",
    input.taskType === "comment"
      ? existingTaskContext
        ? "Make it feel like a forum comment or critique that invites a reply."
        : "Make it feel like a forum comment that invites a reply."
      : existingTaskContext
        ? "Make it feel like a related topic seed for the next post."
        : "Make it feel like a topic seed for a new post.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const metadata = {
    entityType: "admin_ai_control_plane" as const,
    entityId: `interaction-context-assist:${model.id}`,
  };
  const runAssistPrompt = async (
    candidatePrompt: string,
    maxOutputTokens: number,
    temperature: number,
  ) => {
    return invokeLLM({
      registry,
      taskType: "generic",
      routeOverride: invocationConfig.route,
      modelInput: {
        prompt: candidatePrompt,
        maxOutputTokens,
        temperature,
        metadata,
      },
      entityId: metadata.entityId,
      timeoutMs: invocationConfig.timeoutMs,
      retries: Math.min(invocationConfig.retries ?? 0, ADMIN_UI_LLM_PROVIDER_RETRIES),
      onProviderError: async (event) => {
        await input.recordLlmInvocationError({
          providerKey: event.providerId,
          modelKey: event.modelId,
          error: event.error,
          errorDetails: event.errorDetails,
        });
      },
    });
  };

  const firstAttempt = await runAssistPrompt(prompt, 900, 0.4);
  if (firstAttempt.text.trim()) {
    return firstAttempt.text.trim();
  }

  const retryPrompt = [
    existingTaskContext
      ? "Rewrite the current task context into one short related Interaction Preview scenario."
      : "Create one short Interaction Preview scenario.",
    `Task type: ${input.taskType}.`,
    `Persona: ${personaName}.`,
    referenceSourceNames.length > 0
      ? `Reference anchors: ${referenceSourceNames.join(", ")}.`
      : null,
    existingTaskContext ? `Existing task context:\n${existingTaskContext}` : null,
    "Return plain text only.",
    "One short paragraph. No markdown.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const secondAttempt = await runAssistPrompt(retryPrompt, 1400, 0.2);
  if (secondAttempt.text.trim()) {
    return secondAttempt.text.trim();
  }
  throw new Error(
    `interaction context assist returned empty output (finishReason=${String(secondAttempt.finishReason ?? "unknown")}; error=${String(secondAttempt.error ?? "none")}; attempts=${String(secondAttempt.attempts ?? 0)})`,
  );
}
