"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { apiDelete, apiFetchJson, apiPatch, apiPost, apiPut } from "@/lib/api/fetch-json";
import { getRouteModelIdsFromActiveOrder } from "@/lib/ai/admin/active-model-order";
import type {
  AiModelConfig,
  AiModelRoute,
  AiProviderConfig,
  PolicyReleaseListItem,
  PreviewResult,
  PersonaGenerationStructured,
} from "@/lib/ai/admin/control-plane-store";
import {
  type PersonaItem,
  type DraftState,
  type RouteDraftState,
  type ControlPlaneSection,
  SUPPORTED_MODELS,
  SUPPORTED_PROVIDERS,
} from "@/lib/ai/admin/control-plane-types";
import {
  buildInitialRouteDrafts,
  derivePersonaUsername,
  optionLabelForModel,
} from "@/components/admin/control-plane/control-plane-utils";

export interface UseAiControlPlaneProps {
  initialProviders: AiProviderConfig[];
  initialModels: AiModelConfig[];
  initialRoutes: AiModelRoute[];
  initialReleases: PolicyReleaseListItem[];
  initialPersonas: PersonaItem[];
}

export function useAiControlPlane({
  initialProviders,
  initialModels,
  initialRoutes,
  initialReleases,
  initialPersonas,
}: UseAiControlPlaneProps) {
  const [activeSection, setActiveSection] = useState<ControlPlaneSection>("providers_models");
  const [providers, setProviders] = useState(initialProviders);
  const [models, setModels] = useState(initialModels);
  const [routes, setRoutes] = useState(initialRoutes);
  const [releases, setReleases] = useState(initialReleases);
  const [personas, setPersonas] = useState(initialPersonas);
  const [routeDrafts, setRouteDrafts] = useState<RouteDraftState>(
    buildInitialRouteDrafts(initialRoutes),
  );

  const [providerForm, setProviderForm] = useState({
    providerKey: "xai",
    displayName: "xAI",
    sdkPackage: "@ai-sdk/xai",
    apiKey: "",
  });

  const [modelForm, setModelForm] = useState({
    providerId: initialProviders[0]?.id ?? "",
    modelKey: "",
    displayName: "",
    capability: "text_generation" as "text_generation" | "image_generation",
  });

  const latestRelease = releases[0] ?? null;
  const activeRelease = releases.find((item) => item.isActive) ?? null;
  const latestPolicyVersion = releases.reduce(
    (max, item) => (item.policyVersion > max ? item.policyVersion : max),
    1,
  );

  const [draft, setDraft] = useState<DraftState>({
    policyVersion: latestPolicyVersion,
    coreGoal: latestRelease?.globalPolicyDraft.coreGoal ?? "",
    globalPolicy: latestRelease?.globalPolicyDraft.globalPolicy ?? "",
    styleGuide: latestRelease?.globalPolicyDraft.styleGuide ?? "",
    forbiddenRules: latestRelease?.globalPolicyDraft.forbiddenRules ?? "",
    note: "",
  });

  const [policyPreviewInput, setPolicyPreviewInput] = useState({
    releaseId: latestRelease?.version ? String(latestRelease.version) : "",
    modelId: initialModels.find((model) => model.capability === "text_generation")?.id ?? "",
    taskContext: "Draft a forum comment preview.",
  });
  const [policyPreview, setPolicyPreview] = useState<PreviewResult | null>(null);

  const initialPersonaGenerationModelId =
    initialModels.find((model) => {
      const provider = initialProviders.find((item) => item.id === model.providerId);
      return (
        model.capability === "text_generation" &&
        model.status === "active" &&
        provider?.status === "active" &&
        provider?.hasKey
      );
    })?.id ?? "";

  const [personaGeneration, setPersonaGeneration] = useState({
    modelId: initialPersonaGenerationModelId,
    extraPrompt: "Generate a witty but respectful creator persona.",
  });
  const [personaGenerationLoading, setPersonaGenerationLoading] = useState(false);
  const [personaSaveLoading, setPersonaSaveLoading] = useState(false);
  const [personaPreviewRunCount, setPersonaPreviewRunCount] = useState(0);
  const [personaSaveForm, setPersonaSaveForm] = useState({
    displayName: "AI Persona Draft",
    username: "ai_persona_draft",
  });
  const [personaGenerationPreview, setPersonaGenerationPreview] = useState<
    (PreviewResult & { structured: PersonaGenerationStructured }) | null
  >(null);
  const [personaLastSavedAt, setPersonaLastSavedAt] = useState<string | null>(null);

  const [interactionInput, setInteractionInput] = useState({
    personaId: initialPersonas[0]?.id ?? "",
    modelId: initialModels.find((item) => item.capability === "text_generation")?.id ?? "",
    taskType: "comment" as "post" | "comment",
    taskContext: "Reply to a user asking for critique on their concept art draft.",
    soulOverrideJson: "",
    longMemoryOverride: "",
  });
  const [interactionPreview, setInteractionPreview] = useState<PreviewResult | null>(null);

  useEffect(() => {
    setRouteDrafts(buildInitialRouteDrafts(routes));
  }, [routes]);

  const textModels = useMemo(
    () => models.filter((item) => item.capability === "text_generation"),
    [models],
  );

  const personaGenerationModels = useMemo(
    () =>
      models.filter((model) => {
        const provider = providers.find((item) => item.id === model.providerId);
        return (
          model.capability === "text_generation" &&
          model.status === "active" &&
          provider?.status === "active" &&
          provider?.hasKey
        );
      }),
    [models, providers],
  );

  const selectedPersona = useMemo(
    () => personas.find((item) => item.id === interactionInput.personaId) ?? null,
    [personas, interactionInput.personaId],
  );

  const buildDerivedRoutesFromActiveOrder = (
    nextProviders: AiProviderConfig[],
    nextModels: AiModelConfig[],
    currentRoutes: AiModelRoute[] = routes,
  ): AiModelRoute[] => {
    const textModelIds = getRouteModelIdsFromActiveOrder({
      providers: nextProviders.map((provider) => ({
        id: provider.id,
        providerKey: provider.providerKey,
        status: provider.status,
        hasKey: provider.hasKey,
      })),
      models: nextModels.map((model) => ({
        id: model.id,
        providerId: model.providerId,
        modelKey: model.modelKey,
        capability: model.capability,
        status: model.status,
        testStatus: model.testStatus,
        lifecycleStatus: model.lifecycleStatus,
        displayOrder: model.displayOrder,
      })),
      capability: "text_generation",
    });

    const imageModelIds = getRouteModelIdsFromActiveOrder({
      providers: nextProviders.map((provider) => ({
        id: provider.id,
        providerKey: provider.providerKey,
        status: provider.status,
        hasKey: provider.hasKey,
      })),
      models: nextModels.map((model) => ({
        id: model.id,
        providerId: model.providerId,
        modelKey: model.modelKey,
        capability: model.capability,
        status: model.status,
        testStatus: model.testStatus,
        lifecycleStatus: model.lifecycleStatus,
        displayOrder: model.displayOrder,
      })),
      capability: "image_generation",
    });

    const now = new Date().toISOString();
    const map = new Map(currentRoutes.map((route) => [route.scope, route]));
    const scopes: AiModelRoute["scope"][] = ["global_default", "image"];

    return scopes.map((scope) => {
      const existing = map.get(scope);
      const source = scope === "image" ? imageModelIds : textModelIds;
      return {
        scope,
        orderedModelIds: source,
        updatedAt: existing?.updatedAt ?? now,
      };
    });
  };

  const refreshAll = async () => {
    try {
      const [providersRes, modelsRes, releasesRes, personasRes] = await Promise.all([
        apiFetchJson<{ items: AiProviderConfig[] }>("/api/admin/ai/providers"),
        apiFetchJson<{ items: AiModelConfig[] }>("/api/admin/ai/models"),
        apiFetchJson<{ items: PolicyReleaseListItem[] }>("/api/admin/ai/policy-releases"),
        apiFetchJson<{ items: PersonaItem[] }>("/api/admin/ai/personas?limit=50"),
      ]);
      setProviders(providersRes.items);
      setModels(modelsRes.items);
      setRoutes((prev) =>
        buildDerivedRoutesFromActiveOrder(providersRes.items, modelsRes.items, prev),
      );
      setReleases(releasesRes.items);
      setPersonas(personasRes.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refresh failed");
    }
  };

  const createProvider = async () => {
    if (
      !providerForm.providerKey.trim() ||
      !providerForm.displayName.trim() ||
      !providerForm.sdkPackage.trim()
    ) {
      toast.error("providerKey/displayName/sdkPackage are required");
      return;
    }
    try {
      await apiPost("/api/admin/ai/providers", providerForm);
      toast.success("Provider saved");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create provider");
    }
  };

  const createSupportedProvider = async (
    providerKey: (typeof SUPPORTED_PROVIDERS)[number]["id"],
    apiKey: string,
  ) => {
    const supported = SUPPORTED_PROVIDERS.find((item) => item.id === providerKey);
    if (!supported) {
      toast.error("Unsupported provider");
      return;
    }

    try {
      const existing = providers.find((item) => item.providerKey === providerKey);
      if (existing) {
        await apiPatch("/api/admin/ai/providers", {
          id: existing.id,
          providerKey: existing.providerKey,
          displayName: supported.displayName,
          sdkPackage: supported.sdkPackage,
          status: "active",
          apiKey: apiKey.trim() || undefined,
        });
        toast.success("Provider updated");
      } else {
        await apiPost("/api/admin/ai/providers", {
          providerKey,
          displayName: supported.displayName,
          sdkPackage: supported.sdkPackage,
          status: "active",
          apiKey: apiKey.trim() || undefined,
        });
        toast.success("Provider created");
      }
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save provider");
    }
  };

  const readModelTestStatus = (model: AiModelConfig): "untested" | "success" | "failed" => {
    return model.testStatus;
  };

  const readDisplayOrder = (model: AiModelConfig): number => {
    return typeof model.displayOrder === "number" && Number.isFinite(model.displayOrder)
      ? model.displayOrder
      : 999;
  };

  const buildActiveOrderedModelIds = (
    nextModels: AiModelConfig[],
    capability: "text_generation" | "image_generation",
  ): string[] => {
    return getRouteModelIdsFromActiveOrder({
      providers: providers.map((provider) => ({
        id: provider.id,
        providerKey: provider.providerKey,
        status: provider.status,
        hasKey: provider.hasKey,
      })),
      models: nextModels.map((model) => ({
        id: model.id,
        providerId: model.providerId,
        modelKey: model.modelKey,
        capability: model.capability,
        status: model.status,
        testStatus: model.testStatus,
        lifecycleStatus: model.lifecycleStatus,
        displayOrder: model.displayOrder,
        supportsImageInputPrompt: model.supportsImageInputPrompt,
      })),
      capability,
    });
  };

  const syncRoutesFromActiveModelOrder = async (nextModels: AiModelConfig[]) => {
    const textModelIds = buildActiveOrderedModelIds(nextModels, "text_generation");
    const imageModelIds = buildActiveOrderedModelIds(nextModels, "image_generation");

    await apiPut("/api/admin/ai/model-routes", {
      routes: [
        {
          scope: "global_default",
          orderedModelIds: textModelIds,
        },
        {
          scope: "image",
          orderedModelIds: imageModelIds,
        },
      ],
    });
  };

  const runModelTest = async (modelId: string) => {
    const model = models.find((item) => item.id === modelId);
    if (!model) {
      toast.error("Model not found");
      return;
    }
    const provider = providers.find((item) => item.id === model.providerId);
    if (!provider) {
      toast.error("Provider not found");
      return;
    }

    const nextStatus = provider.hasKey && provider.testStatus === "success" ? "success" : "failed";
    try {
      await apiPatch("/api/admin/ai/models", {
        id: model.id,
        providerId: model.providerId,
        modelKey: model.modelKey,
        displayName: model.displayName,
        capability: model.capability,
        status: model.status,
        testStatus: nextStatus,
        lifecycleStatus: nextStatus === "success" ? "active" : model.lifecycleStatus,
        displayOrder: model.displayOrder,
        lastErrorKind: nextStatus === "success" ? null : model.lastErrorKind,
        lastErrorCode: nextStatus === "success" ? null : model.lastErrorCode,
        lastErrorMessage: nextStatus === "success" ? null : model.lastErrorMessage,
        lastErrorAt: nextStatus === "success" ? null : model.lastErrorAt,
        metadata: {
          ...model.metadata,
          modelTestedAt: new Date().toISOString(),
        },
      });
      toast.success(`Model test ${nextStatus}`);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to test model");
    }
  };

  const setModelActive = async (modelId: string, nextActive: boolean) => {
    const model = models.find((item) => item.id === modelId);
    if (!model) {
      toast.error("Model not found");
      return;
    }
    const provider = providers.find((item) => item.id === model.providerId);
    if (!provider) {
      toast.error("Provider not found");
      return;
    }

    if (nextActive) {
      if (model.lifecycleStatus === "retired") {
        toast.error("Retired model cannot be activated");
        return;
      }
      if (!provider.hasKey) {
        toast.error("Provider API key is required before activating model");
        return;
      }
      if (readModelTestStatus(model) !== "success") {
        toast.error("Model test must pass before activating");
        return;
      }
    }

    try {
      await apiPatch("/api/admin/ai/models", {
        id: model.id,
        providerId: model.providerId,
        modelKey: model.modelKey,
        displayName: model.displayName,
        capability: model.capability,
        status: nextActive ? "active" : "disabled",
        testStatus: model.testStatus,
        lifecycleStatus: model.lifecycleStatus,
        displayOrder: model.displayOrder,
        lastErrorKind: model.lastErrorKind,
        lastErrorCode: model.lastErrorCode,
        lastErrorMessage: model.lastErrorMessage,
        lastErrorAt: model.lastErrorAt,
        metadata: model.metadata,
      });
      toast.success(nextActive ? "Model activated" : "Model deactivated");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update model status");
    }
  };

  const runProviderTest = async (providerId: string) => {
    try {
      await apiPost(`/api/admin/ai/providers/${providerId}/test`, {});
      toast.success("Provider test triggered");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to test provider");
    }
  };

  const removeProvider = async (providerId: string) => {
    try {
      await apiDelete(`/api/admin/ai/providers?id=${encodeURIComponent(providerId)}`);
      toast.success("Provider removed");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove provider");
    }
  };

  const createModel = async () => {
    if (!modelForm.providerId || !modelForm.modelKey.trim() || !modelForm.displayName.trim()) {
      toast.error("provider/model/display name are required");
      return;
    }
    try {
      await apiPost("/api/admin/ai/models", modelForm);
      toast.success("Model saved");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save model");
    }
  };

  const configureSupportedModels = async (input: {
    textModelKeys: string[];
    imageModelKeys: string[];
  }) => {
    try {
      const selectedKeys = [...input.textModelKeys, ...input.imageModelKeys];
      const selectedSet = new Set(selectedKeys);
      const nextModels = [...models];

      for (const key of selectedKeys) {
        const supported = SUPPORTED_MODELS.find((model) => model.modelKey === key);
        if (!supported) {
          continue;
        }

        const provider = providers.find((item) => item.providerKey === supported.providerId);
        if (!provider) {
          toast.error(`Provider ${supported.providerId} not found. Add provider first.`);
          return;
        }

        const existing = models.find(
          (item) => item.providerId === provider.id && item.modelKey === supported.modelKey,
        );
        const payload = {
          providerId: provider.id,
          modelKey: supported.modelKey,
          displayName: supported.displayName,
          capability: supported.capability,
          status: (existing?.status ?? "disabled") as "active" | "disabled",
          testStatus: existing?.testStatus ?? "untested",
          lifecycleStatus: existing?.lifecycleStatus ?? "active",
          displayOrder: existing?.displayOrder ?? 999,
          lastErrorKind: existing?.lastErrorKind ?? null,
          lastErrorCode: existing?.lastErrorCode ?? null,
          lastErrorMessage: existing?.lastErrorMessage ?? null,
          lastErrorAt: existing?.lastErrorAt ?? null,
          supportsImageInputPrompt:
            existing?.supportsImageInputPrompt ??
            (Array.isArray(supported.metadata.input) && supported.metadata.input.includes("image")),
          metadata: supported.metadata,
        };

        if (existing) {
          const res = await apiPatch<{ item: AiModelConfig }>("/api/admin/ai/models", {
            id: existing.id,
            ...payload,
          });
          const index = nextModels.findIndex((item) => item.id === existing.id);
          if (index >= 0) {
            nextModels[index] = res.item;
          }
        } else {
          const res = await apiPost<{ item: AiModelConfig }>("/api/admin/ai/models", payload);
          nextModels.push(res.item);
        }
      }

      const supportedModelKeySet = new Set<string>(SUPPORTED_MODELS.map((item) => item.modelKey));
      const modelsToDisable = models.filter(
        (item) => supportedModelKeySet.has(item.modelKey) && !selectedSet.has(item.modelKey),
      );

      for (const model of modelsToDisable) {
        const res = await apiPatch<{ item: AiModelConfig }>("/api/admin/ai/models", {
          id: model.id,
          providerId: model.providerId,
          modelKey: model.modelKey,
          displayName: model.displayName,
          capability: model.capability,
          status: "disabled",
          testStatus: model.testStatus,
          lifecycleStatus: model.lifecycleStatus,
          displayOrder: model.displayOrder,
          lastErrorKind: model.lastErrorKind,
          lastErrorCode: model.lastErrorCode,
          lastErrorMessage: model.lastErrorMessage,
          lastErrorAt: model.lastErrorAt,
          metadata: model.metadata,
        });
        const index = nextModels.findIndex((item) => item.id === model.id);
        if (index >= 0) {
          nextModels[index] = res.item;
        }
      }

      await syncRoutesFromActiveModelOrder(nextModels);

      toast.success("Models and routes updated");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to configure models");
    }
  };

  const reorderModels = async (
    capability: "text_generation" | "image_generation",
    orderedModelKeys: string[],
  ) => {
    try {
      const normalizedKeys = orderedModelKeys.filter(
        (key, index, arr) => key.trim().length > 0 && arr.indexOf(key) === index,
      );

      const res = await apiPut<{ items: AiModelConfig[]; routes: AiModelRoute[] }>(
        "/api/admin/ai/models",
        {
          capability,
          orderedModelKeys: normalizedKeys,
        },
      );
      setModels(res.items);
      setRoutes(res.routes);

      toast.success("Model order updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reorder models");
    }
  };

  const removeModel = async (modelId: string) => {
    try {
      await apiDelete(`/api/admin/ai/models?id=${encodeURIComponent(modelId)}`);
      toast.success("Model removed");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove model");
    }
  };

  const saveRoute = async (_scope: AiModelRoute["scope"]) => {
    try {
      await syncRoutesFromActiveModelOrder(models);
      toast.success("Routes synced from active model order");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync routes");
    }
  };

  const createDraft = async () => {
    try {
      const res = await apiPost<{ item: PolicyReleaseListItem }>("/api/admin/ai/policy-releases", {
        policyVersion: draft.policyVersion,
        coreGoal: draft.coreGoal,
        globalPolicy: draft.globalPolicy,
        styleGuide: draft.styleGuide,
        forbiddenRules: draft.forbiddenRules,
        note: draft.note,
      });
      toast.success(`Policy saved (v${res.item.policyVersion})`);
      setPolicyPreviewInput((prev) => ({ ...prev, releaseId: String(res.item.version) }));
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save policy");
    }
  };

  const runPolicyPreview = async () => {
    if (!policyPreviewInput.releaseId || !policyPreviewInput.modelId) {
      toast.error("release and model are required");
      return;
    }
    try {
      const res = await apiPost<{ preview: PreviewResult }>(
        `/api/admin/ai/policy-releases/${policyPreviewInput.releaseId}/preview`,
        {
          modelId: policyPreviewInput.modelId,
          taskContext: policyPreviewInput.taskContext,
        },
      );
      setPolicyPreview(res.preview);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to run preview");
    }
  };

  const publishRelease = async (releaseId: number) => {
    try {
      await apiPost(`/api/admin/ai/policy-releases/${releaseId}/publish`, {
        note: draft.note || "manual publish",
      });
      toast.success(`Release #${releaseId} published`);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish release");
    }
  };

  const rollbackRelease = async (releaseId: number) => {
    try {
      await apiPost(`/api/admin/ai/policy-releases/${releaseId}/rollback`, {
        note: `rollback to release ${releaseId}`,
      });
      toast.success(`Rollback to release #${releaseId} complete`);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rollback release");
    }
  };

  const runPersonaGenerationPreview = async () => {
    if (!personaGeneration.modelId) {
      toast.error("model is required");
      return;
    }
    if (!personaGenerationModels.some((item) => item.id === personaGeneration.modelId)) {
      toast.error("Selected model is unavailable. Use a model with configured API key.");
      return;
    }
    setPersonaGenerationLoading(true);
    try {
      const res = await apiPost<{
        preview: PreviewResult & { structured: PersonaGenerationStructured };
      }>("/api/admin/ai/persona-generation/preview", personaGeneration);
      setPersonaGenerationPreview(res.preview);
      const generatedDisplayName =
        res.preview.structured.personas.display_name || "AI Persona Draft";
      setPersonaSaveForm({
        displayName: generatedDisplayName,
        username: derivePersonaUsername(generatedDisplayName),
      });
      setPersonaPreviewRunCount((prev) => prev + 1);
      toast.success("Persona preview generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate preview");
    } finally {
      setPersonaGenerationLoading(false);
    }
  };

  const savePersonaFromGeneration = async () => {
    if (!personaGenerationPreview) {
      toast.error("Run persona generation preview first");
      return;
    }

    const username = `ai_${Date.now().toString().slice(-6)}`;
    setPersonaSaveLoading(true);
    try {
      await apiPost("/api/admin/ai/personas", {
        username: personaSaveForm.username || username,
        displayName: personaSaveForm.displayName || "AI Persona Draft",
        bio: personaGenerationPreview.structured.personas.bio,
        soulProfile: personaGenerationPreview.structured.persona_souls.soul_profile,
        memories: personaGenerationPreview.structured.persona_memory.map((item) => ({
          key: item.key,
          value: item.value,
          contextData: item.context_data,
          expiresAt:
            item.expires_in_hours && item.expires_in_hours > 0
              ? new Date(Date.now() + item.expires_in_hours * 3600_000).toISOString()
              : null,
        })),
        longMemories: personaGenerationPreview.structured.persona_long_memories.map((item) => ({
          content: item.content,
          importance: item.importance,
          memoryCategory: item.memory_category,
          isCanonical: item.is_canonical,
          relatedBoardSlug: item.related_board_slug,
        })),
      });
      toast.success("Persona saved to DB");
      setPersonaLastSavedAt(new Date().toISOString());
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save persona");
    } finally {
      setPersonaSaveLoading(false);
    }
  };

  const runInteractionPreview = async () => {
    if (!interactionInput.personaId || !interactionInput.modelId) {
      toast.error("persona/model are required");
      return;
    }

    let soulOverride: Record<string, unknown> | undefined;
    if (interactionInput.soulOverrideJson.trim()) {
      try {
        const parsed = JSON.parse(interactionInput.soulOverrideJson);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          toast.error("Soul override must be a JSON object");
          return;
        }
        soulOverride = parsed as Record<string, unknown>;
      } catch {
        toast.error("Soul override JSON is invalid");
        return;
      }
    }

    try {
      const res = await apiPost<{ preview: PreviewResult }>(
        "/api/admin/ai/persona-interaction/preview",
        {
          personaId: interactionInput.personaId,
          modelId: interactionInput.modelId,
          taskType: interactionInput.taskType,
          taskContext: interactionInput.taskContext,
          soulOverride,
          longMemoryOverride: interactionInput.longMemoryOverride.trim() || undefined,
        },
      );
      setInteractionPreview(res.preview);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to run interaction preview");
    }
  };

  const resolveRoutePrimaryModelId = (_scope: "post" | "comment") => {
    return buildActiveOrderedModelIds(models, "text_generation")[0] ?? "";
  };

  const applyRoutePrimaryModel = () => {
    const modelId = resolveRoutePrimaryModelId(interactionInput.taskType);
    if (!modelId) {
      toast.error("No primary route model found for selected task type");
      return;
    }
    setInteractionInput((prev) => ({ ...prev, modelId }));
    toast.success("Applied route primary model");
  };

  const routePrimaryModelLabel = () => {
    const modelId = resolveRoutePrimaryModelId(interactionInput.taskType);
    if (!modelId) {
      return "Not configured";
    }
    const model = models.find((item) => item.id === modelId);
    return model ? optionLabelForModel(model, providers) : "Unknown model";
  };

  const personaStepStatus = {
    generated: personaPreviewRunCount > 0,
    saved: Boolean(personaLastSavedAt),
  };

  return {
    activeSection,
    setActiveSection,
    providers,
    models,
    routes,
    releases,
    personas,
    routeDrafts,
    setRouteDrafts,
    providerForm,
    setProviderForm,
    modelForm,
    setModelForm,
    draft,
    setDraft,
    policyPreviewInput,
    setPolicyPreviewInput,
    policyPreview,
    personaGeneration,
    setPersonaGeneration,
    personaGenerationLoading,
    personaPreviewRunCount,
    personaLastSavedAt,
    personaSaveLoading,
    personaSaveForm,
    setPersonaSaveForm,
    personaGenerationPreview,
    interactionInput,
    setInteractionInput,
    interactionPreview,
    latestRelease,
    activeRelease,
    textModels,
    personaGenerationModels,
    selectedPersona,
    refreshAll,
    createProvider,
    createSupportedProvider,
    runProviderTest,
    runModelTest,
    setModelActive,
    removeProvider,
    createModel,
    configureSupportedModels,
    reorderModels,
    removeModel,
    saveRoute,
    createDraft,
    runPolicyPreview,
    publishRelease,
    rollbackRelease,
    runPersonaGenerationPreview,
    savePersonaFromGeneration,
    runInteractionPreview,
    applyRoutePrimaryModel,
    routePrimaryModelLabel,
    personaStepStatus,
  };
}
