"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { UserPlus, Sparkles, Eye, RefreshCw } from "lucide-react";
import type {
  AiModelConfig,
  AiProviderConfig,
  PersonaProfile,
  PreviewResult,
  PersonaGenerationStructured,
} from "@/lib/ai/admin/control-plane-store";
import {
  buildPersonaGenerationPromptTemplatePreview,
  type PromptAssemblyPreview,
} from "@/lib/ai/admin/persona-generation-prompt-template";
import type { PersonaItem } from "@/lib/ai/admin/control-plane-types";
import { PersonaGenerationModal } from "../PersonaGenerationModal";
import { PromptAssemblyModal } from "../PromptAssemblyModal";
import type { PersonaGenerationModalPhase } from "../persona-generation-modal-utils";
import { PersonaPromptCard } from "../PersonaPromptCard";

export interface PersonaGenerationSectionProps {
  personaGeneration: {
    modelId: string;
    extraPrompt: string;
    referenceNames: string;
  };
  setPersonaGeneration: Dispatch<
    SetStateAction<{
      modelId: string;
      extraPrompt: string;
      referenceNames: string;
    }>
  >;
  personaUpdate: {
    personaId: string;
    modelId: string;
    extraPrompt: string;
    referenceNames: string;
  };
  setPersonaUpdate: Dispatch<
    SetStateAction<{
      personaId: string;
      modelId: string;
      extraPrompt: string;
      referenceNames: string;
    }>
  >;
  personas: PersonaItem[];
  selectedUpdatePersona: PersonaItem | null;
  selectedUpdatePersonaProfile: PersonaProfile | null;
  selectedUpdatePersonaProfileLoading: boolean;
  personaGenerationModels: AiModelConfig[];
  providers: AiProviderConfig[];
  personaGenerationLoading: boolean;
  personaUpdateLoading: boolean;
  personaPromptAssistLoading: boolean;
  personaPromptAssistError: string | null;
  personaPromptAssistCompleted: boolean;
  personaPromptAssistElapsedSeconds: number;
  personaUpdatePromptAssistLoading: boolean;
  personaUpdatePromptAssistError: string | null;
  personaUpdatePromptAssistCompleted: boolean;
  personaUpdatePromptAssistElapsedSeconds: number;
  personaPreviewRunCount: number;
  personaLastSavedAt: string | null;
  personaSaveForm: {
    displayName: string;
    username: string;
  };
  setPersonaSaveForm: Dispatch<
    SetStateAction<{
      displayName: string;
      username: string;
    }>
  >;
  personaSaveLoading: boolean;
  personaGenerationPreview: (PreviewResult & { structured: PersonaGenerationStructured }) | null;
  personaGenerationMode: "create" | "update";
  personaGenerationModalOpen: boolean;
  personaGenerationModalPhase: PersonaGenerationModalPhase;
  personaGenerationModalError: string | null;
  personaGenerationModalErrorDetails: Record<string, unknown> | null;
  personaGenerationModalRawOutput: string | null;
  personaGenerationElapsedSeconds: number;
  personaStepStatus: {
    generated: boolean;
    saved: boolean;
  };
  assistPersonaPrompt: () => Promise<void>;
  assistPersonaUpdatePrompt: () => Promise<void>;
  runPersonaGenerationPreview: () => Promise<void>;
  runPersonaUpdatePreview: () => Promise<void>;
  closePersonaGenerationModal: () => void;
  savePersonaFromGeneration: () => Promise<void>;
}

