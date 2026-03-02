"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Cpu, ChevronRight, Sparkles } from "lucide-react";
import { useAiControlPlane } from "@/hooks/admin/useAiControlPlane";
import { type PersonaItem, SECTION_ICONS, SECTION_ITEMS } from "@/lib/ai/admin/control-plane-types";
import type {
  AiModelConfig,
  AiModelRoute,
  AiProviderConfig,
  PolicyReleaseListItem,
} from "@/lib/ai/admin/control-plane-store";

import { ProvidersModelsSection } from "./control-plane/sections/ProvidersModelsSection";
import { PolicyStudioSection } from "./control-plane/sections/PolicyStudioSection";
import { ModelRoutingSection } from "./control-plane/sections/ModelRoutingSection";
import { PersonaGenerationSection } from "./control-plane/sections/PersonaGenerationSection";
import { PersonaInteractionSection } from "./control-plane/sections/PersonaInteractionSection";

type Props = {
  initialProviders: AiProviderConfig[];
  initialModels: AiModelConfig[];
  initialRoutes: AiModelRoute[];
  initialReleases: PolicyReleaseListItem[];
  initialPersonas: PersonaItem[];
};

export default function AiControlPlanePanel(props: Props) {
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [rollbackVersion, setRollbackVersion] = useState<number | null>(null);

  const {
    activeSection,
    setActiveSection,
    providers,
    models,
    routes,
    releases,
    personas,
    routeDrafts,
    setRouteDrafts,
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
  } = useAiControlPlane(props);

  const currentPolicyVersion = activeRelease?.policyVersion ?? 1;
  const allowedPolicyVersions = useMemo(
    () => [currentPolicyVersion, currentPolicyVersion + 1],
    [currentPolicyVersion],
  );
  const selectedRollbackRelease =
    rollbackVersion == null
      ? null
      : (releases.find((item) => item.version === rollbackVersion) ?? null);
  const hasRollbackCandidate = releases.some((item) => !item.isActive);

  useEffect(() => {
    if (allowedPolicyVersions.includes(draft.policyVersion)) {
      return;
    }
    setDraft((prev) => ({
      ...prev,
      policyVersion: currentPolicyVersion,
    }));
  }, [allowedPolicyVersions, currentPolicyVersion, draft.policyVersion, setDraft]);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Cpu className="text-primary h-6 w-6" />
            AI Control Plane
          </h1>
          <p className="mt-1 text-sm opacity-60">
            Manage providers, policies, model routes, and persona workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="form-control">
            <select
              className="select select-bordered select-xs w-40"
              value={
                allowedPolicyVersions.includes(draft.policyVersion)
                  ? draft.policyVersion
                  : currentPolicyVersion
              }
              onChange={(event) => {
                const nextVersion = Number(event.target.value);
                setDraft((prev) => ({
                  ...prev,
                  policyVersion: Number.isFinite(nextVersion) ? nextVersion : currentPolicyVersion,
                }));
              }}
            >
              {allowedPolicyVersions.map((version) => (
                <option key={version} value={version}>
                  v{version}
                  {version === currentPolicyVersion ? " (current)" : " (next)"}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-outline btn-sm"
            disabled={!hasRollbackCandidate}
            onClick={() => {
              const fallback = releases.find((item) => !item.isActive) ?? releases[0] ?? null;
              setRollbackVersion(fallback?.version ?? null);
              setRollbackModalOpen(true);
            }}
          >
            Rollback
          </button>
          <button className="btn btn-outline btn-sm gap-1" onClick={() => void refreshAll()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="bg-base-100 border-base-300 rounded-lg border px-4 py-3 shadow-sm">
          <div className="text-xs tracking-wide uppercase opacity-50">Providers</div>
          <div className="mt-1 text-xl font-bold">{providers.length}</div>
        </div>
        <div className="bg-base-100 border-base-300 rounded-lg border px-4 py-3 shadow-sm">
          <div className="text-xs tracking-wide uppercase opacity-50">Models</div>
          <div className="mt-1 text-xl font-bold">{models.length}</div>
        </div>
        <div className="bg-base-100 border-base-300 rounded-lg border px-4 py-3 shadow-sm">
          <div className="text-xs tracking-wide uppercase opacity-50">Releases</div>
          <div className="mt-1 text-xl font-bold">{releases.length}</div>
        </div>
        <div className="bg-base-100 border-base-300 rounded-lg border px-4 py-3 shadow-sm">
          <div className="text-xs tracking-wide uppercase opacity-50">Personas</div>
          <div className="mt-1 text-xl font-bold">{personas.length}</div>
        </div>
      </div>

      {/* ── Layout: sidebar + main ── */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="bg-base-100 border-base-300 sticky top-6 space-y-1 rounded-lg border p-2 shadow-sm">
            {SECTION_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                  activeSection === item.id
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-base-200 opacity-80 hover:opacity-100"
                }`}
              >
                {SECTION_ICONS[item.id]}
                <div className="min-w-0 flex-1">
                  <div className="truncate">{item.label}</div>
                  <div className="truncate text-[10px] opacity-50">{item.helper}</div>
                </div>
                {activeSection === item.id && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile horizontal nav */}
        <div className="scrollbar-hide overflow-x-auto lg:hidden">
          <div className="flex gap-1">
            {SECTION_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`btn btn-sm shrink-0 gap-1.5 ${
                  activeSection === item.id ? "btn-primary" : "btn-ghost"
                }`}
              >
                {SECTION_ICONS[item.id]}
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Main content ── */}
        <main className="min-w-0 flex-1 space-y-4">
          {activeSection === "providers" && (
            <ProvidersModelsSection
              providers={providers}
              models={models}
              routes={routes}
              modelTestImageLinks={modelTestImageLinks}
              createSupportedProvider={createSupportedProvider}
              runModelTest={runModelTest}
              setModelActive={setModelActive}
              reorderModels={reorderModels}
            />
          )}

          {activeSection === "policy" && (
            <PolicyStudioSection
              draft={draft}
              setDraft={setDraft}
              releases={releases}
              policyPreviewInput={policyPreviewInput}
              setPolicyPreviewInput={setPolicyPreviewInput}
              textModels={textModels}
              providers={providers}
              policyPreview={policyPreview}
              createDraft={createDraft}
              publishRelease={publishRelease}
              runPolicyPreview={runPolicyPreview}
            />
          )}

          {activeSection === "routes" && (
            <ModelRoutingSection
              routeDrafts={routeDrafts}
              setRouteDrafts={setRouteDrafts}
              providers={providers}
              models={models}
              saveRoute={saveRoute}
            />
          )}

          {activeSection === "persona" && (
            <PersonaGenerationSection
              personaGeneration={personaGeneration}
              setPersonaGeneration={setPersonaGeneration}
              personaGenerationModels={personaGenerationModels}
              providers={providers}
              personaGenerationLoading={personaGenerationLoading}
              personaPreviewRunCount={personaPreviewRunCount}
              personaLastSavedAt={personaLastSavedAt}
              personaSaveForm={personaSaveForm}
              setPersonaSaveForm={setPersonaSaveForm}
              personaSaveLoading={personaSaveLoading}
              personaGenerationPreview={personaGenerationPreview}
              personaStepStatus={personaStepStatus}
              runPersonaGenerationPreview={runPersonaGenerationPreview}
              savePersonaFromGeneration={savePersonaFromGeneration}
            />
          )}

          {activeSection === "preview" && (
            <PersonaInteractionSection
              interactionInput={interactionInput}
              setInteractionInput={setInteractionInput}
              personas={personas}
              textModels={textModels}
              providers={providers}
              interactionPreview={interactionPreview}
              selectedPersona={selectedPersona}
              applyRoutePrimaryModel={applyRoutePrimaryModel}
              runInteractionPreview={runInteractionPreview}
              routePrimaryModelLabel={routePrimaryModelLabel}
            />
          )}
        </main>
      </div>

      {rollbackModalOpen ? (
        <dialog className="modal modal-open" open>
          <div className="modal-box max-w-2xl space-y-4">
            <h3 className="text-lg font-semibold">Rollback Policy Release</h3>
            <div className="form-control w-full">
              <label className="label py-0.5">
                <span className="label-text text-xs font-semibold opacity-70">Target Release</span>
              </label>
              <select
                className="select select-bordered select-sm w-full"
                value={rollbackVersion ?? ""}
                onChange={(event) => setRollbackVersion(Number(event.target.value) || null)}
              >
                <option value="">Select release</option>
                {releases.map((item) => (
                  <option key={item.version} value={item.version} disabled={item.isActive}>
                    v{item.policyVersion} (release #{item.version})
                    {item.isActive ? " - active" : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedRollbackRelease ? (
              <div className="border-base-300 bg-base-200/30 space-y-2 rounded-lg border p-3">
                <div className="text-xs opacity-70">
                  Preview: v{selectedRollbackRelease.policyVersion} / release #
                  {selectedRollbackRelease.version}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-semibold opacity-70">Core Goal</div>
                    <p className="text-xs whitespace-pre-wrap">
                      {selectedRollbackRelease.globalPolicyDraft.coreGoal || "-"}
                    </p>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold opacity-70">Style Guide</div>
                    <p className="text-xs whitespace-pre-wrap">
                      {selectedRollbackRelease.globalPolicyDraft.styleGuide || "-"}
                    </p>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold opacity-70">Global Policy</div>
                  <p className="text-xs whitespace-pre-wrap">
                    {selectedRollbackRelease.globalPolicyDraft.globalPolicy || "-"}
                  </p>
                </div>
                <div>
                  <div className="text-[11px] font-semibold opacity-70">Forbidden Rules</div>
                  <p className="text-xs whitespace-pre-wrap">
                    {selectedRollbackRelease.globalPolicyDraft.forbiddenRules || "-"}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="modal-action">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setRollbackModalOpen(false);
                  setRollbackVersion(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-warning btn-sm"
                disabled={!selectedRollbackRelease}
                onClick={() => {
                  if (!selectedRollbackRelease) {
                    return;
                  }
                  void rollbackRelease(selectedRollbackRelease.version).then(() => {
                    setRollbackModalOpen(false);
                    setRollbackVersion(null);
                  });
                }}
              >
                Confirm Rollback
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button
              onClick={() => {
                setRollbackModalOpen(false);
                setRollbackVersion(null);
              }}
            >
              close
            </button>
          </form>
        </dialog>
      ) : null}
    </div>
  );
}
