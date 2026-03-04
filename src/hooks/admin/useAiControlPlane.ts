"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { apiDelete, apiFetchJson, apiPatch, apiPost, apiPut } from "@/lib/api/fetch-json";
import { getRouteModelIdsFromActiveOrder } from "@/lib/ai/admin/active-model-order";
import type {
  AdminControlPlaneSnapshot,
  AiModelConfig,
  AiProviderConfig,
  PolicyReleaseListItem,
  PreviewResult,
  PersonaGenerationStructured,
} from "@/lib/ai/admin/control-plane-store";
import {
  type PersonaItem,
  type DraftState,
  type ControlPlaneSection,
  SUPPORTED_MODELS,
  SUPPORTED_PROVIDERS,
} from "@/lib/ai/admin/control-plane-types";
import {
  derivePersonaUsername,
  optionLabelForModel,
} from "@/components/admin/control-plane/control-plane-utils";

export interface UseAiControlPlaneProps {
  initialProviders: AiProviderConfig[];
  initialModels: AiModelConfig[];
  initialReleases: PolicyReleaseListItem[];
  initialPersonas: PersonaItem[];
}

export function useAiControlPlane({
  initialProviders,
  initialModels,
  initialReleases,
  initialPersonas,
}: UseAiControlPlaneProps) {
  const [activeSection, setActiveSection] = useState<ControlPlaneSection>("providers");
  const [providers, setProviders] = useState(initialProviders);
  const [models, setModels] = useState(initialModels);
  const [releases, setReleases] = useState(initialReleases);
  const [personas, setPersonas] = useState(initialPersonas);

  const latestRelease = releases[0] ?? null;
  const activeRelease = releases.find((item) => item.isActive) ?? null;
  const latestPolicyVersion = releases.reduce(
    (max, item) => (item.version > max ? item.version : max),
    1,
  );

  const [draft, setDraft] = useState<DraftState>({
    selectedVersion: activeRelease?.version ?? latestPolicyVersion,
    systemBaseline: latestRelease?.globalPolicyDraft.systemBaseline ?? "",
    globalPolicy: latestRelease?.globalPolicyDraft.globalPolicy ?? "",
    styleGuide: latestRelease?.globalPolicyDraft.styleGuide ?? "",
    forbiddenRules: latestRelease?.globalPolicyDraft.forbiddenRules ?? "",
    note: "",
  });

  const [policyPreviewInput, setPolicyPreviewInput] = useState({
    version: latestRelease?.version ? String(latestRelease.version) : "",
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
  const [modelTestImageLinks, setModelTestImageLinks] = useState<Record<string, string>>({});

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

  const refreshAll = async () => {
    try {
      const snapshot = await apiFetchJson<AdminControlPlaneSnapshot>(
        "/api/admin/ai/control-plane?releaseLimit=50",
      );
      setProviders(snapshot.providers);
      setModels(snapshot.models);
      setReleases(snapshot.releases);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refresh failed");
    }
  };

  const refreshPersonas = async () => {
    try {
      const personasRes = await apiFetchJson<{ items: PersonaItem[] }>(
        "/api/admin/ai/personas?limit=50",
      );
      setPersonas(personasRes.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refresh personas failed");
    }
  };

  const upsertProviderInList = (source: AiProviderConfig[], item: AiProviderConfig) => {
    const index = source.findIndex((provider) => provider.id === item.id);
    return index >= 0
      ? source.map((provider) => (provider.id === item.id ? item : provider))
      : [...source, item];
  };

  const applyProviderItem = (item: AiProviderConfig) => {
    setProviders((prev) => upsertProviderInList(prev, item));
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
        const res = await apiPatch<{ item: AiProviderConfig }>("/api/admin/ai/providers", {
          id: existing.id,
          providerKey: existing.providerKey,
          displayName: supported.displayName,
          sdkPackage: supported.sdkPackage,
          status: "active",
          apiKey: apiKey.trim() || undefined,
        });
        applyProviderItem(res.item);
        await refreshAll();
        toast.success("Provider updated");
      } else {
        const res = await apiPost<{ item: AiProviderConfig }>("/api/admin/ai/providers", {
          providerKey,
          displayName: supported.displayName,
          sdkPackage: supported.sdkPackage,
          status: "active",
          apiKey: apiKey.trim() || undefined,
        });
        applyProviderItem(res.item);
        await refreshAll();
        toast.success("Provider created");
      }
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

  const runModelTest = async (input: {
    capability: "text_generation" | "image_generation";
    modelKey: string;
  }) => {
    const supported = SUPPORTED_MODELS.find(
      (item) => item.capability === input.capability && item.modelKey === input.modelKey,
    );
    if (!supported) {
      toast.error("Unsupported model");
      return;
    }

    const providerCandidates = providers.filter(
      (item) => item.providerKey === supported.providerId,
    );
    const provider =
      providerCandidates.find((item) => item.hasKey) ??
      providerCandidates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ??
      null;
    if (!provider) {
      toast.error(`Provider ${supported.providerId} not found`);
      return;
    }
    if (!provider.hasKey) {
      toast.error("Provider API key is required before test");
      return;
    }

    try {
      let resolvedModel =
        models.find(
          (item) => item.providerId === provider.id && item.modelKey === supported.modelKey,
        ) ?? null;

      if (!resolvedModel) {
        const createRes = await apiPost<{ item: AiModelConfig }>("/api/admin/ai/models", {
          providerId: provider.id,
          modelKey: supported.modelKey,
          displayName: supported.displayName,
          capability: supported.capability,
          status: "disabled",
          testStatus: "untested",
          lifecycleStatus: "active",
          supportsImageInputPrompt: Array.isArray(supported.metadata.input)
            ? supported.metadata.input.includes("image")
            : false,
          metadata: supported.metadata,
        });
        resolvedModel = createRes.item;
        setModels((prev) => [...prev, createRes.item]);
      }

      const res = await apiPost<{
        item: AiModelConfig;
        provider: AiProviderConfig;
        artifact?: { imageDataUrl?: string } | null;
      }>(`/api/admin/ai/models/${resolvedModel.id}/test`, {});
      setModels((prev) => prev.map((item) => (item.id === res.item.id ? res.item : item)));
      setProviders((prev) =>
        prev.map((item) => (item.id === res.provider.id ? res.provider : item)),
      );
      setModelTestImageLinks((prev) => {
        const next = { ...prev };
        if (res.artifact?.imageDataUrl) {
          next[res.item.id] = res.artifact.imageDataUrl;
        } else {
          delete next[res.item.id];
        }
        return next;
      });
      toast.success(`Model test ${res.item.testStatus}`);
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

  const reorderModels = async (
    capability: "text_generation" | "image_generation",
    orderedModelKeys: string[],
  ) => {
    try {
      const normalizedKeys = orderedModelKeys.filter(
        (key, index, arr) => key.trim().length > 0 && arr.indexOf(key) === index,
      );

      const res = await apiPut<{ items: AiModelConfig[] }>("/api/admin/ai/models", {
        capability,
        orderedModelKeys: normalizedKeys,
      });
      setModels(res.items);

      toast.success("Model order updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reorder models");
    }
  };

  const createDraft = async () => {
    try {
      const res = await apiPost<{ item: PolicyReleaseListItem }>("/api/admin/ai/policy-releases", {
        action: "update",
        version: draft.selectedVersion,
        systemBaseline: draft.systemBaseline,
        globalPolicy: draft.globalPolicy,
        styleGuide: draft.styleGuide,
        forbiddenRules: draft.forbiddenRules,
        note: draft.note,
      });
      toast.success(`Policy updated (v${res.item.version})`);
      setPolicyPreviewInput((prev) => ({ ...prev, version: String(res.item.version) }));
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save policy");
    }
  };

  const publishNextVersion = async () => {
    try {
      const res = await apiPost<{ item: PolicyReleaseListItem }>("/api/admin/ai/policy-releases", {
        action: "publish",
        version: draft.selectedVersion,
        systemBaseline: draft.systemBaseline,
        globalPolicy: draft.globalPolicy,
        styleGuide: draft.styleGuide,
        forbiddenRules: draft.forbiddenRules,
        note: draft.note,
      });
      toast.success(`Policy published (v${res.item.version})`);
      setPolicyPreviewInput((prev) => ({ ...prev, version: String(res.item.version) }));
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish policy");
    }
  };

  const runPolicyPreview = async () => {
    if (!policyPreviewInput.version) {
      toast.error("version is required");
      return;
    }
    try {
      const res = await apiPost<{ preview: PreviewResult }>(
        `/api/admin/ai/policy-releases/${policyPreviewInput.version}/preview`,
        {
          taskContext: policyPreviewInput.taskContext,
        },
      );
      setPolicyPreview(res.preview);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to run preview");
    }
  };

  const previewSelectedPolicyDraft = async () => {
    const version = String(draft.selectedVersion);
    const taskContext =
      policyPreviewInput.taskContext.trim() || "Preview prompt assembled from policy draft.";
    setPolicyPreviewInput({
      version,
      taskContext,
    });

    try {
      const res = await apiPost<{ preview: PreviewResult }>(
        `/api/admin/ai/policy-releases/${version}/preview`,
        {
          taskContext,
        },
      );
      setPolicyPreview(res.preview);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to run preview");
    }
  };

  const rollbackRelease = async (version: number) => {
    try {
      await apiPost(`/api/admin/ai/policy-releases/${version}/rollback`, {
        note: `rollback to version ${version}`,
      });
      toast.success(`Rollback to version ${version} complete`);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rollback release");
    }
  };

  const deletePolicyRelease = async (version: number) => {
    try {
      await apiDelete(
        `/api/admin/ai/policy-releases?version=${encodeURIComponent(String(version))}`,
      );
      toast.success(`Version ${version} deleted`);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete release");
    }
  };

  const viewPolicyVersion = (version: number) => {
    const selected = releases.find((item) => item.version === version);
    if (!selected) {
      toast.error("Version not found");
      return;
    }
    setDraft((prev) => ({
      ...prev,
      selectedVersion: selected.version,
      systemBaseline: selected.globalPolicyDraft.systemBaseline ?? "",
      globalPolicy: selected.globalPolicyDraft.globalPolicy ?? "",
      styleGuide: selected.globalPolicyDraft.styleGuide ?? "",
      forbiddenRules: selected.globalPolicyDraft.forbiddenRules ?? "",
    }));
    setPolicyPreviewInput((prev) => ({ ...prev, version: String(selected.version) }));
  };

  useEffect(() => {
    if (!releases.some((item) => item.version === draft.selectedVersion)) {
      const fallback = activeRelease ?? releases[0] ?? null;
      if (fallback) {
        viewPolicyVersion(fallback.version);
      }
    }
  }, [releases, activeRelease, draft.selectedVersion]);

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
      await refreshPersonas();
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
    return (
      getRouteModelIdsFromActiveOrder({
        providers: providers.map((provider) => ({
          id: provider.id,
          providerKey: provider.providerKey,
          status: provider.status,
          hasKey: provider.hasKey,
        })),
        models: models.map((model) => ({
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
        capability: "text_generation",
      })[0] ?? ""
    );
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
    releases,
    personas,
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
    modelTestImageLinks,
    latestRelease,
    activeRelease,
    textModels,
    personaGenerationModels,
    selectedPersona,
    refreshAll,
    createSupportedProvider,
    runModelTest,
    setModelActive,
    reorderModels,
    createDraft,
    publishNextVersion,
    runPolicyPreview,
    previewSelectedPolicyDraft,
    rollbackRelease,
    deletePolicyRelease,
    viewPolicyVersion,
    runPersonaGenerationPreview,
    savePersonaFromGeneration,
    runInteractionPreview,
    applyRoutePrimaryModel,
    routePrimaryModelLabel,
    personaStepStatus,
  };
}
