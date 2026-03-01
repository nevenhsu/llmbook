"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import SafeHtml from "@/components/ui/SafeHtml";
import PersonaSelect from "@/components/ui/PersonaSelect";
import { apiDelete, apiFetchJson, apiPost, apiPut } from "@/lib/api/fetch-json";
import type {
  AiModelConfig,
  AiModelRoute,
  PersonaGenerationStructured,
  AiProviderConfig,
  PolicyReleaseListItem,
  PreviewResult,
} from "@/lib/ai/admin/control-plane-store";

type PersonaItem = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  status: string;
};

type Props = {
  initialProviders: AiProviderConfig[];
  initialModels: AiModelConfig[];
  initialRoutes: AiModelRoute[];
  initialReleases: PolicyReleaseListItem[];
  initialPersonas: PersonaItem[];
};

type DraftState = {
  coreGoal: string;
  globalPolicy: string;
  styleGuide: string;
  forbiddenRules: string;
  note: string;
};

type ControlPlaneSection =
  | "providers_models"
  | "policy_studio"
  | "policy_models"
  | "persona_generation"
  | "persona_interaction";

type RouteDraftState = Record<
  AiModelRoute["scope"],
  { primaryModelId: string; fallbackModelId: string }
>;

const SECTION_ITEMS: Array<{ id: ControlPlaneSection; label: string; helper: string }> = [
  {
    id: "providers_models",
    label: "Providers & Models",
    helper: "Manage provider keys and model inventory",
  },
  {
    id: "policy_studio",
    label: "Global Policy Studio",
    helper: "Draft, preview, publish, rollback",
  },
  {
    id: "policy_models",
    label: "Policy Models",
    helper: "Set primary/fallback routes per task",
  },
  {
    id: "persona_generation",
    label: "Persona Generation",
    helper: "Generate, regenerate, save to DB",
  },
  {
    id: "persona_interaction",
    label: "Persona Interaction",
    helper: "Preview post/comment with selected persona",
  },
];

const ROUTE_SCOPE_ORDER: Array<AiModelRoute["scope"]> = [
  "global_default",
  "post",
  "comment",
  "image",
  "persona_generation",
];

function optionLabelForModel(model: AiModelConfig, providers: AiProviderConfig[]): string {
  const provider = providers.find((item) => item.id === model.providerId);
  return `${model.displayName} (${provider?.displayName ?? "Unknown Provider"})`;
}

function derivePersonaUsername(displayName: string): string {
  const normalized = displayName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_\.]+|[_\.]+$/g, "");
  const base = normalized.startsWith("ai_") ? normalized.slice(3) : normalized;
  const constrained = (base || "persona").slice(0, 17);
  const minSized = constrained.length >= 3 ? constrained : `${constrained}bot`.slice(0, 3);
  return `ai_${minSized}`;
}

function renderBadge(renderOk: boolean, renderError: string | null): ReactNode {
  if (renderOk) {
    return <span className="badge badge-success">TipTap Render OK</span>;
  }
  return (
    <span className="badge badge-error">
      TipTap Render Failed{renderError ? `: ${renderError}` : ""}
    </span>
  );
}

function buildInitialRouteDrafts(routes: AiModelRoute[]): RouteDraftState {
  return ROUTE_SCOPE_ORDER.reduce<RouteDraftState>((acc, scope) => {
    const route = routes.find((item) => item.scope === scope);
    acc[scope] = {
      primaryModelId: route?.primaryModelId ?? "",
      fallbackModelId: route?.fallbackModelId ?? "",
    };
    return acc;
  }, {} as RouteDraftState);
}

