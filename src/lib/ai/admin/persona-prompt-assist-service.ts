import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import { invokeStructuredLLM } from "@/lib/ai/llm/invoke-structured-llm";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
import { PROMPT_ASSIST_BUDGETS } from "@/lib/ai/admin/persona-generation-token-budgets";
import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-contract";
import { resolvePersonaTextModel } from "@/lib/ai/admin/control-plane-model-resolution";
import { PromptAssistSchema, type PromptAssist } from "@/lib/ai/admin/prompt-assist-schema";
import { renderPromptAssistPrompt } from "@/lib/ai/prompt-runtime/persona/prompt-assist-prompt";
import type { StageDebugRecord } from "@/lib/ai/stage-debug-records";

export type PromptAssistSuccess = {
  text: string;
  referenceNames: string[];
  debugRecords: StageDebugRecord[];
};

export type PromptAssistFailure = {
  error: string;
  rawText: string | null;
  debugRecords: StageDebugRecord[];
};

export type PromptAssistResult = PromptAssistSuccess | PromptAssistFailure;

function normalizeReferenceNames(names: string[]): string[] {
  return names
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .filter((n, i, arr) => arr.indexOf(n) === i);
}

export async function assistPersonaPrompt(input: {
  modelId: string;
  inputPrompt: string;
  providers: AiProviderConfig[];
  models: AiModelConfig[];
  recordLlmInvocationError: (event: {
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
}): Promise<PromptAssistResult> {
  const { model, provider } = resolvePersonaTextModel({
    modelId: input.modelId,
    models: input.models,
    providers: input.providers,
    featureLabel: "prompt assist",
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

  const prompt = renderPromptAssistPrompt({ inputPrompt: input.inputPrompt });
  const entityId = `persona-prompt-assist:${model.id}`;

  const result = await invokeStructuredLLM<PromptAssist>({
    registry,
    taskType: "generic",
    routeOverride: invocationConfig.route,
    modelInput: {
      prompt,
      maxOutputTokens: PROMPT_ASSIST_BUDGETS.outputTokens,
      temperature: input.inputPrompt.trim().length === 0 ? 0.8 : 0.3,
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
      schemaName: "PromptAssist",
      schema: PromptAssistSchema,
      allowedRepairPaths: ["text", "referenceNames"],
      immutablePaths: [],
    },
  });

  const rawText = result.raw.text?.trim() || null;
  const debugRecords: StageDebugRecord[] = [
    {
      name: "prompt_assist",
      displayPrompt: prompt,
      outputMaxTokens: PROMPT_ASSIST_BUDGETS.outputTokens,
      attempts: [
        {
          attempt: "main",
          text: rawText ?? "",
          finishReason: result.raw.finishReason ?? null,
          providerId: result.raw.providerId ?? null,
          modelId: result.raw.modelId ?? null,
          hadError: Boolean(result.raw.error),
          ...(result.schemaGateDebug
            ? { schemaGateDebug: result.schemaGateDebug }
            : {}),
        },
      ],
    },
  ];

  if (result.status === "schema_failure") {
    return {
      error: result.error ?? "prompt assist schema failure",
      rawText,
      debugRecords,
    };
  }

  const value = result.value;
  const text = value.text.trim();
  const referenceNames = normalizeReferenceNames(value.referenceNames);

  if (!text) {
    return {
      error: "prompt assist output text is empty",
      rawText,
      debugRecords,
    };
  }

  if (referenceNames.length === 0) {
    return {
      error: "prompt assist output must include at least one reference name",
      rawText,
      debugRecords,
    };
  }

  return { text, referenceNames, debugRecords };
}
