"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ApiError, apiDelete, apiFetchJson, apiPatch, apiPost, apiPut } from "@/lib/api/fetch-json";
import { buildPersonaGenerationPromptTemplatePreview } from "@/lib/ai/admin/persona-generation-prompt-template";
import type {
  AdminControlPlaneSnapshot,
  AiModelConfig,
  AiProviderConfig,
  PolicyReleaseListItem,
  PersonaProfile,
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
  defaultInteractionTaskContext,
  derivePersonaUsername,
  optionLabelForModel,
} from "@/components/admin/control-plane/control-plane-utils";
import {
  isPersonaGenerationAbortError,
  type PersonaGenerationModalPhase,
} from "@/components/admin/control-plane/persona-generation-modal-utils";

export function applyPolicyReleaseToDraft(
  draft: DraftState,
  release: PolicyReleaseListItem,
): DraftState {
  return {
    ...draft,
    selectedVersion: release.version,
    systemBaseline: release.globalPolicyDraft.systemBaseline ?? "",
    globalPolicy: release.globalPolicyDraft.globalPolicy ?? "",
    styleGuide: release.globalPolicyDraft.styleGuide ?? "",
    forbiddenRules: release.globalPolicyDraft.forbiddenRules ?? "",
    note: release.changeNote ?? "",
  };
}

function hasNonEmptyText(value: string): boolean {
  return value.trim().length > 0;
}