function PreviewPanel({
  preview,
  emptyLabel,
}: {
  preview: PreviewResult | null;
  emptyLabel: string;
}) {
  if (!preview) {
    return <div className="rounded border border-dashed p-3 text-sm opacity-70">{emptyLabel}</div>;
  }

  const budget = preview.tokenBudget;
  return (
    <div className="space-y-3 rounded border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {renderBadge(preview.renderOk, preview.renderError)}
        <span className="badge">
          Input {budget.estimatedInputTokens}/{budget.maxInputTokens}
        </span>
        <span className="badge">Output Max {budget.maxOutputTokens}</span>
        {budget.compressedStages.length > 0 ? (
          <span className="badge badge-warning">
            Compressed: {budget.compressedStages.join(" -> ")}
          </span>
        ) : null}
      </div>

      {budget.exceeded ? (
        <div className="alert alert-warning py-2 text-sm">
          {budget.message ?? "Token budget exceeded. Please simplify global rules."}
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded border p-2">
          <div className="mb-2 text-sm font-semibold">Prompt Assembly</div>
          <pre className="bg-base-200 max-h-64 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
            {preview.assembledPrompt}
          </pre>
        </div>
        <div className="rounded border p-2">
          <div className="mb-2 text-sm font-semibold">Markdown</div>
          <pre className="bg-base-200 max-h-64 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
            {preview.markdown}
          </pre>
        </div>
        <div className="rounded border p-2">
          <div className="mb-2 text-sm font-semibold">TipTap Render Result</div>
          <div className="rounded border p-2">
            <SafeHtml markdown={preview.markdown} className="tiptap-html" />
          </div>
        </div>
        <div className="rounded border p-2">
          <div className="mb-2 text-sm font-semibold">Token Budget Blocks</div>
          <div className="overflow-x-auto">
            <table className="table-xs table">
              <thead>
                <tr>
                  <th>Block</th>
                  <th className="text-right">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {budget.blockStats.map((block) => (
                  <tr key={block.name}>
                    <td>{block.name}</td>
                    <td className="text-right">{block.tokens}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AiControlPlanePanel({
  initialProviders,
  initialModels,
  initialRoutes,
  initialReleases,
  initialPersonas,
}: Props) {
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
    await apiPost("/api/admin/ai/providers", providerForm);
    toast.success("Provider saved");
    await refreshAll();
  };

  const runProviderTest = async (providerId: string) => {
    await apiPost(`/api/admin/ai/providers/${providerId}/test`, {});
    toast.success("Provider test triggered");
    await refreshAll();
  };

  const removeProvider = async (providerId: string) => {
    await apiDelete(`/api/admin/ai/providers?id=${encodeURIComponent(providerId)}`);
    toast.success("Provider removed");
    await refreshAll();
  };

  const createModel = async () => {
    if (!modelForm.providerId || !modelForm.modelKey.trim() || !modelForm.displayName.trim()) {
      toast.error("provider/model/display name are required");
      return;
    }
    await apiPost("/api/admin/ai/models", modelForm);
    toast.success("Model saved");
    await refreshAll();
  };

  const removeModel = async (modelId: string) => {
    await apiDelete(`/api/admin/ai/models?id=${encodeURIComponent(modelId)}`);
    toast.success("Model removed");
    await refreshAll();
  };

  const saveRoute = async (
    scope: AiModelRoute["scope"],
    primaryModelId: string,
    fallbackModelId: string,
  ) => {
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
  };

  const createDraft = async () => {
    const res = await apiPost<{ item: PolicyReleaseListItem }>(
      "/api/admin/ai/policy-releases",
      draft,
    );
    toast.success(`Draft v${res.item.version} created`);
    setPolicyPreviewInput((prev) => ({ ...prev, releaseId: String(res.item.version) }));
    await refreshAll();
  };

  const runPolicyPreview = async () => {
    if (!policyPreviewInput.releaseId || !policyPreviewInput.modelId) {
      toast.error("release and model are required");
      return;
    }
    const res = await apiPost<{ preview: PreviewResult }>(
      `/api/admin/ai/policy-releases/${policyPreviewInput.releaseId}/preview`,
      {
        modelId: policyPreviewInput.modelId,
        taskContext: policyPreviewInput.taskContext,
      },
    );
    setPolicyPreview(res.preview);
  };

  const publishRelease = async (releaseId: number) => {
    await apiPost(`/api/admin/ai/policy-releases/${releaseId}/publish`, {
      note: draft.note || "manual publish",
    });
    toast.success(`Release v${releaseId} published`);
    await refreshAll();
  };

  const rollbackRelease = async (releaseId: number) => {
    await apiPost(`/api/admin/ai/policy-releases/${releaseId}/rollback`, {
      note: `rollback to v${releaseId}`,
    });
    toast.success(`Rollback to v${releaseId} complete`);
    await refreshAll();
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
  };

  const modelForScope = (scope: AiModelRoute["scope"]) =>
    models.filter((model) =>
      scope === "image"
        ? model.capability === "image_generation"
        : model.capability === "text_generation",
    );

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admin AI Control Plane</h1>
          <p className="text-sm opacity-70">
            Manual trigger only. Single-model preview. TipTap render validation required.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeRelease ? (
            <span className="badge badge-success">Active Release v{activeRelease.version}</span>
          ) : (
            <span className="badge">No active release</span>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => void refreshAll()}>
            Refresh
          </button>
        </div>
      </div>

      <section className="rounded border p-3">
        <div className="mb-2 text-sm font-semibold">Control Plane Sections</div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {SECTION_ITEMS.map((section) => (
            <button
              key={section.id}
              className={`rounded border p-2 text-left ${
                activeSection === section.id ? "border-primary bg-base-200" : "border-base-300"
              }`}
              onClick={() => setActiveSection(section.id)}
            >
              <div className="text-sm font-semibold">{section.label}</div>
              <div className="text-xs opacity-70">{section.helper}</div>
            </button>
          ))}
        </div>
      </section>

      {activeSection === "providers_models" ? (
        <section className="card border-base-300 bg-base-100 border">
          <div className="card-body gap-4">
            <h2 className="card-title">Providers & Models</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <h3 className="font-semibold">Add Provider</h3>
                <input
                  className="input input-bordered input-sm"
                  placeholder="providerKey"
                  value={providerForm.providerKey}
                  onChange={(e) => setProviderForm((p) => ({ ...p, providerKey: e.target.value }))}
                />
                <input
                  className="input input-bordered input-sm"
                  placeholder="displayName"
                  value={providerForm.displayName}
                  onChange={(e) => setProviderForm((p) => ({ ...p, displayName: e.target.value }))}
                />
                <input
                  className="input input-bordered input-sm"
                  placeholder="sdkPackage"
                  value={providerForm.sdkPackage}
                  onChange={(e) => setProviderForm((p) => ({ ...p, sdkPackage: e.target.value }))}
                />
                <input
                  className="input input-bordered input-sm"
                  placeholder="apiKey (update only)"
                  value={providerForm.apiKey}
                  onChange={(e) => setProviderForm((p) => ({ ...p, apiKey: e.target.value }))}
                />
                <button className="btn btn-primary btn-sm" onClick={() => void createProvider()}>
                  Save Provider
                </button>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Add Model</h3>
                <select
                  className="select select-bordered select-sm"
                  value={modelForm.providerId}
                  onChange={(e) => setModelForm((p) => ({ ...p, providerId: e.target.value }))}
                >
                  <option value="">Select provider</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.displayName}
                    </option>
                  ))}
                </select>
                <input
                  className="input input-bordered input-sm"
                  placeholder="modelKey"
                  value={modelForm.modelKey}
                  onChange={(e) => setModelForm((p) => ({ ...p, modelKey: e.target.value }))}
                />
                <input
                  className="input input-bordered input-sm"
                  placeholder="displayName"
                  value={modelForm.displayName}
                  onChange={(e) => setModelForm((p) => ({ ...p, displayName: e.target.value }))}
                />
                <select
                  className="select select-bordered select-sm"
                  value={modelForm.capability}
                  onChange={(e) =>
                    setModelForm((p) => ({
                      ...p,
                      capability: e.target.value as "text_generation" | "image_generation",
                    }))
                  }
                >
                  <option value="text_generation">text_generation</option>
                  <option value="image_generation">image_generation</option>
                </select>
                <button className="btn btn-primary btn-sm" onClick={() => void createModel()}>
                  Save Model
                </button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 font-semibold">Providers</h3>
                <div className="overflow-x-auto">
                  <table className="table-xs table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Test</th>
                        <th>Key</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {providers.map((item) => (
                        <tr key={item.id}>
                          <td>{item.displayName}</td>
                          <td>{item.status}</td>
                          <td>{item.testStatus}</td>
                          <td>{item.hasKey ? `****${item.keyLast4 ?? ""}` : "missing"}</td>
                          <td className="space-x-1">
                            <button
                              className="btn btn-xs"
                              onClick={() => void runProviderTest(item.id)}
                            >
                              Test
                            </button>
                            <button
                              className="btn btn-xs btn-error"
                              onClick={() => void removeProvider(item.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Models</h3>
                <div className="overflow-x-auto">
                  <table className="table-xs table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Capability</th>
                        <th>Provider</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {models.map((item) => (
                        <tr key={item.id}>
                          <td>{item.displayName}</td>
                          <td>{item.capability}</td>
                          <td>
                            {providers.find((provider) => provider.id === item.providerId)
                              ?.displayName ?? "-"}
                          </td>
                          <td>
                            <button
                              className="btn btn-xs btn-error"
                              onClick={() => void removeModel(item.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeSection === "policy_studio" ? (
        <section className="card border-base-300 bg-base-100 border">
          <div className="card-body gap-4">
            <h2 className="card-title">Global Policy Studio</h2>
            <div className="grid gap-2">
              <textarea
                className="textarea textarea-bordered h-20"
                placeholder="core_goal"
                value={draft.coreGoal}
                onChange={(e) => setDraft((prev) => ({ ...prev, coreGoal: e.target.value }))}
              />
              <textarea
                className="textarea textarea-bordered h-28"
                placeholder="global_policy"
                value={draft.globalPolicy}
                onChange={(e) => setDraft((prev) => ({ ...prev, globalPolicy: e.target.value }))}
              />
              <textarea
                className="textarea textarea-bordered h-20"
                placeholder="style_guide"
                value={draft.styleGuide}
                onChange={(e) => setDraft((prev) => ({ ...prev, styleGuide: e.target.value }))}
              />
              <textarea
                className="textarea textarea-bordered h-20"
                placeholder="forbidden_rules"
                value={draft.forbiddenRules}
                onChange={(e) => setDraft((prev) => ({ ...prev, forbiddenRules: e.target.value }))}
              />
              <input
                className="input input-bordered"
                placeholder="release note"
                value={draft.note}
                onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))}
              />
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary btn-sm" onClick={() => void createDraft()}>
                  Create Draft
                </button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
              <div>
                <h3 className="mb-2 font-semibold">Policy Releases</h3>
                <div className="overflow-x-auto">
                  <table className="table-xs table">
                    <thead>
                      <tr>
                        <th>Version</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {releases.map((item) => (
                        <tr key={item.version}>
                          <td>v{item.version}</td>
                          <td>
                            {item.isActive ? (
                              <span className="badge badge-success">published</span>
                            ) : (
                              <span className="badge">draft</span>
                            )}
                          </td>
                          <td>{new Date(item.createdAt).toLocaleString()}</td>
                          <td className="space-x-1">
                            {!item.isActive ? (
                              <button
                                className="btn btn-xs btn-primary"
                                onClick={() => void publishRelease(item.version)}
                              >
                                Publish
                              </button>
                            ) : null}
                            <button
                              className="btn btn-xs"
                              onClick={() => void rollbackRelease(item.version)}
                            >
                              Rollback
                            </button>
                            <button
                              className="btn btn-xs"
                              onClick={() =>
                                setPolicyPreviewInput((prev) => ({
                                  ...prev,
                                  releaseId: String(item.version),
                                }))
                              }
                            >
                              Use In Preview
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Manual Preview (single-model)</h3>
                <input
                  className="input input-bordered input-sm"
                  placeholder="release id"
                  value={policyPreviewInput.releaseId}
                  onChange={(e) =>
                    setPolicyPreviewInput((prev) => ({ ...prev, releaseId: e.target.value }))
                  }
                />
                <select
                  className="select select-bordered select-sm"
                  value={policyPreviewInput.modelId}
                  onChange={(e) =>
                    setPolicyPreviewInput((prev) => ({ ...prev, modelId: e.target.value }))
                  }
                >
                  <option value="">Select model</option>
                  {textModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {optionLabelForModel(model, providers)}
                    </option>
                  ))}
                </select>
                <textarea
                  className="textarea textarea-bordered h-20"
                  placeholder="task context"
                  value={policyPreviewInput.taskContext}
                  onChange={(e) =>
                    setPolicyPreviewInput((prev) => ({ ...prev, taskContext: e.target.value }))
                  }
                />
                <button className="btn btn-sm btn-primary" onClick={() => void runPolicyPreview()}>
                  Run Preview
                </button>
              </div>
            </div>

            <PreviewPanel
              preview={policyPreview}
              emptyLabel="Run manual preview to inspect prompt assembly, markdown render, and token budget."
            />
          </div>
        </section>
      ) : null}

      {activeSection === "policy_models" ? (
        <section className="card border-base-300 bg-base-100 border">
          <div className="card-body gap-4">
            <h2 className="card-title">Policy Models</h2>
            <p className="text-sm opacity-70">
              Configure primary/fallback per route. Persona Interaction can apply these route models
              directly for preview.
            </p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {ROUTE_SCOPE_ORDER.map((scope) => {
                const draftRoute = routeDrafts[scope] ?? {
                  primaryModelId: "",
                  fallbackModelId: "",
                };
                return (
                  <div key={scope} className="rounded border p-3">
                    <div className="mb-2 font-semibold">{scope}</div>
                    <select
                      className="select select-bordered select-sm mb-2 w-full"
                      value={draftRoute.primaryModelId}
                      onChange={(e) =>
                        setRouteDrafts((prev) => ({
                          ...prev,
                          [scope]: { ...prev[scope], primaryModelId: e.target.value },
                        }))
                      }
                    >
                      <option value="">Primary model</option>
                      {modelForScope(scope).map((model) => (
                        <option key={model.id} value={model.id}>
                          {optionLabelForModel(model, providers)}
                        </option>
                      ))}
                    </select>
                    <select
                      className="select select-bordered select-sm mb-2 w-full"
                      value={draftRoute.fallbackModelId}
                      onChange={(e) =>
                        setRouteDrafts((prev) => ({
                          ...prev,
                          [scope]: { ...prev[scope], fallbackModelId: e.target.value },
                        }))
                      }
                    >
                      <option value="">Fallback model (nullable)</option>
                      {modelForScope(scope).map((model) => (
                        <option key={model.id} value={model.id}>
                          {optionLabelForModel(model, providers)}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-primary btn-xs"
                      onClick={() =>
                        void saveRoute(
                          scope,
                          routeDrafts[scope]?.primaryModelId ?? "",
                          routeDrafts[scope]?.fallbackModelId ?? "",
                        )
                      }
                    >
                      Save {scope}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {activeSection === "persona_generation" ? (
        <section className="card border-base-300 bg-base-100 border">
          <div className="card-body gap-3">
            <h2 className="card-title">Persona Generation</h2>
            <p className="text-sm opacity-70">
              Step 1: choose model and prompt. Step 2: generate or regenerate preview. Step 3:
              review and save to DB.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge badge-outline">1. Configure Input</span>
              <span
                className={`badge ${personaStepStatus.generated ? "badge-success" : "badge-outline"}`}
              >
                2. {personaStepStatus.generated ? "Generated" : "Not Generated"}
              </span>
              <span
                className={`badge ${personaStepStatus.saved ? "badge-success" : "badge-outline"}`}
              >
                3. {personaStepStatus.saved ? "Saved" : "Not Saved"}
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-[220px_1fr_auto]">
              <select
                className="select select-bordered select-sm"
                value={personaGeneration.modelId}
                onChange={(e) =>
                  setPersonaGeneration((prev) => ({ ...prev, modelId: e.target.value }))
                }
              >
                <option value="">Select model (API key configured)</option>
                {personaGenerationModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {optionLabelForModel(model, providers)}
                  </option>
                ))}
              </select>
              <input
                className="input input-bordered input-sm"
                value={personaGeneration.extraPrompt}
                onChange={(e) =>
                  setPersonaGeneration((prev) => ({ ...prev, extraPrompt: e.target.value }))
                }
                placeholder="extra prompt"
              />
              <button
                className="btn btn-primary btn-sm"
                disabled={personaGenerationLoading}
                onClick={() => void runPersonaGenerationPreview()}
              >
                {personaGenerationLoading
                  ? "Generating..."
                  : personaPreviewRunCount > 0
                    ? "Regenerate Preview"
                    : "Generate Preview"}
              </button>
            </div>
            {personaGenerationModels.length === 0 ? (
              <div className="alert alert-warning py-2 text-sm">
                No eligible model. Add API key to provider and enable at least one text_generation
                model.
              </div>
            ) : null}

            {personaGenerationPreview ? (
              <>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="form-control">
                    <span className="label-text text-xs opacity-70">Display Name</span>
                    <input
                      className="input input-bordered input-sm"
                      value={personaSaveForm.displayName}
                      onChange={(e) => {
                        const displayName = e.target.value;
                        setPersonaSaveForm({
                          displayName,
                          username: derivePersonaUsername(displayName),
                        });
                      }}
                    />
                  </label>
                  <label className="form-control">
                    <span className="label-text text-xs opacity-70">
                      Username (auto ai_ prefix)
                    </span>
                    <input
                      className="input input-bordered input-sm"
                      value={personaSaveForm.username}
                      onChange={(e) =>
                        setPersonaSaveForm((prev) => ({
                          ...prev,
                          username: derivePersonaUsername(e.target.value),
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs opacity-70">Preview runs: {personaPreviewRunCount}</span>
                  {personaLastSavedAt ? (
                    <span className="text-xs opacity-70">
                      Last saved: {new Date(personaLastSavedAt).toLocaleString()}
                    </span>
                  ) : null}
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={personaSaveLoading}
                    onClick={() => void savePersonaFromGeneration()}
                  >
                    {personaSaveLoading ? "Saving..." : "Save To DB"}
                  </button>
                </div>

                <PreviewPanel preview={personaGenerationPreview} emptyLabel="Run preview first" />
              </>
            ) : (
              <PreviewPanel preview={null} emptyLabel="Generate preview to continue." />
            )}
          </div>
        </section>
      ) : null}

      {activeSection === "persona_interaction" ? (
        <section className="card border-base-300 bg-base-100 border">
          <div className="card-body gap-3">
            <h2 className="card-title">Persona Interaction</h2>
            <div className="rounded border p-2 text-xs opacity-80">
              Effective route primary for <strong>{interactionInput.taskType}</strong>:{" "}
              {routePrimaryModelLabel()}
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <PersonaSelect
                value={interactionInput.personaId}
                initialOptions={personas}
                onChange={(personaId) => setInteractionInput((prev) => ({ ...prev, personaId }))}
              />
              <select
                className="select select-bordered select-sm"
                value={interactionInput.modelId}
                onChange={(e) =>
                  setInteractionInput((prev) => ({ ...prev, modelId: e.target.value }))
                }
              >
                <option value="">Select model</option>
                {textModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {optionLabelForModel(model, providers)}
                  </option>
                ))}
              </select>
              <select
                className="select select-bordered select-sm"
                value={interactionInput.taskType}
                onChange={(e) =>
                  setInteractionInput((prev) => ({
                    ...prev,
                    taskType: e.target.value as "post" | "comment",
                  }))
                }
              >
                <option value="post">post</option>
                <option value="comment">comment</option>
              </select>
              <div className="flex gap-2">
                <button className="btn btn-outline btn-sm" onClick={applyRoutePrimaryModel}>
                  Use Route Primary
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => void runInteractionPreview()}
                >
                  Run Preview
                </button>
              </div>
            </div>

            {selectedPersona ? (
              <div className="rounded border p-2 text-xs opacity-80">
                Persona: {selectedPersona.display_name} ({selectedPersona.username})
              </div>
            ) : null}

            <textarea
              className="textarea textarea-bordered h-20"
              value={interactionInput.taskContext}
              onChange={(e) =>
                setInteractionInput((prev) => ({ ...prev, taskContext: e.target.value }))
              }
              placeholder="task context"
            />

            <div className="grid gap-2 xl:grid-cols-2">
              <textarea
                className="textarea textarea-bordered h-28"
                value={interactionInput.soulOverrideJson}
                onChange={(e) =>
                  setInteractionInput((prev) => ({ ...prev, soulOverrideJson: e.target.value }))
                }
                placeholder="Optional soul override JSON object"
              />
              <textarea
                className="textarea textarea-bordered h-28"
                value={interactionInput.longMemoryOverride}
                onChange={(e) =>
                  setInteractionInput((prev) => ({ ...prev, longMemoryOverride: e.target.value }))
                }
                placeholder="Optional long memory override text"
              />
            </div>

            <PreviewPanel
              preview={interactionPreview}
              emptyLabel="Run persona interaction preview to inspect prompt assembly and render output."
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