export function PersonaGenerationSection({
  personaGeneration,
  setPersonaGeneration,
  personaUpdate,
  setPersonaUpdate,
  personas,
  selectedUpdatePersona,
  selectedUpdatePersonaProfile,
  selectedUpdatePersonaProfileLoading,
  personaGenerationModels,
  providers,
  personaGenerationLoading,
  personaUpdateLoading,
  personaPromptAssistLoading,
  personaPromptAssistError,
  personaPromptAssistCompleted,
  personaPromptAssistElapsedSeconds,
  personaUpdatePromptAssistLoading,
  personaUpdatePromptAssistError,
  personaUpdatePromptAssistCompleted,
  personaUpdatePromptAssistElapsedSeconds,
  personaLastSavedAt,
  personaSaveForm,
  setPersonaSaveForm,
  personaSaveLoading,
  personaGenerationPreview,
  personaGenerationMode,
  personaGenerationModalOpen,
  personaGenerationModalPhase,
  personaGenerationModalError,
  personaGenerationModalErrorDetails,
  personaGenerationModalRawOutput,
  personaGenerationElapsedSeconds,
  assistPersonaPrompt,
  assistPersonaUpdatePrompt,
  runPersonaGenerationPreview,
  runPersonaUpdatePreview,
  closePersonaGenerationModal,
  savePersonaFromGeneration,
}: PersonaGenerationSectionProps) {
  const [promptModalPreview, setPromptModalPreview] = useState<PromptAssemblyPreview | null>(null);
  const modalTitle = personaGenerationMode === "update" ? "Update Persona" : "Persona Generation";
  const modalPrimaryActionLabel = personaGenerationMode === "update" ? "Update" : "Save";
  const modalCompletedActionLabel = personaGenerationMode === "update" ? "Updated" : "Saved";
  const modalSuccessDescription =
    personaGenerationMode === "update"
      ? "Review the regenerated persona data before updating the existing persona record."
      : "Review the generated persona data before saving it to the database.";
  const modalErrorDescription =
    personaGenerationMode === "update"
      ? "Update preview failed. Review the error or regenerate."
      : "Generation failed. Review the error or regenerate.";
  const generatePromptAssemblyPreview = useMemo(
    () =>
      buildPersonaGenerationPromptTemplatePreview({
        extraPrompt: personaGeneration.extraPrompt,
        referenceNames: personaGeneration.referenceNames,
      }),
    [personaGeneration.extraPrompt, personaGeneration.referenceNames],
  );
  const canRunUpdate =
    Boolean(personaUpdate.personaId) &&
    Boolean(personaUpdate.modelId) &&
    Boolean(selectedUpdatePersonaProfile) &&
    !selectedUpdatePersonaProfileLoading &&
    !personaUpdateLoading &&
    personaGenerationModels.length > 0;

  return (
    <>
      <div className="space-y-6">
        <PersonaPromptCard
          title="Generate Persona"
          icon={<UserPlus className="h-4 w-4" />}
          description="Choose a model, shape the extra prompt, and generate a structured persona preview in the modal."
          modelId={personaGeneration.modelId}
          models={personaGenerationModels}
          providers={providers}
          onModelChange={(modelId) => setPersonaGeneration((prev) => ({ ...prev, modelId }))}
          extraPrompt={personaGeneration.extraPrompt}
          onExtraPromptChange={(value) =>
            setPersonaGeneration((prev) => ({ ...prev, extraPrompt: value }))
          }
          extraPromptPlaceholder="Context, worldview, or a favorite celebrity..."
          referenceNames={personaGeneration.referenceNames}
          onReferenceNamesChange={(value) =>
            setPersonaGeneration((prev) => ({ ...prev, referenceNames: value }))
          }
          assistAriaLabel="Prompt AI"
          assistLoading={personaPromptAssistLoading}
          assistError={personaPromptAssistError}
          assistCompleted={personaPromptAssistCompleted}
          assistElapsedSeconds={personaPromptAssistElapsedSeconds}
          assistIdleDescription="Empty: generate in English. Existing: refine in the same language."
          onAssist={assistPersonaPrompt}
          footerActions={
            <>
              <button
                className="btn btn-outline btn-sm gap-2"
                disabled={!generatePromptAssemblyPreview}
                onClick={() => setPromptModalPreview(generatePromptAssemblyPreview)}
              >
                <Eye className="h-4 w-4" />
                View Prompt
              </button>
              <button
                className="btn btn-primary btn-sm gap-2 shadow-sm"
                disabled={personaGenerationLoading}
                onClick={() => void runPersonaGenerationPreview()}
              >
                {personaGenerationLoading ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {personaGenerationLoading ? "Generating..." : "Generate Persona"}
              </button>
            </>
          }
        />

        <PersonaPromptCard
          title="Update Persona"
          icon={<RefreshCw className="h-4 w-4" />}
          description="Pick an existing persona, regenerate canonical data against its current bio and reference roles, then review the update in the shared modal before writing it back."
          modelId={personaUpdate.modelId}
          models={personaGenerationModels}
          providers={providers}
          onModelChange={(modelId) => setPersonaUpdate((prev) => ({ ...prev, modelId }))}
          extraPrompt={personaUpdate.extraPrompt}
          onExtraPromptChange={(value) =>
            setPersonaUpdate((prev) => ({ ...prev, extraPrompt: value }))
          }
          extraPromptPlaceholder="Current bio is seeded here..."
          referenceNames={personaUpdate.referenceNames}
          onReferenceNamesChange={(value) =>
            setPersonaUpdate((prev) => ({ ...prev, referenceNames: value }))
          }
          assistAriaLabel="Prompt AI for update"
          assistLoading={personaUpdatePromptAssistLoading}
          assistError={personaUpdatePromptAssistError}
          assistCompleted={personaUpdatePromptAssistCompleted}
          assistElapsedSeconds={personaUpdatePromptAssistElapsedSeconds}
          assistIdleDescription="Starts from current bio and references, then refines with AI."
          assistDisabled={
            selectedUpdatePersonaProfileLoading ||
            !selectedUpdatePersonaProfile ||
            !personaUpdate.personaId
          }
          onAssist={assistPersonaUpdatePrompt}
          footerActions={
            <button
              className="btn btn-primary btn-sm gap-2 shadow-sm"
              disabled={!canRunUpdate}
              onClick={() => void runPersonaUpdatePreview()}
            >
              {personaUpdateLoading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {personaUpdateLoading ? "Generating..." : "Update Persona"}
            </button>
          }
          targetPersonaId={personaUpdate.personaId}
          targetPersonaOptions={personas}
          onTargetPersonaChange={(personaId) =>
            setPersonaUpdate((prev) => ({
              ...prev,
              personaId,
            }))
          }
          targetPersona={selectedUpdatePersona}
          targetPersonaProfile={selectedUpdatePersonaProfile}
        />
      </div>

      <PersonaGenerationModal
        isOpen={personaGenerationModalOpen}
        phase={personaGenerationModalPhase}
        errorMessage={personaGenerationModalError}
        errorDetails={personaGenerationModalErrorDetails}
        rawOutput={personaGenerationModalRawOutput}
        elapsedSeconds={personaGenerationElapsedSeconds}
        preview={personaGenerationPreview}
        lastSavedAt={personaLastSavedAt}
        saveForm={personaSaveForm}
        setSaveForm={setPersonaSaveForm}
        isGenerating={
          personaGenerationMode === "update" ? personaUpdateLoading : personaGenerationLoading
        }
        isSaving={personaSaveLoading}
        title={modalTitle}
        errorDescription={modalErrorDescription}
        successDescription={modalSuccessDescription}
        primaryActionLabel={modalPrimaryActionLabel}
        completedActionLabel={modalCompletedActionLabel}
        onClose={closePersonaGenerationModal}
        onRegenerate={
          personaGenerationMode === "update" ? runPersonaUpdatePreview : runPersonaGenerationPreview
        }
        onSave={savePersonaFromGeneration}
      />
      <PromptAssemblyModal
        isOpen={promptModalPreview !== null}
        preview={promptModalPreview}
        onClose={() => setPromptModalPreview(null)}
      />
    </>
  );
}
