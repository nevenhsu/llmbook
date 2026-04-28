import { generateImage } from "ai";
import { createXai } from "@ai-sdk/xai";
import { createAdminClient } from "@/lib/supabase/admin";
import { markdownToEditorHtml } from "@/lib/tiptap-markdown";
import {
  derivePersonaUsername,
  normalizeUsernameInput,
  validateUsernameFormat,
} from "@/lib/username-validation";
import { type PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";
import { getInteractionRuntimeBudgets } from "@/lib/ai/prompt-runtime/runtime-budgets";
import { invokeLLM } from "@/lib/ai/llm/invoke-llm";
import { createDbBackedLlmProviderRegistry } from "@/lib/ai/llm/default-registry";
import {
  listProviderSecretStatuses,
  loadDecryptedProviderSecrets,
  upsertProviderSecret,
} from "@/lib/ai/llm/provider-secrets";
import { resolveLlmInvocationConfig } from "@/lib/ai/llm/runtime-config-provider";
import {
  type AdminControlPlaneSnapshot,
  type AiControlPlaneDocument,
  type AiModelConfig,
  type AiProviderConfig,
  type GlobalPolicyStudioDraft,
  type ModelCapability,
  type ModelRow,
  type ModelTestResult,
  type PersonaCoreRow,
  type PersonaGenerationStructured,
  type PersonaMemoryStoreRow,
  type PersonaProfile,
  type PersonaSummary,
  type PolicyReleaseListItem,
  type PolicyReleaseRow,
  type PreviewResult,
  type PromptBoardContext,
  type PromptTargetContext,
  type ProviderRow,
} from "@/lib/ai/admin/control-plane-contract";
import { assistInteractionTaskContext } from "@/lib/ai/admin/interaction-context-assist-service";
import type { PersonaReferenceCheckResult } from "@/lib/ai/admin/persona-batch-contract";
import { assistPersonaPrompt } from "@/lib/ai/admin/persona-prompt-assist-service";
import { previewPersonaGeneration } from "@/lib/ai/admin/persona-generation-preview-service";
import { previewPersonaInteraction } from "@/lib/ai/admin/interaction-preview-service";
import { AiAgentPersonaInteractionService } from "@/lib/ai/agent/execution/persona-interaction-service";
import {
  asRecord,
  buildLlmErrorDetailsSuffix,
  buildPromptBlocks,
  buildTokenBudgetSignal,
  DEFAULT_TOKEN_LIMITS,
  formatPrompt,
  isGenericModelTestError,
  readErrorDetails,
  readGlobalPolicyDocument,
  readModelErrorKind,
  readModelLifecycleStatus,
  readModelTestStatus,
  readNonEmptyMessage,
  readNumberOrNull,
  readPositiveInt,
  readString,
  writeGlobalPolicyDocument,
} from "@/lib/ai/admin/control-plane-shared";
import {
  parsePersonaCore,
  parseStoredPersonaCoreProfile,
} from "@/lib/ai/admin/persona-generation-contract";
import {
  buildPersonaReferenceRomanizedName,
  buildPersonaReferenceMatchKey,
  buildPersonaReferenceRow,
} from "@/lib/ai/admin/persona-reference-normalization";

export {
  PromptAssistError,
  PersonaGenerationParseError,
  PersonaGenerationQualityError,
} from "@/lib/ai/admin/control-plane-contract";
export type {
  AdminControlPlaneSnapshot,
  AiControlPlaneDocument,
  AiModelConfig,
  AiProviderConfig,
  GlobalPolicyStudioDraft,
  ModelCapability,
  ModelErrorKind,
  ModelLifecycleStatus,
  ModelStatus,
  ModelTestResult,
  ModelTestStatus,
  PersonaGenerationStructured,
  PersonaProfile,
  PersonaSummary,
  PolicyReleaseListItem,
  PreviewResult,
  PromptBoardContext,
  PromptTargetContext,
  ProviderStatus,
  ProviderTestStatus,
} from "@/lib/ai/admin/control-plane-contract";

function assertSinglePersonaLongMemory(
  memories: Array<{
    memoryType: "memory" | "long_memory";
    scope: "persona" | "board" | "thread";
  }>,
) {
  const personaLongMemoryCount = memories.filter(
    (item) => item.memoryType === "long_memory" && item.scope === "persona",
  ).length;
  if (personaLongMemoryCount > 1) {
    throw new Error("personaMemories may contain at most one persona long_memory row");
  }
}

const SUPPORTED_PROVIDER_CATALOG: Array<{
  providerKey: string;
  displayName: string;
  sdkPackage: string;
}> = [
  { providerKey: "xai", displayName: "xAI", sdkPackage: "@ai-sdk/xai" },
  {
    providerKey: "minimax",
    displayName: "Minimax",
    sdkPackage: "vercel-minimax-ai-provider",
  },
];

const SUPPORTED_MODEL_CATALOG: Array<{
  providerKey: string;
  modelKey: string;
  displayName: string;
  capability: ModelCapability;
  metadata: Record<string, unknown>;
  supportsImageInputPrompt: boolean;
}> = [
  {
    providerKey: "xai",
    modelKey: "grok-4-1-fast-reasoning",
    displayName: "Grok 4.1 Fast Reasoning",
    capability: "text_generation",
    metadata: { input: ["text", "image"], output: ["text"] },
    supportsImageInputPrompt: true,
  },
  {
    providerKey: "xai",
    modelKey: "grok-imagine-image",
    displayName: "Grok Imagine Image",
    capability: "image_generation",
    metadata: { input: ["text", "image"], output: ["image"] },
    supportsImageInputPrompt: true,
  },
  {
    providerKey: "minimax",
    modelKey: "MiniMax-M2.5",
    displayName: "MiniMax M2.5",
    capability: "text_generation",
    metadata: { input: ["text"], output: ["text"] },
    supportsImageInputPrompt: false,
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

export class AdminAiControlPlaneStore {
  private readonly supabase = createAdminClient();

  private async replacePersonaReferenceSources(
    personaId: string,
    referenceSources: PersonaGenerationStructured["reference_sources"],
  ): Promise<void> {
    const { error: deleteError } = await this.supabase
      .from("persona_reference_sources")
      .delete()
      .eq("persona_id", personaId);
    if (deleteError) {
      throw new Error(`clear persona reference sources failed: ${deleteError.message}`);
    }

    const referenceRows = referenceSources
      .map((source) =>
        buildPersonaReferenceRow({
          personaId,
          sourceName: source.name,
        }),
      )
      .filter((row) => row.source_name.length > 0 && row.match_key.length > 0);

    if (referenceRows.length === 0) {
      return;
    }

    const { error: insertError } = await this.supabase
      .from("persona_reference_sources")
      .insert(referenceRows);
    if (insertError) {
      throw new Error(`save persona reference sources failed: ${insertError.message}`);
    }
  }

  private readStoredReferenceSourceNames(coreProfile: unknown): string[] {
    const profile = asRecord(coreProfile);
    const referenceSources = Array.isArray(profile?.reference_sources)
      ? (profile.reference_sources as unknown[])
      : [];

    return referenceSources
      .map((source) => readString(asRecord(source)?.name))
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
  }

  private toProviderConfig(row: ProviderRow): AiProviderConfig {
    return {
      id: row.id,
      providerKey: row.provider_key,
      displayName: row.display_name,
      sdkPackage: row.sdk_package,
      status: row.status,
      testStatus: row.test_status,
      keyLast4: null,
      hasKey: false,
      lastApiErrorCode: row.last_api_error_code,
      lastApiErrorMessage: row.last_api_error_message,
      lastApiErrorAt: row.last_api_error_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toModelConfig(row: ModelRow): AiModelConfig {
    return {
      id: row.id,
      providerId: row.provider_id,
      modelKey: row.model_key,
      displayName: row.display_name,
      capability: row.capability,
      status: row.status,
      testStatus: row.test_status,
      lifecycleStatus: row.lifecycle_status,
      displayOrder: row.display_order,
      lastErrorKind: row.last_error_kind,
      lastErrorCode: row.last_error_code,
      lastErrorMessage: row.last_error_message,
      lastErrorAt: row.last_error_at,
      supportsInput: row.supports_input,
      supportsImageInputPrompt: row.supports_image_input_prompt,
      supportsOutput: row.supports_output,
      contextWindow: row.context_window,
      maxOutputTokens: row.max_output_tokens,
      metadata: row.metadata ?? {},
      updatedAt: row.updated_at,
    };
  }

  private modelToRow(model: AiModelConfig): Omit<ModelRow, "created_at"> {
    return {
      id: model.id,
      provider_id: model.providerId,
      model_key: model.modelKey,
      display_name: model.displayName,
      capability: model.capability,
      status: model.status,
      test_status: model.testStatus,
      lifecycle_status: model.lifecycleStatus,
      display_order: model.displayOrder,
      last_error_kind: model.lastErrorKind,
      last_error_code: model.lastErrorCode,
      last_error_message: model.lastErrorMessage,
      last_error_at: model.lastErrorAt,
      supports_input: model.supportsInput,
      supports_image_input_prompt: model.supportsImageInputPrompt,
      supports_output: model.supportsOutput,
      context_window: model.contextWindow,
      max_output_tokens: model.maxOutputTokens,
      metadata: model.metadata,
      updated_at: model.updatedAt,
    };
  }

  private async listProvidersFromDb(): Promise<AiProviderConfig[]> {
    const { data, error } = await this.supabase
      .from("ai_providers")
      .select(
        "id, provider_key, display_name, sdk_package, status, test_status, last_api_error_code, last_api_error_message, last_api_error_at, created_at, updated_at",
      )
      .order("created_at", { ascending: true });
    if (error) {
      throw new Error(`list providers failed: ${error.message}`);
    }
    return ((data ?? []) as ProviderRow[]).map((row) => this.toProviderConfig(row));
  }

  private async listModelsFromDb(): Promise<AiModelConfig[]> {
    const { data, error } = await this.supabase
      .from("ai_models")
      .select(
        "id, provider_id, model_key, display_name, capability, status, test_status, lifecycle_status, display_order, last_error_kind, last_error_code, last_error_message, last_error_at, supports_input, supports_image_input_prompt, supports_output, context_window, max_output_tokens, metadata, updated_at, created_at",
      )
      .order("display_order", { ascending: true })
      .order("display_name", { ascending: true });
    if (error) {
      throw new Error(`list models failed: ${error.message}`);
    }
    return ((data ?? []) as ModelRow[]).map((row) => this.toModelConfig(row));
  }

  private async upsertProviderRow(provider: AiProviderConfig): Promise<AiProviderConfig> {
    const payload = {
      id: provider.id,
      provider_key: provider.providerKey,
      display_name: provider.displayName,
      sdk_package: provider.sdkPackage,
      status: provider.status,
      test_status: provider.testStatus,
      last_api_error_code: provider.lastApiErrorCode,
      last_api_error_message: provider.lastApiErrorMessage,
      last_api_error_at: provider.lastApiErrorAt,
      updated_at: provider.updatedAt,
    };
    const { data, error } = await this.supabase
      .from("ai_providers")
      .upsert(payload, { onConflict: "id" })
      .select(
        "id, provider_key, display_name, sdk_package, status, test_status, last_api_error_code, last_api_error_message, last_api_error_at, created_at, updated_at",
      )
      .single<ProviderRow>();
    if (error || !data) {
      throw new Error(`upsert provider failed: ${error?.message ?? "unknown"}`);
    }
    const saved = this.toProviderConfig(data);
    await this.applyProviderSecretStatuses([saved]);
    return saved;
  }

  private async upsertModelRow(model: AiModelConfig): Promise<AiModelConfig> {
    const { data, error } = await this.supabase
      .from("ai_models")
      .upsert(this.modelToRow(model), { onConflict: "id" })
      .select(
        "id, provider_id, model_key, display_name, capability, status, test_status, lifecycle_status, display_order, last_error_kind, last_error_code, last_error_message, last_error_at, supports_input, supports_image_input_prompt, supports_output, context_window, max_output_tokens, metadata, updated_at, created_at",
      )
      .single<ModelRow>();
    if (error || !data) {
      throw new Error(`upsert model failed: ${error?.message ?? "unknown"}`);
    }
    return this.toModelConfig(data);
  }

  public async getActiveControlPlane(): Promise<{
    release: PolicyReleaseListItem | null;
    document: AiControlPlaneDocument;
    providers: AiProviderConfig[];
    models: AiModelConfig[];
  }> {
    const active = await this.fetchActiveRelease();
    const [providers, models] = await Promise.all([
      this.listProvidersFromDb(),
      this.listModelsFromDb(),
    ]);
    if (!active) {
      const emptyDoc = readGlobalPolicyDocument({});
      await this.applyProviderSecretStatuses(providers);
      return {
        release: null,
        document: emptyDoc,
        providers,
        models,
      };
    }

    const document = readGlobalPolicyDocument(active.policy);
    await this.applyProviderSecretStatuses(providers);
    return {
      release: {
        version: active.version,
        isActive: active.is_active,
        createdBy: active.created_by,
        changeNote: active.change_note,
        createdAt: active.created_at,
        globalPolicyDraft: document.globalPolicyDraft,
      },
      document,
      providers,
      models,
    };
  }

  public async listPolicyReleases(limit = 20): Promise<PolicyReleaseListItem[]> {
    const { data, error } = await this.supabase
      .from("ai_policy_releases")
      .select("version, policy, is_active, created_by, change_note, created_at")
      .order("version", { ascending: false })
      .limit(Math.max(1, Math.min(100, limit)));

    if (error) {
      throw new Error(`list policy releases failed: ${error.message}`);
    }

    return (data as PolicyReleaseRow[]).map((row) => {
      const doc = readGlobalPolicyDocument(row.policy);
      return {
        version: row.version,
        isActive: row.is_active,
        createdBy: row.created_by,
        changeNote: row.change_note,
        createdAt: row.created_at,
        globalPolicyDraft: doc.globalPolicyDraft,
      };
    });
  }

  public async getAdminControlPlaneSnapshot(input?: {
    releaseLimit?: number;
  }): Promise<AdminControlPlaneSnapshot> {
    const releaseLimit = Math.max(1, Math.min(50, input?.releaseLimit ?? 20));
    const [state, releases] = await Promise.all([
      this.getActiveControlPlane(),
      this.listPolicyReleases(releaseLimit),
    ]);

    return {
      providers: state.providers,
      models: state.models,
      releases,
      activeRelease: state.release,
    };
  }

  public async upsertProvider(
    input: Partial<AiProviderConfig> & {
      providerKey: string;
      displayName: string;
      sdkPackage: string;
      apiKey?: string | null;
    },
    actorId: string,
  ): Promise<AiProviderConfig> {
    void actorId;
    const { providers, models } = await this.loadActiveForMutation();
    const now = nowIso();
    const apiKey = input.apiKey?.trim() ?? "";
    const keyLast4 = apiKey ? apiKey.slice(-4) : null;
    const existingProvider =
      (input.id ? (providers.find((item) => item.id === input.id) ?? null) : null) ??
      providers.find((item) => item.providerKey === input.providerKey) ??
      null;

    const nextProvider: AiProviderConfig = {
      id: existingProvider?.id ?? input.id ?? crypto.randomUUID(),
      providerKey: input.providerKey,
      displayName: input.displayName,
      sdkPackage: input.sdkPackage,
      status: input.status === "disabled" ? "disabled" : "active",
      testStatus:
        input.status === "disabled"
          ? "disabled"
          : apiKey
            ? "untested"
            : input.testStatus === "key_missing"
              ? "key_missing"
              : (input.testStatus ?? existingProvider?.testStatus ?? "untested"),
      keyLast4: keyLast4 ?? input.keyLast4 ?? existingProvider?.keyLast4 ?? null,
      hasKey: apiKey.length > 0 ? true : (input.hasKey ?? existingProvider?.hasKey ?? false),
      lastApiErrorCode: apiKey
        ? null
        : (input.lastApiErrorCode ?? existingProvider?.lastApiErrorCode ?? null),
      lastApiErrorMessage: apiKey
        ? null
        : (input.lastApiErrorMessage ?? existingProvider?.lastApiErrorMessage ?? null),
      lastApiErrorAt: apiKey
        ? null
        : (input.lastApiErrorAt ?? existingProvider?.lastApiErrorAt ?? null),
      createdAt: input.createdAt ?? now,
      updatedAt: now,
    };

    if (apiKey.length > 0) {
      const secret = await upsertProviderSecret({
        providerKey: nextProvider.providerKey,
        apiKey,
      });
      nextProvider.hasKey = true;
      nextProvider.keyLast4 = secret.keyLast4;
      nextProvider.testStatus = nextProvider.status === "disabled" ? "disabled" : "untested";
      nextProvider.lastApiErrorCode = null;
      nextProvider.lastApiErrorMessage = null;
      nextProvider.lastApiErrorAt = null;

      for (const model of models) {
        if (model.providerId !== nextProvider.id) {
          continue;
        }
        model.testStatus = "untested";
        model.lastErrorKind = null;
        model.lastErrorCode = null;
        model.lastErrorMessage = null;
        model.lastErrorAt = null;
        model.updatedAt = now;
      }
    }

    const savedProvider = await this.upsertProviderRow(nextProvider);
    if (apiKey.length > 0) {
      const providerModels = models.filter((item) => item.providerId === savedProvider.id);
      if (providerModels.length > 0) {
        await Promise.all(
          providerModels.map((model) =>
            this.upsertModelRow({
              ...model,
              testStatus: "untested",
              lastErrorKind: null,
              lastErrorCode: null,
              lastErrorMessage: null,
              lastErrorAt: null,
              updatedAt: now,
            }),
          ),
        );
      }
    }

    return savedProvider;
  }

  public async upsertModel(
    input: Partial<AiModelConfig> & {
      providerId: string;
      modelKey: string;
      displayName: string;
      capability: ModelCapability;
    },
    actorId: string,
  ): Promise<AiModelConfig> {
    const { providers, models } = await this.loadActiveForMutation();
    const providerExists = providers.some((item) => item.id === input.providerId);
    if (!providerExists) {
      throw new Error("provider not found");
    }
    const existingModel = input.id
      ? (models.find((item) => item.id === input.id) ?? null)
      : (models.find(
          (item) => item.providerId === input.providerId && item.modelKey === input.modelKey,
        ) ?? null);

    const nextModel: AiModelConfig = {
      id: existingModel?.id ?? input.id ?? crypto.randomUUID(),
      providerId: input.providerId,
      modelKey: input.modelKey,
      displayName: input.displayName,
      capability: input.capability,
      status: input.status === "disabled" ? "disabled" : "active",
      testStatus: readModelTestStatus(input.testStatus ?? existingModel?.testStatus),
      lifecycleStatus: readModelLifecycleStatus(
        input.lifecycleStatus ?? existingModel?.lifecycleStatus,
      ),
      displayOrder:
        readNumberOrNull(input.displayOrder) ??
        readNumberOrNull(existingModel?.displayOrder) ??
        models.filter((item) => item.capability === input.capability).length,
      lastErrorKind: readModelErrorKind(input.lastErrorKind ?? existingModel?.lastErrorKind),
      lastErrorCode: input.lastErrorCode ?? existingModel?.lastErrorCode ?? null,
      lastErrorMessage: input.lastErrorMessage ?? existingModel?.lastErrorMessage ?? null,
      lastErrorAt: input.lastErrorAt ?? existingModel?.lastErrorAt ?? null,
      supportsInput: input.supportsInput ?? true,
      supportsImageInputPrompt:
        input.supportsImageInputPrompt ?? existingModel?.supportsImageInputPrompt ?? false,
      supportsOutput: input.supportsOutput ?? true,
      contextWindow: input.contextWindow ?? null,
      maxOutputTokens: input.maxOutputTokens ?? null,
      metadata: input.metadata ?? {},
      updatedAt: nowIso(),
    };

    const index = models.findIndex((item) => item.id === nextModel.id);
    if (index >= 0) {
      models[index] = {
        ...models[index],
        ...nextModel,
      };
    } else {
      models.push(nextModel);
    }

    void actorId;
    const savedModel = await this.upsertModelRow(nextModel);
    return savedModel;
  }

  public async testModelWithMinimalTokens(
    modelId: string,
    actorId: string,
  ): Promise<ModelTestResult> {
    const { providers, models } = await this.loadActiveForMutation();
    const model = models.find((item) => item.id === modelId);
    if (!model) {
      throw new Error("model not found");
    }
    const provider = providers.find((item) => item.id === model.providerId);
    if (!provider) {
      throw new Error("provider not found");
    }

    if (!provider.hasKey) {
      const now = nowIso();
      model.testStatus = "failed";
      model.lastErrorKind = "provider_api";
      model.lastErrorCode = "api_key_missing";
      model.lastErrorMessage = "Provider API key is missing";
      model.lastErrorAt = now;
      model.updatedAt = now;
      void actorId;
      const [savedModel, savedProvider] = await Promise.all([
        this.upsertModelRow(model),
        this.upsertProviderRow(provider),
      ]);
      return { model: savedModel, provider: savedProvider };
    }

    let artifact: ModelTestResult["artifact"] | undefined;

    if (model.capability === "image_generation") {
      try {
        if (provider.providerKey !== "xai") {
          throw new Error(`Image test is unsupported for provider: ${provider.providerKey}`);
        }
        const secretMap = await loadDecryptedProviderSecrets([provider.providerKey]);
        const apiKey = secretMap.get(provider.providerKey)?.apiKey?.trim() ?? "";
        if (!apiKey) {
          throw new Error("MISSING_XAI_API_KEY");
        }
        const client = createXai({ apiKey });
        const imageResult = await generateImage({
          model: client.image(model.modelKey),
          prompt: "Minion",
          aspectRatio: "2:3",
          n: 1,
          maxRetries: 0,
        });
        const first = imageResult.images[0];
        const base64 = first?.base64 ?? "";
        const mediaType = first?.mediaType ?? "image/png";
        if (!base64) {
          throw new Error("IMAGE_TEST_EMPTY_OUTPUT");
        }

        artifact = {
          imageDataUrl: `data:${mediaType};base64,${base64}`,
        };

        model.testStatus = "success";
        model.status = "active";
        model.lastErrorKind = null;
        model.lastErrorCode = null;
        model.lastErrorMessage = null;
        model.lastErrorAt = null;
        model.updatedAt = nowIso();
        provider.testStatus = provider.status === "disabled" ? "disabled" : "success";
        provider.lastApiErrorCode = null;
        provider.lastApiErrorMessage = null;
        provider.lastApiErrorAt = null;
        provider.updatedAt = nowIso();
      } catch (error) {
        const details = readErrorDetails(error);
        const now = nowIso();
        model.testStatus = "failed";
        model.lastErrorKind = "provider_api";
        model.lastErrorCode = details.code;
        model.lastErrorMessage = details.message;
        model.lastErrorAt = now;
        model.updatedAt = now;
        provider.lastApiErrorCode = details.code;
        provider.lastApiErrorMessage = details.message;
        provider.lastApiErrorAt = now;
        provider.updatedAt = now;
      }
    } else {
      const testPrompt =
        provider.providerKey === "minimax" ? "Reply with exactly one word: pong" : "ping";
      const testMaxOutputTokens = provider.providerKey === "minimax" ? 128 : 1;
      try {
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
          includeMock: false,
          includeXai: true,
          includeMinimax: true,
        });
        const llmResult = await invokeLLM({
          registry,
          taskType: "generic",
          routeOverride: invocationConfig.route,
          modelInput: {
            prompt: testPrompt,
            maxOutputTokens: testMaxOutputTokens,
            temperature: 0,
          },
          entityId: `model-test:${model.id}`,
          timeoutMs: invocationConfig.timeoutMs,
          retries: 0,
          onProviderError: async (event) => {
            const now = nowIso();
            const baseProviderErrorMessage =
              readNonEmptyMessage(event.error) ?? "Provider API request failed";
            const providerErrorMessage = `${baseProviderErrorMessage}${buildLlmErrorDetailsSuffix(
              event.errorDetails,
            )}`;
            model.testStatus = "failed";
            model.lastErrorKind = "provider_api";
            model.lastErrorCode = event.errorDetails?.code ?? null;
            model.lastErrorMessage = providerErrorMessage.slice(0, 500);
            model.lastErrorAt = now;
            model.updatedAt = now;
            provider.lastApiErrorCode = event.errorDetails?.code ?? null;
            provider.lastApiErrorMessage = providerErrorMessage.slice(0, 500);
            provider.lastApiErrorAt = now;
            provider.updatedAt = now;
          },
        });

        const isModelTestSuccess = !llmResult.error && llmResult.finishReason !== "error";
        if (isModelTestSuccess) {
          const now = nowIso();
          model.testStatus = "success";
          model.status = "active";
          model.lastErrorKind = null;
          model.lastErrorCode = null;
          model.lastErrorMessage = null;
          model.lastErrorAt = null;
          model.updatedAt = now;
          provider.testStatus = provider.status === "disabled" ? "disabled" : "success";
          provider.lastApiErrorCode = null;
          provider.lastApiErrorMessage = null;
          provider.lastApiErrorAt = null;
          provider.updatedAt = now;
        } else {
          const now = nowIso();
          const rawErrorCandidate =
            readNonEmptyMessage(llmResult.error, model.lastErrorMessage) ??
            `Model returned empty output (finishReason=${String(llmResult.finishReason ?? "unknown")})`;
          const rawError = isGenericModelTestError(rawErrorCandidate)
            ? `Provider API request failed${buildLlmErrorDetailsSuffix(llmResult.errorDetails)}`
            : `${rawErrorCandidate}${buildLlmErrorDetailsSuffix(llmResult.errorDetails)}`;
          model.testStatus = "failed";
          model.lastErrorKind = model.lastErrorKind ?? "other";
          model.lastErrorCode = llmResult.errorDetails?.code ?? model.lastErrorCode ?? null;
          model.lastErrorMessage = rawError.startsWith("LLM_TIMEOUT_")
            ? `Model test timeout (${provider.providerKey}, ${String(invocationConfig.timeoutMs ?? 12_000)}ms)`
            : rawError.slice(0, 500);
          model.lastErrorAt = now;
          model.updatedAt = now;
          provider.updatedAt = now;
        }
      } catch (error) {
        const details = readErrorDetails(error);
        const now = nowIso();
        model.testStatus = "failed";
        model.lastErrorKind = "provider_api";
        model.lastErrorCode = details.code;
        model.lastErrorMessage = details.message;
        model.lastErrorAt = now;
        model.updatedAt = now;
        provider.lastApiErrorCode = details.code;
        provider.lastApiErrorMessage = details.message;
        provider.lastApiErrorAt = now;
        provider.updatedAt = now;
      }
    }

    void actorId;
    const [savedModel, savedProvider] = await Promise.all([
      this.upsertModelRow(model),
      this.upsertProviderRow(provider),
    ]);
    return { model: savedModel, provider: savedProvider, artifact };
  }

  public async reorderModels(input: {
    capability: ModelCapability;
    orderedModelKeys: string[];
    actorId: string;
  }): Promise<{
    models: AiModelConfig[];
  }> {
    const { providers, models } = await this.loadActiveForMutation();

    const requestedSupported = input.orderedModelKeys
      .map(
        (modelKey) =>
          SUPPORTED_MODEL_CATALOG.find(
            (item) => item.modelKey === modelKey && item.capability === input.capability,
          ) ?? null,
      )
      .filter((item, index, arr): item is (typeof SUPPORTED_MODEL_CATALOG)[number] => {
        if (!item) {
          return false;
        }
        return arr.findIndex((target) => target?.modelKey === item.modelKey) === index;
      });

    const now = nowIso();
    for (const supported of requestedSupported) {
      const providerCatalog = SUPPORTED_PROVIDER_CATALOG.find(
        (item) => item.providerKey === supported.providerKey,
      );
      const provider = providers.find((item) => item.providerKey === supported.providerKey) ?? null;
      let providerId = provider?.id ?? null;
      if (!providerId && providerCatalog) {
        providerId = crypto.randomUUID();
        providers.push({
          id: providerId,
          providerKey: providerCatalog.providerKey,
          displayName: providerCatalog.displayName,
          sdkPackage: providerCatalog.sdkPackage,
          status: "active",
          testStatus: "untested",
          keyLast4: null,
          hasKey: false,
          lastApiErrorCode: null,
          lastApiErrorMessage: null,
          lastApiErrorAt: null,
          createdAt: now,
          updatedAt: now,
        });
      }
      if (!providerId) {
        continue;
      }

      const existing = models.find(
        (item) => item.providerId === providerId && item.modelKey === supported.modelKey,
      );
      if (existing) {
        continue;
      }

      models.push({
        id: crypto.randomUUID(),
        providerId,
        modelKey: supported.modelKey,
        displayName: supported.displayName,
        capability: supported.capability,
        status: "disabled",
        testStatus: "untested",
        lifecycleStatus: "active",
        displayOrder: models.filter((item) => item.capability === input.capability).length,
        lastErrorKind: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorAt: null,
        supportsInput: true,
        supportsImageInputPrompt: supported.supportsImageInputPrompt,
        supportsOutput: true,
        contextWindow: null,
        maxOutputTokens: null,
        metadata: supported.metadata,
        updatedAt: now,
      });
    }

    const targetModels = models.filter((item) => item.capability === input.capability);
    const keyToId = new Map(targetModels.map((item) => [item.modelKey, item.id] as const));
    const requested = input.orderedModelKeys
      .map((modelKey) => keyToId.get(modelKey) ?? null)
      .filter((id, index, arr): id is string => Boolean(id) && arr.indexOf(id) === index);
    const requestedSet = new Set(requested);

    const remaining = targetModels
      .filter((item) => !requestedSet.has(item.id))
      .sort((a, b) => {
        const gap = a.displayOrder - b.displayOrder;
        if (gap !== 0) {
          return gap;
        }
        return a.modelKey.localeCompare(b.modelKey);
      })
      .map((item) => item.id);

    const finalOrder = [...requested, ...remaining];
    const orderMap = new Map(finalOrder.map((id, index) => [id, index]));

    for (const model of models) {
      if (model.capability !== input.capability) {
        continue;
      }
      const nextOrder = orderMap.get(model.id);
      if (typeof nextOrder !== "number") {
        continue;
      }
      model.displayOrder = nextOrder;
      model.updatedAt = now;
      model.metadata = {
        ...model.metadata,
        displayOrder: nextOrder,
      };
    }

    void input.actorId;
    for (const provider of providers) {
      await this.upsertProviderRow(provider);
    }
    const targetModelIds = new Set(targetModels.map((item) => item.id));
    for (const model of models) {
      if (targetModelIds.has(model.id)) {
        await this.upsertModelRow(model);
      }
    }

    const savedModels = await this.listModelsFromDb();
    return {
      models: savedModels,
    };
  }

  public async recordLlmInvocationError(input: {
    providerKey: string;
    modelKey: string;
    error: string;
    errorDetails?: {
      statusCode?: number;
      code?: string;
      type?: string;
      body?: string;
    };
  }): Promise<void> {
    const { providers, models } = await this.loadActiveForMutation();
    const provider = providers.find((item) => item.providerKey === input.providerKey);
    if (!provider) {
      return;
    }
    const model = models.find(
      (item) => item.providerId === provider.id && item.modelKey === input.modelKey,
    );
    if (!model) {
      return;
    }

    const errorText =
      `${input.error} ${input.errorDetails?.code ?? ""} ${input.errorDetails?.type ?? ""} ${input.errorDetails?.body ?? ""}`.toLowerCase();
    const isModelRetired =
      input.errorDetails?.statusCode === 404 ||
      /model.*(not found|retired|deprecated|unsupported|does not exist|unknown)/.test(errorText) ||
      /(model_not_found|unknown_model|invalid_model)/.test(errorText);
    const isHardProviderFailure =
      !isModelRetired &&
      ((typeof input.errorDetails?.statusCode === "number" &&
        (input.errorDetails.statusCode === 402 || input.errorDetails.statusCode === 403)) ||
        /(insufficient[_\s-]?(balance|credit|quota)|credit.*exhausted|quota.*exceeded|billing|payment required|account suspended|account deactivated)/.test(
          errorText,
        ));
    const isTransientProviderFailure =
      !isModelRetired &&
      !isHardProviderFailure &&
      ((typeof input.errorDetails?.statusCode === "number" &&
        (input.errorDetails.statusCode >= 500 ||
          input.errorDetails.statusCode === 401 ||
          input.errorDetails.statusCode === 429)) ||
        /(api key|unauthorized|forbidden|rate limit|timeout|network|service unavailable)/.test(
          errorText,
        ));
    const isProviderApiError = isHardProviderFailure || isTransientProviderFailure;

    const now = nowIso();
    model.lastErrorKind = isModelRetired
      ? "model_retired"
      : isProviderApiError
        ? "provider_api"
        : "other";
    model.lastErrorCode = input.errorDetails?.code ?? null;
    model.lastErrorMessage = input.error.slice(0, 500);
    model.lastErrorAt = now;

    if (isModelRetired) {
      model.lifecycleStatus = "retired";
      model.status = "disabled";
      model.testStatus = "failed";
    }

    if (isHardProviderFailure) {
      model.status = "disabled";
      model.testStatus = "failed";
    }

    if (isProviderApiError) {
      provider.lastApiErrorCode = input.errorDetails?.code ?? null;
      provider.lastApiErrorMessage = input.error.slice(0, 500);
      provider.lastApiErrorAt = now;
      provider.updatedAt = now;
    }

    await Promise.all([this.upsertModelRow(model), this.upsertProviderRow(provider)]);
  }

  public async saveGlobalPolicyDraft(
    draft: Pick<
      GlobalPolicyStudioDraft,
      "systemBaseline" | "globalPolicy" | "styleGuide" | "forbiddenRules"
    > & {
      action?: "update" | "publish";
      version?: number;
    },
    actorId: string,
    note?: string,
  ): Promise<PolicyReleaseListItem> {
    const action = draft.action === "publish" ? "publish" : "update";
    const active = await this.fetchActiveRelease();
    const requestedReleaseVersion = readPositiveInt(draft.version, active?.version ?? 1);
    const baseRow =
      (await this.fetchReleaseByVersion(requestedReleaseVersion)) ??
      active ??
      ({
        version: 0,
        policy: {},
        is_active: false,
        created_by: null,
        change_note: null,
        created_at: nowIso(),
      } as PolicyReleaseRow);
    const basePolicy = asRecord(baseRow.policy) ?? {};
    const document = readGlobalPolicyDocument(basePolicy);

    document.globalPolicyDraft = {
      systemBaseline: draft.systemBaseline,
      globalPolicy: draft.globalPolicy,
      styleGuide: draft.styleGuide,
      forbiddenRules: draft.forbiddenRules,
    };
    const policy = writeGlobalPolicyDocument(basePolicy, document);
    const changeNote = note ?? `control-plane: ${action} policy v${requestedReleaseVersion}`;

    let row: PolicyReleaseRow;
    if (action === "publish" || !active) {
      row = await this.insertActiveRelease(policy, actorId, changeNote);
    } else {
      const { data, error } = await this.supabase
        .from("ai_policy_releases")
        .update({
          policy,
          created_by: actorId,
          change_note: changeNote,
        })
        .eq("version", baseRow.version)
        .select("version, policy, is_active, created_by, change_note, created_at")
        .single<PolicyReleaseRow>();
      if (error || !data) {
        throw new Error(`save policy draft failed: ${error?.message ?? "unknown"}`);
      }
      row = data;
    }

    const savedDoc = readGlobalPolicyDocument(row.policy);
    return {
      version: row.version,
      isActive: row.is_active,
      createdBy: row.created_by,
      changeNote: row.change_note,
      createdAt: row.created_at,
      globalPolicyDraft: savedDoc.globalPolicyDraft,
    };
  }

  public async deletePolicyRelease(version: number): Promise<void> {
    const row = await this.fetchReleaseByVersion(version);
    if (!row) {
      throw new Error("policy release not found");
    }
    if (row.is_active) {
      throw new Error("active policy release cannot be deleted");
    }

    const { error } = await this.supabase
      .from("ai_policy_releases")
      .delete()
      .eq("version", version);
    if (error) {
      throw new Error(`delete policy release failed: ${error.message}`);
    }
  }

  public async rollbackToRelease(
    version: number,
    actorId: string,
    note?: string,
  ): Promise<PolicyReleaseListItem> {
    const row = await this.fetchReleaseByVersion(version);
    if (!row) {
      throw new Error("policy release not found");
    }

    const inserted = await this.insertActiveRelease(
      asRecord(row.policy) ?? {},
      actorId,
      note ?? `control-plane: rollback to version ${version}`,
    );

    const doc = readGlobalPolicyDocument(inserted.policy);
    return {
      version: inserted.version,
      isActive: inserted.is_active,
      createdBy: inserted.created_by,
      changeNote: inserted.change_note,
      createdAt: inserted.created_at,
      globalPolicyDraft: doc.globalPolicyDraft,
    };
  }

  public async previewGlobalPolicyRelease(
    version: number,
    taskContext: string,
  ): Promise<PreviewResult> {
    const row = await this.fetchReleaseByVersion(version);
    if (!row) {
      throw new Error("policy release not found");
    }

    const document = readGlobalPolicyDocument(row.policy);
    const blocks = buildPromptBlocks({
      actionType: "comment",
      globalDraft: document.globalPolicyDraft,
      outputStyle: document.globalPolicyDraft.styleGuide,
      agentCore: "(global preview mode)",
      boardContext: "",
      targetContext: "",
      agentEnactmentRules: "",
      agentExamples: "",
      taskContext,
    });

    const tokenBudget = buildTokenBudgetSignal({
      blocks,
      maxInputTokens: DEFAULT_TOKEN_LIMITS.interactionMaxInputTokens,
      maxOutputTokens: getInteractionRuntimeBudgets("comment").initial,
    });

    const markdown = [
      "## Global Policy Preview",
      "",
      `Task Context: ${taskContext || "(empty)"}`,
      "",
      "This is a policy-only prompt assembly preview.",
    ].join("\n");

    try {
      markdownToEditorHtml(markdown);
      return {
        assembledPrompt: formatPrompt(blocks),
        markdown,
        renderOk: true,
        renderError: null,
        tokenBudget,
      };
    } catch (error) {
      return {
        assembledPrompt: formatPrompt(blocks),
        markdown,
        renderOk: false,
        renderError: error instanceof Error ? error.message : "render validation failed",
        tokenBudget,
      };
    }
  }

  public async listPersonas(limit = 50, query?: string): Promise<PersonaSummary[]> {
    let qb = this.supabase
      .from("personas")
      .select("id, username, display_name, avatar_url, bio, status")
      .order("updated_at", { ascending: false })
      .limit(Math.max(1, Math.min(200, limit)));

    const keyword = query?.trim();
    if (keyword) {
      const escaped = keyword.replace(/[%_]/g, (m) => `\\${m}`);
      qb = qb.or(`username.ilike.%${escaped}%,display_name.ilike.%${escaped}%`);
    }

    const { data, error } = await qb;

    if (error) {
      throw new Error(`list personas failed: ${error.message}`);
    }

    return (data ?? []) as PersonaSummary[];
  }

  public async checkPersonaReferenceSources(
    names: string[],
  ): Promise<PersonaReferenceCheckResult[]> {
    const normalizedInputs = names.map((input) => ({
      input,
      normalized: buildPersonaReferenceMatchKey(input),
    }));

    const matchKeys = Array.from(
      new Set(normalizedInputs.map((item) => item.normalized).filter((item) => item.length > 0)),
    );

    if (matchKeys.length === 0) {
      return normalizedInputs.map((item) => ({
        input: item.input,
        matchKey: item.normalized,
        romanizedName: buildPersonaReferenceRomanizedName(item.input),
        exists: false,
      }));
    }

    const { data, error } = await this.supabase
      .from("persona_reference_sources")
      .select("match_key")
      .in("match_key", matchKeys);

    if (error) {
      throw new Error(`check persona references failed: ${error.message}`);
    }

    const existingNames = new Set(
      ((data ?? []) as Array<{ match_key?: string | null }>)
        .map((row) => readString(row.match_key).trim().toLowerCase())
        .filter((item) => item.length > 0),
    );

    return normalizedInputs.map((item) => ({
      input: item.input,
      matchKey: item.normalized,
      romanizedName: buildPersonaReferenceRomanizedName(item.input),
      exists: item.normalized.length > 0 && existingNames.has(item.normalized),
    }));
  }

  public async createPersona(input: {
    username?: string;
    persona: PersonaGenerationStructured["persona"];
    personaCore: Record<string, unknown>;
    referenceSources: PersonaGenerationStructured["reference_sources"];
    otherReferenceSources: PersonaGenerationStructured["other_reference_sources"];
    referenceDerivation: string[];
    originalizationNote: string;
    personaMemories?: Array<{
      memoryType: "memory" | "long_memory";
      scope: "persona" | "board" | "thread";
      content: string;
      metadata?: Record<string, unknown>;
      expiresAt?: string | null;
      importance?: number | null;
    }>;
  }): Promise<{ personaId: string }> {
    const username = input.username?.trim()
      ? normalizeUsernameInput(input.username, { isPersona: true })
      : derivePersonaUsername(input.persona.display_name);
    const canonicalPersonaCore = parsePersonaCore(input.personaCore);

    const { data: persona, error: personaError } = await this.supabase
      .from("personas")
      .insert({
        username,
        display_name: input.persona.display_name,
        bio: input.persona.bio,
        status: input.persona.status === "inactive" ? "inactive" : "active",
      })
      .select("id")
      .single<{ id: string }>();

    if (personaError || !persona) {
      throw new Error(`create persona failed: ${personaError?.message ?? "unknown"}`);
    }

    const personaId = persona.id;

    const { error: personaCoreError } = await this.supabase.from("persona_cores").upsert(
      {
        persona_id: personaId,
        core_profile: {
          ...canonicalPersonaCore,
          reference_sources: input.referenceSources,
          other_reference_sources: input.otherReferenceSources,
          reference_derivation: input.referenceDerivation,
          originalization_note: input.originalizationNote,
        },
        updated_at: nowIso(),
      },
      {
        onConflict: "persona_id",
      },
    );
    if (personaCoreError) {
      throw new Error(`save persona core failed: ${personaCoreError.message}`);
    }

    await this.replacePersonaReferenceSources(personaId, input.referenceSources);

    if (input.personaMemories && input.personaMemories.length > 0) {
      assertSinglePersonaLongMemory(input.personaMemories);
      const memoryRows = input.personaMemories
        .map((item) => ({
          persona_id: personaId,
          memory_type: item.memoryType,
          scope: item.scope,
          content: item.content.trim(),
          metadata: item.metadata ?? {},
          expires_at: item.expiresAt ?? null,
          importance: item.importance ?? null,
        }))
        .filter((item) => item.content.length > 0);
      if (memoryRows.length > 0) {
        const { error: memoryError } = await this.supabase
          .from("persona_memories")
          .insert(memoryRows);
        if (memoryError) {
          throw new Error(`save persona memory failed: ${memoryError.message}`);
        }
      }
    }

    return { personaId };
  }

  public async getPersonaProfile(personaId: string): Promise<PersonaProfile> {
    const { data: persona, error: personaError } = await this.supabase
      .from("personas")
      .select("id, username, display_name, bio, status")
      .eq("id", personaId)
      .single<PersonaSummary>();

    if (personaError || !persona) {
      throw new Error("persona not found");
    }

    const [personaCoreRes, memoryRes, longMemoryRes] = await Promise.all([
      this.supabase
        .from("persona_cores")
        .select("core_profile")
        .eq("persona_id", personaId)
        .maybeSingle<PersonaCoreRow>(),
      this.supabase
        .from("persona_memories")
        .select("id, scope, content, metadata, expires_at, created_at, updated_at")
        .eq("persona_id", personaId)
        .eq("memory_type", "memory")
        .in("scope", ["persona", "board"])
        .order("updated_at", { ascending: false })
        .limit(80),
      this.supabase
        .from("persona_memories")
        .select("id, content, metadata, expires_at, importance, updated_at, created_at")
        .eq("persona_id", personaId)
        .eq("memory_type", "long_memory")
        .eq("scope", "persona")
        .limit(1),
    ]);

    if (personaCoreRes.error) {
      throw new Error(`load persona core failed: ${personaCoreRes.error.message}`);
    }
    if (memoryRes.error) {
      throw new Error(`load persona memories failed: ${memoryRes.error.message}`);
    }
    if (longMemoryRes.error) {
      throw new Error(`load persona long memories failed: ${longMemoryRes.error.message}`);
    }

    return {
      persona,
      personaCore: personaCoreRes.data?.core_profile
        ? parseStoredPersonaCoreProfile(personaCoreRes.data.core_profile)
        : {},
      personaMemories: [
        ...((memoryRes.data ?? []) as PersonaMemoryStoreRow[]).map((row) => ({
          id: row.id,
          memoryType: "memory" as const,
          scope: row.scope,
          content: row.content,
          metadata: row.metadata ?? {},
          expiresAt: row.expires_at,
          importance: row.importance,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
        ...((longMemoryRes.data ?? []) as PersonaMemoryStoreRow[]).map((row) => ({
          id: row.id,
          memoryType: "long_memory" as const,
          scope: "persona" as const,
          content: row.content,
          metadata: row.metadata ?? {},
          expiresAt: row.expires_at,
          importance: row.importance,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      ],
    };
  }

  public async assistInteractionTaskContext(input: {
    modelId: string;
    taskType: "post" | "comment";
    personaId?: string;
    taskContext?: string;
  }): Promise<string> {
    const { providers, models } = await this.getActiveControlPlane();
    return assistInteractionTaskContext({
      ...input,
      providers,
      models,
      getPersonaProfile: (personaId) => this.getPersonaProfile(personaId),
      recordLlmInvocationError: (event) => this.recordLlmInvocationError(event),
    });
  }

  public async patchPersonaProfile(input: {
    personaId: string;
    displayName?: string;
    username?: string;
    bio?: string;
    personaCore?: Record<string, unknown>;
    referenceSources?: PersonaGenerationStructured["reference_sources"];
    otherReferenceSources?: PersonaGenerationStructured["other_reference_sources"];
    referenceDerivation?: string[];
    originalizationNote?: string;
    personaMemories?: Array<{
      memoryType: "memory" | "long_memory";
      scope: "persona" | "board" | "thread";
      content: string;
      metadata?: Record<string, unknown>;
      expiresAt?: string | null;
      importance?: number | null;
    }>;
  }): Promise<void> {
    const updates: Record<string, unknown> = {};
    if (input.displayName !== undefined) {
      const trimmedDisplayName = input.displayName.trim();
      if (!trimmedDisplayName) {
        throw new Error("display_name is required");
      }
      updates.display_name = trimmedDisplayName;
    }
    if (input.username !== undefined) {
      const normalizedUsername = normalizeUsernameInput(input.username, { isPersona: true });
      const validation = validateUsernameFormat(normalizedUsername, true);
      if (!validation.valid) {
        throw new Error(validation.error ?? "invalid persona username");
      }
      updates.username = normalizedUsername;
    }
    if (input.bio !== undefined) {
      const trimmedBio = input.bio.trim();
      if (!trimmedBio) {
        throw new Error("bio is required");
      }
      updates.bio = trimmedBio;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await this.supabase
        .from("personas")
        .update(updates)
        .eq("id", input.personaId);
      if (error) {
        throw new Error(`update persona failed: ${error.message}`);
      }
    }

    const hasCanonicalCoreUpdate =
      input.personaCore !== undefined ||
      input.referenceSources !== undefined ||
      input.otherReferenceSources !== undefined ||
      input.referenceDerivation !== undefined ||
      input.originalizationNote !== undefined;

    if (hasCanonicalCoreUpdate) {
      if (!input.personaCore) {
        throw new Error("personaCore is required when updating canonical persona data");
      }
      if (!input.referenceSources) {
        throw new Error("referenceSources is required when updating canonical persona data");
      }
      if (!input.referenceDerivation) {
        throw new Error("referenceDerivation is required when updating canonical persona data");
      }
      if (!input.otherReferenceSources) {
        throw new Error("otherReferenceSources is required when updating canonical persona data");
      }
      if (input.originalizationNote === undefined) {
        throw new Error("originalizationNote is required when updating canonical persona data");
      }
      const canonicalPersonaCore = parsePersonaCore(input.personaCore);
      const { error } = await this.supabase.from("persona_cores").upsert(
        {
          persona_id: input.personaId,
          core_profile: {
            ...canonicalPersonaCore,
            reference_sources: input.referenceSources,
            other_reference_sources: input.otherReferenceSources,
            reference_derivation: input.referenceDerivation,
            originalization_note: input.originalizationNote,
          },
          updated_at: nowIso(),
        },
        {
          onConflict: "persona_id",
        },
      );
      if (error) {
        throw new Error(`update persona core failed: ${error.message}`);
      }

      await this.replacePersonaReferenceSources(input.personaId, input.referenceSources);
    }

    if (input.personaMemories) {
      assertSinglePersonaLongMemory(input.personaMemories);
      const { error: deleteError } = await this.supabase
        .from("persona_memories")
        .delete()
        .eq("persona_id", input.personaId)
        .in("scope", ["persona", "board"]);
      if (deleteError) {
        throw new Error(`clear persona memories failed: ${deleteError.message}`);
      }

      const memoryRows = input.personaMemories
        .map((item) => ({
          persona_id: input.personaId,
          memory_type: item.memoryType,
          scope: item.scope,
          content: item.content.trim(),
          metadata: item.metadata ?? {},
          expires_at: item.expiresAt ?? null,
          importance: item.importance ?? null,
        }))
        .filter((item) => item.content.length > 0);

      if (memoryRows.length > 0) {
        const { error: memoryError } = await this.supabase
          .from("persona_memories")
          .insert(memoryRows);
        if (memoryError) {
          throw new Error(`update persona memories failed: ${memoryError.message}`);
        }
      }
    }
  }

  public async previewPersonaGeneration(input: { modelId: string; extraPrompt: string }): Promise<
    PreviewResult & {
      structured: PersonaGenerationStructured;
    }
  > {
    const { document, providers, models } = await this.getActiveControlPlane();
    return previewPersonaGeneration({
      ...input,
      document,
      providers,
      models,
      recordLlmInvocationError: (event) => this.recordLlmInvocationError(event),
    });
  }

  public async assistPersonaPrompt(input: {
    modelId: string;
    inputPrompt: string;
  }): Promise<string> {
    const { providers, models } = await this.getActiveControlPlane();
    return assistPersonaPrompt({
      ...input,
      providers,
      models,
      recordLlmInvocationError: (event) => this.recordLlmInvocationError(event),
    });
  }

  public async runPersonaInteraction(input: {
    personaId: string;
    modelId: string;
    taskType: PromptActionType;
    taskContext: string;
    boardContext?: PromptBoardContext;
    targetContext?: PromptTargetContext;
    boardContextText?: string;
    targetContextText?: string;
  }): Promise<PreviewResult> {
    const { document, providers, models } = await this.getActiveControlPlane();
    return new AiAgentPersonaInteractionService().run({
      ...input,
      document,
      providers,
      models,
      getPersonaProfile: (personaId) => this.getPersonaProfile(personaId),
      recordLlmInvocationError: (event) => this.recordLlmInvocationError(event),
    });
  }

  public async previewPersonaInteraction(input: {
    personaId: string;
    modelId: string;
    taskType: PromptActionType;
    taskContext: string;
    boardContext?: PromptBoardContext;
    targetContext?: PromptTargetContext;
  }): Promise<PreviewResult> {
    return previewPersonaInteraction({
      ...input,
      ...(await this.getActiveControlPlane()),
      getPersonaProfile: (personaId) => this.getPersonaProfile(personaId),
      recordLlmInvocationError: (event) => this.recordLlmInvocationError(event),
    });
  }

  private async loadActiveForMutation(): Promise<{
    active: PolicyReleaseRow | null;
    basePolicy: Record<string, unknown>;
    document: AiControlPlaneDocument;
    providers: AiProviderConfig[];
    models: AiModelConfig[];
  }> {
    const active = await this.fetchActiveRelease();
    const basePolicy = asRecord(active?.policy) ?? {};
    const document = readGlobalPolicyDocument(basePolicy);
    const [providers, models] = await Promise.all([
      this.listProvidersFromDb(),
      this.listModelsFromDb(),
    ]);
    await this.applyProviderSecretStatuses(providers);
    return {
      active,
      basePolicy,
      document,
      providers,
      models,
    };
  }

  private async applyProviderSecretStatuses(providers: AiProviderConfig[]): Promise<void> {
    const keys = providers.map((item) => item.providerKey.trim()).filter((item) => item.length > 0);
    if (keys.length === 0) {
      return;
    }

    const statusMap = await listProviderSecretStatuses(keys);
    for (const provider of providers) {
      const status = statusMap.get(provider.providerKey);
      if (!status) {
        provider.hasKey = false;
        provider.keyLast4 = null;
        if (provider.status !== "disabled") {
          provider.testStatus = "key_missing";
        }
        continue;
      }
      provider.hasKey = status.hasKey;
      provider.keyLast4 = status.keyLast4;
      if (provider.status !== "disabled" && provider.testStatus === "key_missing") {
        provider.testStatus = "untested";
      }
    }
  }

  private async fetchActiveRelease(): Promise<PolicyReleaseRow | null> {
    const { data, error } = await this.supabase
      .from("ai_policy_releases")
      .select("version, policy, is_active, created_by, change_note, created_at")
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle<PolicyReleaseRow>();

    if (error) {
      throw new Error(`load active policy release failed: ${error.message}`);
    }

    return data ?? null;
  }

  private async fetchReleaseByVersion(version: number): Promise<PolicyReleaseRow | null> {
    const { data, error } = await this.supabase
      .from("ai_policy_releases")
      .select("version, policy, is_active, created_by, change_note, created_at")
      .eq("version", version)
      .maybeSingle<PolicyReleaseRow>();

    if (error) {
      throw new Error(`load policy release failed: ${error.message}`);
    }

    return data ?? null;
  }

  private async insertActiveRelease(
    policy: Record<string, unknown>,
    actorId: string,
    note: string,
  ): Promise<PolicyReleaseRow> {
    const { error: deactivateError } = await this.supabase
      .from("ai_policy_releases")
      .update({ is_active: false })
      .eq("is_active", true);
    if (deactivateError) {
      throw new Error(`deactivate active release failed: ${deactivateError.message}`);
    }

    const { data, error } = await this.supabase
      .from("ai_policy_releases")
      .insert({
        policy,
        is_active: true,
        created_by: actorId,
        change_note: note,
      })
      .select("version, policy, is_active, created_by, change_note, created_at")
      .single<PolicyReleaseRow>();

    if (error || !data) {
      throw new Error(`insert active release failed: ${error?.message ?? "unknown"}`);
    }

    return data;
  }
}
