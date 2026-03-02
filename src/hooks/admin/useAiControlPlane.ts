"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { apiDelete, apiFetchJson, apiPost, apiPut } from "@/lib/api/fetch-json";
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
  const [activeSection, setActiveSection] = useState<ControlPlaneSection>("policy_studio");
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

  const [draft, setDraft] = useState<DraftState>({
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

  const routeByScope = useMemo(() => {
    const map = new Map<string, AiModelRoute>();
    for (const route of routes) {
      map.set(route.scope, route);
    }
    return map;
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

  const refreshAll = async () => {
    try {
      const [providersRes, modelsRes, routesRes, releasesRes, personasRes] = await Promise.all([
        apiFetchJson<{ items: AiProviderConfig[] }>("/api/admin/ai/providers"),
        apiFetchJson<{ items: AiModelConfig[] }>("/api/admin/ai/models"),
        apiFetchJson<{ items: AiModelRoute[] }>("/api/admin/ai/model-routes"),
        apiFetchJson<{ items: PolicyReleaseListItem[] }>("/api/admin/ai/policy-releases"),
        apiFetchJson<{ items: PersonaItem[] }>("/api/admin/ai/personas?limit=50"),
      ]);
      setProviders(providersRes.items);
      setModels(modelsRes.items);
      setRoutes(routesRes.items);
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

  const removeModel = async (modelId: string) => {
    try {
      await apiDelete(`/api/admin/ai/models?id=${encodeURIComponent(modelId)}`);
      toast.success("Model removed");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove model");
    }
  };

  const saveRoute = async (
    scope: AiModelRoute["scope"],
    primaryModelId: string,
    fallbackModelId: string,
  ) => {
    try {
      await apiPut("/api/admin/ai/model-routes", {
        routes: [
          {
            scope,
            primaryModelId: primaryModelId || null,
            fallbackModelId: fallbackModelId || null,
          },
        ],
      });
      toast.success(`${scope} route updated`);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update route");
    }
  };

  const createDraft = async () => {
    try {
      const res = await apiPost<{ item: PolicyReleaseListItem }>(
        "/api/admin/ai/policy-releases",
        draft,
      );
      toast.success(`Draft v${res.item.version} created`);
      setPolicyPreviewInput((prev) => ({ ...prev, releaseId: String(res.item.version) }));
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create draft");
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
      toast.success(`Release v${releaseId} published`);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish release");
    }
  };

  const rollbackRelease = async (releaseId: number) => {
    try {
      await apiPost(`/api/admin/ai/policy-releases/${releaseId}/rollback`, {
        note: `rollback to v${releaseId}`,
      });
      toast.success(`Rollback to v${releaseId} complete`);
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

  const resolveRoutePrimaryModelId = (scope: "post" | "comment") => {
    const taskPrimary = routeByScope.get(scope)?.primaryModelId;
    if (taskPrimary) {
      return taskPrimary;
    }
    return routeByScope.get("global_default")?.primaryModelId ?? "";
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
    runProviderTest,
    removeProvider,
    createModel,
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
