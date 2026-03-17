"use client";

import { RefreshCw, Cpu, ChevronRight } from "lucide-react";
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

type Props = {
  initialProviders: AiProviderConfig[];
  initialModels: AiModelConfig[];
  initialReleases: PolicyReleaseListItem[];
  initialPersonas: PersonaItem[];
};

export default function AiControlPlanePanel(props: Props) {
  const {
    activeSection,
    setActiveSection,
    providers,
    models,
    releases,
    personas,
    draft,
    setDraft,
    policyPreview,
    personaGeneration,
    setPersonaGeneration,
    personaUpdate,
    setPersonaUpdate,
    personaGenerationLoading,
    personaUpdateLoading,
    personaPromptAssistLoading,
    personaPromptAssistError,
    personaPromptAssistElapsedSeconds,
    personaUpdatePromptAssistLoading,
    personaUpdatePromptAssistError,
    personaUpdatePromptAssistElapsedSeconds,
    personaPreviewRunCount,
    personaLastSavedAt,
    personaSaveLoading,
    personaSaveForm,
    setPersonaSaveForm,
    personaGenerationPreview,
    personaPromptAssemblyGlobalPolicyContent,
    personaGenerationMode,
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
    selectedUpdatePersona,
    selectedUpdatePersonaProfile,
    interactionTaskAssistLoading,
    interactionTaskAssistError,
    interactionTaskAssistElapsedSeconds,
    modelTestImageLinks,
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
    previewSelectedPolicyDraft,
    rollbackRelease,
    deletePolicyRelease,
    viewPolicyVersion,
    runPersonaGenerationPreview,
    runPersonaUpdatePreview,
    assistPersonaPrompt,
    assistPersonaUpdatePrompt,
    closePersonaGenerationModal,
    savePersonaFromGeneration,
    runInteractionPreview,
    closeInteractionPreviewModal,
    assistInteractionTaskContext,
    personaStepStatus,
  } = useAiControlPlane(props);

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
              setDraft={setDraft}
              activeReleaseVersion={activeRelease?.version ?? null}
              releases={releases}
              viewPolicyVersion={viewPolicyVersion}
              updatePolicy={createDraft}
              publishPolicy={publishNextVersion}
              policyPreview={policyPreview}
              previewSelectedPolicyDraft={previewSelectedPolicyDraft}
              rollbackRelease={rollbackRelease}
              deletePolicyRelease={deletePolicyRelease}
            />
          )}

          {activeSection === "persona" && (
            <PersonaGenerationSection
              personaGeneration={personaGeneration}
              setPersonaGeneration={setPersonaGeneration}
              personaUpdate={personaUpdate}
              setPersonaUpdate={setPersonaUpdate}
              personas={personas}
              selectedUpdatePersona={selectedUpdatePersona}
              selectedUpdatePersonaProfile={selectedUpdatePersonaProfile}
              personaGenerationModels={personaGenerationModels}
              providers={providers}
              personaGenerationLoading={personaGenerationLoading}
              personaUpdateLoading={personaUpdateLoading}
              personaPromptAssistLoading={personaPromptAssistLoading}
              personaPromptAssistError={personaPromptAssistError}
              personaPromptAssistElapsedSeconds={personaPromptAssistElapsedSeconds}
              personaUpdatePromptAssistLoading={personaUpdatePromptAssistLoading}
              personaUpdatePromptAssistError={personaUpdatePromptAssistError}
              personaUpdatePromptAssistElapsedSeconds={personaUpdatePromptAssistElapsedSeconds}
              personaPreviewRunCount={personaPreviewRunCount}
              personaLastSavedAt={personaLastSavedAt}
              personaSaveForm={personaSaveForm}
              setPersonaSaveForm={setPersonaSaveForm}
              personaSaveLoading={personaSaveLoading}
              personaGenerationPreview={personaGenerationPreview}
              promptAssemblyGlobalPolicyContent={personaPromptAssemblyGlobalPolicyContent}
              personaGenerationMode={personaGenerationMode}
              personaGenerationModalOpen={personaGenerationModalOpen}
              personaGenerationModalPhase={personaGenerationModalPhase}
              personaGenerationModalError={personaGenerationModalError}
              personaGenerationModalRawOutput={personaGenerationModalRawOutput}
              personaGenerationElapsedSeconds={personaGenerationElapsedSeconds}
              personaStepStatus={personaStepStatus}
              assistPersonaPrompt={assistPersonaPrompt}
              assistPersonaUpdatePrompt={assistPersonaUpdatePrompt}
              runPersonaGenerationPreview={runPersonaGenerationPreview}
              runPersonaUpdatePreview={runPersonaUpdatePreview}
              closePersonaGenerationModal={closePersonaGenerationModal}
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
              interactionPreviewModalOpen={interactionPreviewModalOpen}
              interactionPreviewModalPhase={interactionPreviewModalPhase}
              interactionPreviewModalError={interactionPreviewModalError}
              interactionPreviewElapsedSeconds={interactionPreviewElapsedSeconds}
              selectedPersona={selectedPersona}
              selectedPersonaProfile={selectedPersonaProfile}
              interactionTaskAssistLoading={interactionTaskAssistLoading}
              interactionTaskAssistError={interactionTaskAssistError}
              interactionTaskAssistElapsedSeconds={interactionTaskAssistElapsedSeconds}
              runInteractionPreview={runInteractionPreview}
              closeInteractionPreviewModal={closeInteractionPreviewModal}
              assistInteractionTaskContext={assistInteractionTaskContext}
            />
          )}
        </main>
      </div>
    </div>
  );
}