export function isEligiblePersonaGenerationModel(
  model: AiModelConfig,
  provider: AiProviderConfig | undefined,
): boolean {
  return (
    model.capability === "text_generation" &&
    model.status === "active" &&
    model.testStatus === "success" &&
    model.lifecycleStatus !== "retired" &&
    provider?.hasKey === true
  );
}

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
  const initialSelectedRelease = activeRelease ?? latestRelease ?? null;

  const [draft, setDraft] = useState<DraftState>({
    selectedVersion: initialSelectedRelease?.version ?? latestPolicyVersion,
    systemBaseline: initialSelectedRelease?.globalPolicyDraft.systemBaseline ?? "",
    globalPolicy: initialSelectedRelease?.globalPolicyDraft.globalPolicy ?? "",
    styleGuide: initialSelectedRelease?.globalPolicyDraft.styleGuide ?? "",
    forbiddenRules: initialSelectedRelease?.globalPolicyDraft.forbiddenRules ?? "",
    note: initialSelectedRelease?.changeNote ?? "",
  });

  const [policyPreviewInput, setPolicyPreviewInput] = useState({
    version: latestRelease?.version ? String(latestRelease.version) : "",
    taskContext: "Draft a forum comment preview.",
  });
  const [policyPreview, setPolicyPreview] = useState<PreviewResult | null>(null);

  const initialPersonaGenerationModelId =
    initialModels.find((model) => {
      const provider = initialProviders.find((item) => item.id === model.providerId);
      return isEligiblePersonaGenerationModel(model, provider);
    })?.id ?? "";

  const [personaGeneration, setPersonaGeneration] = useState({
    modelId: initialPersonaGenerationModelId,
    extraPrompt: "Generate a witty but respectful creator persona.",
  });
  const [personaGenerationLoading, setPersonaGenerationLoading] = useState(false);
  const [personaPromptAssistLoading, setPersonaPromptAssistLoading] = useState(false);
  const [personaPromptAssistError, setPersonaPromptAssistError] = useState<string | null>(null);
  const [personaPromptAssistElapsedSeconds, setPersonaPromptAssistElapsedSeconds] = useState(0);
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
  const [personaGenerationModalOpen, setPersonaGenerationModalOpen] = useState(false);
  const [personaGenerationModalPhase, setPersonaGenerationModalPhase] =
    useState<PersonaGenerationModalPhase>("idle");
  const [personaGenerationModalError, setPersonaGenerationModalError] = useState<string | null>(
    null,
  );
  const [personaGenerationModalRawOutput, setPersonaGenerationModalRawOutput] = useState<
    string | null
  >(null);
  const [personaGenerationElapsedSeconds, setPersonaGenerationElapsedSeconds] = useState(0);
  const personaGenerationStartedAtRef = useRef<number | null>(null);
  const personaGenerationAbortRef = useRef<AbortController | null>(null);
  const personaPromptAssistStartedAtRef = useRef<number | null>(null);
  const personaPromptAssistAbortRef = useRef<AbortController | null>(null);

  const [interactionInput, setInteractionInput] = useState({
    personaId: initialPersonas[0]?.id ?? "",
    modelId: initialModels.find((item) => item.capability === "text_generation")?.id ?? "",
    taskType: "post" as "post" | "comment",
    taskContext: defaultInteractionTaskContext("post"),
  });
  const [interactionPreview, setInteractionPreview] = useState<PreviewResult | null>(null);
  const [interactionPreviewModalOpen, setInteractionPreviewModalOpen] = useState(false);
  const [interactionPreviewModalPhase, setInteractionPreviewModalPhase] =
    useState<PersonaGenerationModalPhase>("idle");
  const [interactionPreviewModalError, setInteractionPreviewModalError] = useState<string | null>(
    null,
  );
  const [interactionPreviewElapsedSeconds, setInteractionPreviewElapsedSeconds] = useState(0);
  const [selectedPersonaProfile, setSelectedPersonaProfile] = useState<PersonaProfile | null>(null);
  const [interactionTaskAssistLoading, setInteractionTaskAssistLoading] = useState(false);
  const [interactionTaskAssistError, setInteractionTaskAssistError] = useState<string | null>(null);
  const [interactionTaskAssistElapsedSeconds, setInteractionTaskAssistElapsedSeconds] = useState(0);
  const [modelTestImageLinks, setModelTestImageLinks] = useState<Record<string, string>>({});

  const textModels = useMemo(
    () => models.filter((item) => item.capability === "text_generation"),
    [models],
  );

  const personaGenerationModels = useMemo(
    () =>
      models.filter((model) => {
        const provider = providers.find((item) => item.id === model.providerId);
        return isEligiblePersonaGenerationModel(model, provider);
      }),
    [models, providers],
  );

  const selectedPersona = useMemo(
    () => personas.find((item) => item.id === interactionInput.personaId) ?? null,
    [personas, interactionInput.personaId],
  );
  const interactionPreviewStartedAtRef = useRef<number | null>(null);
  const interactionTaskAssistStartedAtRef = useRef<number | null>(null);
  const interactionTaskAssistAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!interactionInput.personaId) {
      setSelectedPersonaProfile(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const profile = await apiFetchJson<PersonaProfile>(
          `/api/admin/ai/personas/${interactionInput.personaId}`,
        );
        if (!cancelled) {
          setSelectedPersonaProfile(profile);
        }
      } catch {
        if (!cancelled) {
          setSelectedPersonaProfile(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [interactionInput.personaId]);

  useEffect(() => {
    if (
      interactionPreviewModalPhase !== "loading" ||
      interactionPreviewStartedAtRef.current === null
    ) {
      return;
    }

    const updateElapsed = () => {
      setInteractionPreviewElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - interactionPreviewStartedAtRef.current!) / 1000)),
      );
    };

    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [interactionPreviewModalPhase]);

  useEffect(() => {
    if (!interactionTaskAssistLoading || interactionTaskAssistStartedAtRef.current === null) {
      return;
    }

    const updateElapsed = () => {
      setInteractionTaskAssistElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - interactionTaskAssistStartedAtRef.current!) / 1000)),
      );
    };

    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [interactionTaskAssistLoading]);

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
    setDraft((prev) => applyPolicyReleaseToDraft(prev, selected));
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

  useEffect(() => {
    if (personaGeneration.modelId) {
      const stillAvailable = personaGenerationModels.some(
        (item) => item.id === personaGeneration.modelId,
      );
      if (stillAvailable) {
        return;
      }
    }
    const fallbackModelId = personaGenerationModels[0]?.id ?? "";
    if (fallbackModelId !== personaGeneration.modelId) {
      setPersonaGeneration((prev) => ({ ...prev, modelId: fallbackModelId }));
    }
  }, [personaGeneration.modelId, personaGenerationModels]);

  useEffect(() => {
    if (
      !personaGenerationModalOpen ||
      personaGenerationModalPhase !== "loading" ||
      personaGenerationStartedAtRef.current === null
    ) {
      return;
    }

    const updateElapsed = () => {
      if (personaGenerationStartedAtRef.current === null) {
        setPersonaGenerationElapsedSeconds(0);
        return;
      }
      setPersonaGenerationElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - personaGenerationStartedAtRef.current) / 1000)),
      );
    };

    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [personaGenerationModalOpen, personaGenerationModalPhase]);

  useEffect(() => {
    if (!personaPromptAssistLoading || personaPromptAssistStartedAtRef.current === null) {
      return;
    }

    const updateElapsed = () => {
      if (personaPromptAssistStartedAtRef.current === null) {
        setPersonaPromptAssistElapsedSeconds(0);
        return;
      }
      setPersonaPromptAssistElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - personaPromptAssistStartedAtRef.current) / 1000)),
      );
    };

    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [personaPromptAssistLoading]);

  const closePersonaGenerationModal = () => {
    if (personaGenerationModalPhase === "loading") {
      personaGenerationAbortRef.current?.abort();
      personaGenerationAbortRef.current = null;
      personaGenerationStartedAtRef.current = null;
      setPersonaGenerationLoading(false);
      setPersonaGenerationElapsedSeconds(0);
      setPersonaGenerationModalPhase("idle");
      setPersonaGenerationModalError(null);
      setPersonaGenerationModalRawOutput(null);
    }
    setPersonaGenerationModalOpen(false);
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
    personaGenerationAbortRef.current?.abort();
    const abortController = new AbortController();
    personaGenerationAbortRef.current = abortController;
    personaGenerationStartedAtRef.current = Date.now();
    setPersonaGenerationElapsedSeconds(0);
    setPersonaGenerationModalOpen(true);
    setPersonaGenerationModalError(null);
    setPersonaGenerationModalRawOutput(null);
    setPersonaLastSavedAt(null);
    setPersonaGenerationModalPhase("loading");
    setPersonaGenerationPreview(null);
    setPersonaGenerationLoading(true);
    try {
      const res = await apiPost<{
        preview: PreviewResult & { structured: PersonaGenerationStructured };
      }>("/api/admin/ai/persona-generation/preview", personaGeneration, {
        signal: abortController.signal,
      });
      if (personaGenerationAbortRef.current !== abortController) {
        return;
      }
      setPersonaGenerationPreview(res.preview);
      const generatedDisplayName =
        res.preview.structured.personas.display_name || "AI Persona Draft";
      setPersonaSaveForm({
        displayName: generatedDisplayName,
        username: derivePersonaUsername(generatedDisplayName),
      });
      setPersonaPreviewRunCount((prev) => prev + 1);
      setPersonaGenerationModalPhase("success");
      toast.success("Persona preview generated");
    } catch (error) {
      if (isPersonaGenerationAbortError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : "Failed to generate preview";
      setPersonaGenerationModalError(message);
      setPersonaGenerationModalRawOutput(
        error instanceof ApiError &&
          error.details &&
          typeof error.details === "object" &&
          "rawOutput" in error.details &&
          typeof (error.details as { rawOutput?: unknown }).rawOutput === "string"
          ? ((error.details as { rawOutput: string }).rawOutput ?? null)
          : null,
      );
      setPersonaGenerationModalPhase("error");
      toast.error(message);
    } finally {
      if (personaGenerationAbortRef.current === abortController) {
        personaGenerationAbortRef.current = null;
      }
      personaGenerationStartedAtRef.current = null;
      setPersonaGenerationLoading(false);
    }
  };

  const savePersonaFromGeneration = async () => {
    if (!personaGenerationPreview) {
      toast.error("Run persona generation preview first");
      return;
    }
    if (personaLastSavedAt) {
      return;
    }

    const username = `ai_${Date.now().toString().slice(-6)}`;
    setPersonaSaveLoading(true);
    try {
      await apiPost("/api/admin/ai/personas", {
        username: personaSaveForm.username || username,
        personas: {
          ...personaGenerationPreview.structured.personas,
          display_name:
            personaSaveForm.displayName ||
            personaGenerationPreview.structured.personas.display_name,
        },
        personaCore: personaGenerationPreview.structured.persona_core,
        referenceSources: personaGenerationPreview.structured.reference_sources,
        referenceDerivation: personaGenerationPreview.structured.reference_derivation,
        originalizationNote: personaGenerationPreview.structured.originalization_note,
        personaMemories: personaGenerationPreview.structured.persona_memories.map((item) => ({
          memoryType: item.memory_type,
          scope: item.scope,
          memoryKey: item.memory_key,
          content: item.content,
          metadata: item.metadata,
          expiresAt:
            item.expires_in_hours && item.expires_in_hours > 0
              ? new Date(Date.now() + item.expires_in_hours * 3600_000).toISOString()
              : null,
          isCanonical: item.is_canonical,
          importance: item.importance,
        })),
      });
      toast.success("Persona saved");
      setPersonaLastSavedAt(new Date().toISOString());
      await refreshPersonas();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save persona");
    } finally {
      setPersonaSaveLoading(false);
    }
  };

  const assistPersonaPrompt = async () => {
    if (personaPromptAssistLoading) {
      personaPromptAssistAbortRef.current?.abort();
      personaPromptAssistAbortRef.current = null;
      personaPromptAssistStartedAtRef.current = null;
      setPersonaPromptAssistLoading(false);
      setPersonaPromptAssistElapsedSeconds(0);
      return;
    }
    if (!personaGeneration.modelId) {
      toast.error("model is required");
      return;
    }
    if (!personaGenerationModels.some((item) => item.id === personaGeneration.modelId)) {
      toast.error("Selected model is unavailable. Use a model with configured API key.");
      return;
    }
    const abortController = new AbortController();
    personaPromptAssistAbortRef.current = abortController;
    personaPromptAssistStartedAtRef.current = Date.now();
    setPersonaPromptAssistElapsedSeconds(0);
    setPersonaPromptAssistError(null);
    setPersonaPromptAssistLoading(true);
    try {
      const hadExistingPrompt = hasNonEmptyText(personaGeneration.extraPrompt);
      const res = await apiPost<{ text: string }>(
        "/api/admin/ai/persona-generation/prompt-assist",
        {
          modelId: personaGeneration.modelId,
          inputPrompt: personaGeneration.extraPrompt,
        },
        { signal: abortController.signal },
      );
      if (personaPromptAssistAbortRef.current !== abortController) {
        return;
      }
      setPersonaGeneration((prev) => ({
        ...prev,
        extraPrompt: res.text,
      }));
      toast.success(hadExistingPrompt ? "Prompt optimized" : "Prompt generated");
    } catch (error) {
      if (isPersonaGenerationAbortError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : "Failed to assist prompt";
      setPersonaPromptAssistError(message);
      toast.error(message);
    } finally {
      if (personaPromptAssistAbortRef.current === abortController) {
        personaPromptAssistAbortRef.current = null;
      }
      personaPromptAssistStartedAtRef.current = null;
      setPersonaPromptAssistLoading(false);
    }
  };

  const runInteractionPreview = async () => {
    if (!interactionInput.personaId || !interactionInput.modelId) {
      toast.error("persona/model are required");
      return;
    }
    if (!hasNonEmptyText(interactionInput.taskContext)) {
      toast.error("Task context is required");
      return;
    }

    setInteractionPreviewModalOpen(true);
    setInteractionPreviewModalPhase("loading");
    setInteractionPreviewModalError(null);
    setInteractionPreviewElapsedSeconds(0);
    setInteractionPreview(null);
    interactionPreviewStartedAtRef.current = Date.now();
    try {
      const res = await apiPost<{ preview: PreviewResult }>(
        "/api/admin/ai/persona-interaction/preview",
        {
          personaId: interactionInput.personaId,
          modelId: interactionInput.modelId,
          taskType: interactionInput.taskType,
          taskContext: interactionInput.taskContext,
        },
      );
      setInteractionPreview(res.preview);
      setInteractionPreviewModalPhase("success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run interaction preview";
      setInteractionPreviewModalError(message);
      setInteractionPreviewModalPhase("error");
      toast.error(message);
    } finally {
      interactionPreviewStartedAtRef.current = null;
    }
  };

  const closeInteractionPreviewModal = () => {
    setInteractionPreviewModalOpen(false);
  };

  const assistInteractionTaskContext = async () => {
    if (interactionTaskAssistLoading) {
      interactionTaskAssistAbortRef.current?.abort();
      interactionTaskAssistAbortRef.current = null;
      interactionTaskAssistStartedAtRef.current = null;
      setInteractionTaskAssistLoading(false);
      setInteractionTaskAssistElapsedSeconds(0);
      return;
    }

    if (!interactionInput.modelId) {
      toast.error("model is required");
      return;
    }

    const abortController = new AbortController();
    interactionTaskAssistAbortRef.current = abortController;
    interactionTaskAssistStartedAtRef.current = Date.now();
    setInteractionTaskAssistElapsedSeconds(0);
    setInteractionTaskAssistError(null);
    setInteractionTaskAssistLoading(true);

    try {
      const res = await apiPost<{ text: string }>(
        "/api/admin/ai/persona-interaction/context-assist",
        {
          modelId: interactionInput.modelId,
          taskType: interactionInput.taskType,
          personaId: interactionInput.personaId || undefined,
          taskContext: interactionInput.taskContext.trim() || undefined,
        },
        { signal: abortController.signal },
      );
      if (interactionTaskAssistAbortRef.current !== abortController) {
        return;
      }
      setInteractionInput((prev) => ({
        ...prev,
        taskContext: res.text,
      }));
      toast.success("Task context generated");
    } catch (error) {
      if (isPersonaGenerationAbortError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : "Failed to generate task context";
      setInteractionTaskAssistError(message);
      toast.error(message);
    } finally {
      if (interactionTaskAssistAbortRef.current === abortController) {
        interactionTaskAssistAbortRef.current = null;
      }
      interactionTaskAssistStartedAtRef.current = null;
      setInteractionTaskAssistLoading(false);
    }
  };

  const personaStepStatus = {
    generated: personaPreviewRunCount > 0,
    saved: Boolean(personaLastSavedAt),
  };

  const personaPromptAssemblyPreview = useMemo(
    () =>
      buildPersonaGenerationPromptTemplatePreview({
        extraPrompt: personaGeneration.extraPrompt,
        globalPolicyContent: [
          activeRelease?.globalPolicyDraft.systemBaseline ?? "",
          activeRelease?.globalPolicyDraft.globalPolicy ?? "",
        ]
          .filter((value) => value.trim().length > 0)
          .join("\n"),
      }),
    [activeRelease, personaGeneration.extraPrompt],
  );

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
    personaPromptAssistLoading,
    personaPromptAssistError,
    personaPromptAssistElapsedSeconds,
    personaPreviewRunCount,
    personaLastSavedAt,
    personaSaveLoading,
    personaSaveForm,
    setPersonaSaveForm,
    personaGenerationPreview,
    personaPromptAssemblyPreview,
    personaGenerationModalOpen,
    personaGenerationModalPhase,
    personaGenerationModalError,
    personaGenerationModalRawOutput,
    personaGenerationElapsedSeconds,
    interactionInput,
    setInteractionInput,
    interactionPreview,
    interactionPreviewModalOpen,
    interactionPreviewModalPhase,
    interactionPreviewModalError,
    interactionPreviewElapsedSeconds,
    selectedPersonaProfile,
    interactionTaskAssistLoading,
    interactionTaskAssistError,
    interactionTaskAssistElapsedSeconds,
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
    assistPersonaPrompt,
    closePersonaGenerationModal,
    savePersonaFromGeneration,
    runInteractionPreview,
    closeInteractionPreviewModal,
    assistInteractionTaskContext,
    personaStepStatus,
  };
}
