"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Cpu, ChevronRight, Sparkles, Trash2 } from "lucide-react";
import { useAiControlPlane } from "@/hooks/admin/useAiControlPlane";
import { type PersonaItem, SECTION_ICONS, SECTION_ITEMS } from "@/lib/ai/admin/control-plane-types";
import type {
  AiModelConfig,
  AiProviderConfig,
  PolicyReleaseListItem,
} from "@/lib/ai/admin/control-plane-store";

import { ProvidersModelsSection } from "./control-plane/sections/ProvidersModelsSection";
import { PolicyStudioSection } from "./control-plane/sections/PolicyStudioSection";
import { PersonaGenerationSection } from "./control-plane/sections/PersonaGenerationSection";
import { PersonaInteractionSection } from "./control-plane/sections/PersonaInteractionSection";
import ConfirmModal from "@/components/ui/ConfirmModal";

type Props = {
  initialProviders: AiProviderConfig[];
  initialModels: AiModelConfig[];
  initialReleases: PolicyReleaseListItem[];
  initialPersonas: PersonaItem[];
};

export default function AiControlPlanePanel(props: Props) {
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [versionDropdownOpen, setVersionDropdownOpen] = useState(false);
  const [deleteReleaseTarget, setDeleteReleaseTarget] = useState<PolicyReleaseListItem | null>(
    null,
  );
  const [deleteReleaseLoading, setDeleteReleaseLoading] = useState(false);
  const versionDropdownRef = useRef<HTMLDivElement | null>(null);

  const {
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
    rollbackRelease,
    deletePolicyRelease,
    runPersonaGenerationPreview,
    savePersonaFromGeneration,
    runInteractionPreview,
    applyRoutePrimaryModel,
    routePrimaryModelLabel,
    personaStepStatus,
  } = useAiControlPlane(props);

  const currentPolicyVersion = activeRelease?.version ?? 1;
  const nextPolicyVersion = currentPolicyVersion + 1;
  const selectablePolicyVersions = useMemo(() => {
    const versions = new Set<number>([currentPolicyVersion, nextPolicyVersion]);
    for (const item of releases) {
      versions.add(item.version);
    }
    return Array.from(versions).sort((a, b) => b - a);
  }, [releases, currentPolicyVersion, nextPolicyVersion]);
  const versionItems = useMemo(() => {
    return selectablePolicyVersions.map((version) => {
      const latestForVersion =
        releases
          .filter((item) => item.version === version)
          .sort((a, b) => b.version - a.version)[0] ?? null;
      const kind =
        version === currentPolicyVersion
          ? "current"
          : version === nextPolicyVersion
            ? "next"
            : "historical";
      return {
        version,
        kind,
        release: latestForVersion,
        canDelete: Boolean(latestForVersion && !latestForVersion.isActive),
      };
    });
  }, [selectablePolicyVersions, releases, currentPolicyVersion, nextPolicyVersion]);
  const isNextSelectedPolicyVersion = draft.selectedVersion === nextPolicyVersion;
  const isCurrentSelectedPolicyVersion = draft.selectedVersion === currentPolicyVersion;
  const isHistoricalSelectedPolicyVersion =
    !isCurrentSelectedPolicyVersion && !isNextSelectedPolicyVersion;
  const canEditSelectedPolicyVersion =
    draft.selectedVersion === currentPolicyVersion || isNextSelectedPolicyVersion;
  const canSaveSelectedPolicyVersion = draft.selectedVersion === currentPolicyVersion;
  const selectedRollbackRelease = useMemo(() => {
    const release = releases.find((item) => item.version === draft.selectedVersion);
    if (!release || release.isActive) {
      return null;
    }
    return release;
  }, [releases, draft.selectedVersion]);

  useEffect(() => {
    if (selectablePolicyVersions.includes(draft.selectedVersion)) {
      return;
    }
    setDraft((prev) => ({
      ...prev,
      selectedVersion: currentPolicyVersion,
    }));
  }, [selectablePolicyVersions, currentPolicyVersion, draft.selectedVersion, setDraft]);

  useEffect(() => {
    const sourcePolicyVersion = isNextSelectedPolicyVersion
      ? currentPolicyVersion
      : draft.selectedVersion;
    const selectedRelease = releases.find((item) => item.version === sourcePolicyVersion) ?? null;
    if (!selectedRelease) {
      return;
    }
    setDraft((prev) => ({
      ...prev,
      coreGoal: selectedRelease.globalPolicyDraft.coreGoal ?? "",
      globalPolicy: selectedRelease.globalPolicyDraft.globalPolicy ?? "",
      styleGuide: selectedRelease.globalPolicyDraft.styleGuide ?? "",
      forbiddenRules: selectedRelease.globalPolicyDraft.forbiddenRules ?? "",
    }));
    setPolicyPreviewInput((prev) => ({
      ...prev,
      releaseId: String(selectedRelease.version),
    }));
  }, [
    draft.selectedVersion,
    releases,
    setDraft,
    setPolicyPreviewInput,
    currentPolicyVersion,
    isNextSelectedPolicyVersion,
  ]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!versionDropdownRef.current) {
        return;
      }
      if (versionDropdownRef.current.contains(event.target as Node)) {
        return;
      }
      setVersionDropdownOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

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
            Manage providers, policies, models, and persona workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div ref={versionDropdownRef} className="relative">
            <div
              tabIndex={0}
              role="button"
              className="select select-bordered select-xs w-44 items-center justify-between px-3 text-left"
              onClick={() => setVersionDropdownOpen((open) => !open)}
            >
              <span>
                v{draft.selectedVersion}
                {draft.selectedVersion === currentPolicyVersion
                  ? " (current)"
                  : draft.selectedVersion === nextPolicyVersion
                    ? " (next)"
                    : " (historical)"}
              </span>
            </div>
            {versionDropdownOpen ? (
              <ul className="menu bg-base-100 border-base-300 rounded-box absolute top-full left-0 z-20 mt-1 w-72 border p-1 shadow">
                {versionItems.map((item) => (
                  <li key={`version-item-${item.version}`}>
                    <div
                      className="hover:bg-base-200 flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-0.5"
                      onClick={() => {
                        setDraft((prev) => ({ ...prev, selectedVersion: item.version }));
                        setVersionDropdownOpen(false);
                      }}
                    >
                      <div className="flex min-h-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-sm">
                        v{item.version} ({item.kind})
                        {item.release ? (
                          <span className="text-[10px] opacity-60">
                            release #{item.release.version}
                          </span>
                        ) : null}
                      </div>
                      {item.canDelete && item.release ? (
                        <button
                          className="btn btn-ghost btn-xs text-error"
                          title="Delete inactive release"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteReleaseTarget(item.release);
                            setVersionDropdownOpen(false);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {isNextSelectedPolicyVersion ? (
            <button className="btn btn-primary btn-sm" onClick={() => void publishNextVersion()}>
              Publish
            </button>
          ) : isCurrentSelectedPolicyVersion ? (
            <button className="btn btn-primary btn-sm" onClick={() => void createDraft()}>
              Update
            </button>
          ) : (
            <button
              className="btn btn-outline btn-sm"
              disabled={!isHistoricalSelectedPolicyVersion || !selectedRollbackRelease}
              onClick={() => setRollbackModalOpen(true)}
            >
              Rollback
            </button>
          )}
          <button className="btn btn-outline btn-sm gap-1" onClick={() => void refreshAll()}>
            <RefreshCw className="h-3.5 w-3.5" />
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
              canEditDraft={canEditSelectedPolicyVersion}
              canSaveDraft={canSaveSelectedPolicyVersion}
              setDraft={setDraft}
              releases={releases}
              policyPreviewInput={policyPreviewInput}
              setPolicyPreviewInput={setPolicyPreviewInput}
              textModels={textModels}
              providers={providers}
              policyPreview={policyPreview}
              createDraft={createDraft}
              runPolicyPreview={runPolicyPreview}
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

      <ConfirmModal
        isOpen={rollbackModalOpen}
        onClose={() => setRollbackModalOpen(false)}
        onConfirm={() => {
          if (!selectedRollbackRelease) {
            return;
          }
          setRollbackLoading(true);
          void rollbackRelease(selectedRollbackRelease.version)
            .then(() => setRollbackModalOpen(false))
            .finally(() => setRollbackLoading(false));
        }}
        title="Rollback Policy Release"
        message={`Rollback active policy to selected version v${draft.selectedVersion}.`}
        confirmText="Confirm Rollback"
        variant="warning"
        isLoading={rollbackLoading}
        confirmDisabled={!selectedRollbackRelease}
      >
        <div className="border-base-300 bg-base-200/30 rounded-lg border p-3 text-xs opacity-80">
          Target policy version: <span className="font-semibold">v{draft.selectedVersion}</span>
          {selectedRollbackRelease ? (
            <span> (release #{selectedRollbackRelease.version})</span>
          ) : (
            <span> (no rollback candidate)</span>
          )}
        </div>

        {selectedRollbackRelease ? (
          <div className="border-base-300 bg-base-200/30 space-y-2 rounded-lg border p-3">
            <div className="text-xs opacity-70">
              Preview release #{selectedRollbackRelease.version}
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
      </ConfirmModal>

      <ConfirmModal
        isOpen={Boolean(deleteReleaseTarget)}
        onClose={() => setDeleteReleaseTarget(null)}
        onConfirm={() => {
          if (!deleteReleaseTarget) {
            return;
          }
          setDeleteReleaseLoading(true);
          void deletePolicyRelease(deleteReleaseTarget.version)
            .then(() => setDeleteReleaseTarget(null))
            .finally(() => setDeleteReleaseLoading(false));
        }}
        title="Delete Policy Release"
        message={
          deleteReleaseTarget
            ? `Delete inactive release #${deleteReleaseTarget.version}?`
            : "Delete policy release?"
        }
        confirmText="Delete"
        variant="danger"
        isLoading={deleteReleaseLoading}
      />
    </div>
  );
}
