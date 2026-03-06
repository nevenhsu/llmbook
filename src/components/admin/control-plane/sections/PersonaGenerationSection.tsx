import type { Dispatch, SetStateAction } from "react";
import { UserPlus, Sparkles, Bot, WandSparkles, Pause } from "lucide-react";
import type {
  AiModelConfig,
  AiProviderConfig,
  PreviewResult,
  PersonaGenerationStructured,
} from "@/lib/ai/admin/control-plane-store";
import { SectionCard } from "../SectionCard";
import { PersonaGenerationModal } from "../PersonaGenerationModal";
import { optionLabelForModel } from "../control-plane-utils";
import {
  formatPromptAssistStatus,
  readPromptAssistButtonMode,
} from "../persona-prompt-assist-utils";
import type { PersonaGenerationModalPhase } from "../persona-generation-modal-utils";

export interface PersonaGenerationSectionProps {
  personaGeneration: {
    modelId: string;
    extraPrompt: string;
  };
  setPersonaGeneration: Dispatch<
    SetStateAction<{
      modelId: string;
      extraPrompt: string;
    }>
  >;
  personaGenerationModels: AiModelConfig[];
  providers: AiProviderConfig[];
  personaGenerationLoading: boolean;
  personaPromptAssistLoading: boolean;
  personaPromptAssistError: string | null;
  personaPromptAssistElapsedSeconds: number;
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
  personaGenerationModalOpen: boolean;
  personaGenerationModalPhase: PersonaGenerationModalPhase;
  personaGenerationModalError: string | null;
  personaGenerationModalRawOutput: string | null;
  personaGenerationElapsedSeconds: number;
  personaStepStatus: {
    generated: boolean;
    saved: boolean;
  };
  assistPersonaPrompt: () => Promise<void>;
  runPersonaGenerationPreview: () => Promise<void>;
  closePersonaGenerationModal: () => void;
  savePersonaFromGeneration: () => Promise<void>;
}

export function PersonaGenerationSection({
  personaGeneration,
  setPersonaGeneration,
  personaGenerationModels,
  providers,
  personaGenerationLoading,
  personaPromptAssistLoading,
  personaPromptAssistError,
  personaPromptAssistElapsedSeconds,
  personaPreviewRunCount,
  personaLastSavedAt,
  personaSaveForm,
  setPersonaSaveForm,
  personaSaveLoading,
  personaGenerationPreview,
  personaGenerationModalOpen,
  personaGenerationModalPhase,
  personaGenerationModalError,
  personaGenerationModalRawOutput,
  personaGenerationElapsedSeconds,
  personaStepStatus,
  assistPersonaPrompt,
  runPersonaGenerationPreview,
  closePersonaGenerationModal,
  savePersonaFromGeneration,
}: PersonaGenerationSectionProps) {
  const promptAssistButtonMode = readPromptAssistButtonMode(personaPromptAssistLoading);
  const promptAssistStatus = formatPromptAssistStatus(
    personaPromptAssistLoading,
    personaPromptAssistElapsedSeconds,
    personaPromptAssistError,
  );

  return (
    <>
      <div className="space-y-6">
        <SectionCard title="Generate Persona" icon={<UserPlus className="h-4 w-4" />}>
          <div className="space-y-6">
            <p className="max-w-2xl text-sm leading-relaxed opacity-60">
              Choose a model, shape the extra prompt, and generate a structured persona preview in
              the modal.
            </p>

            <div className="space-y-5">
              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold opacity-70">
                    Model Selection
                  </span>
                </label>
                <select
                  className="select select-bordered select-sm focus:select-primary w-full"
                  value={personaGeneration.modelId}
                  onChange={(e) =>
                    setPersonaGeneration((prev) => ({ ...prev, modelId: e.target.value }))
                  }
                >
                  {personaGenerationModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {optionLabelForModel(model, providers)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold opacity-70">
                    Context / Extra Prompt
                  </span>
                </label>
                <div className="join w-full">
                  <input
                    className="input input-bordered input-sm focus:input-primary join-item w-full"
                    value={personaGeneration.extraPrompt}
                    onChange={(e) =>
                      setPersonaGeneration((prev) => ({ ...prev, extraPrompt: e.target.value }))
                    }
                    placeholder="Specific background context or guidelines for this persona..."
                  />
                  <button
                    className="bg-base-100 border-base-300 hover:border-primary hover:bg-base-100 btn btn-sm join-item gap-2 border shadow-none"
                    disabled={!personaGeneration.modelId}
                    onClick={() => void assistPersonaPrompt()}
                  >
                    {promptAssistButtonMode === "cancel" ? (
                      <>
                        <Pause className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        <WandSparkles className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
                <div
                  className={`mt-2 text-xs ${personaPromptAssistError ? "text-error" : "opacity-55"}`}
                >
                  {promptAssistStatus ??
                    "Empty prompt: generate a concise English prompt. Existing prompt: optimize in the same language."}
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  className="btn btn-primary btn-sm gap-2 shadow-sm"
                  disabled={personaGenerationLoading}
                  onClick={() => void runPersonaGenerationPreview()}
                >
                  <Sparkles className="h-4 w-4" />
                  {personaGenerationLoading
                    ? "Generating…"
                    : personaPreviewRunCount > 0
                      ? "Regenerate Content"
                      : "Generate Persona"}
                </button>
              </div>
            </div>

            {personaGenerationModels.length === 0 && (
              <div className="alert alert-warning text-sm shadow-sm">
                <div className="flex gap-2">
                  <Bot className="h-5 w-5" />
                  <span>
                    No eligible model. Add API key to provider and enable at least one
                    text_generation model.
                  </span>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <PersonaGenerationModal
        isOpen={personaGenerationModalOpen}
        phase={personaGenerationModalPhase}
        errorMessage={personaGenerationModalError}
        rawOutput={personaGenerationModalRawOutput}
        elapsedSeconds={personaGenerationElapsedSeconds}
        preview={personaGenerationPreview}
        runCount={personaPreviewRunCount}
        lastSavedAt={personaLastSavedAt}
        saveForm={personaSaveForm}
        setSaveForm={setPersonaSaveForm}
        isGenerating={personaGenerationLoading}
        isSaving={personaSaveLoading}
        onClose={closePersonaGenerationModal}
        onRegenerate={runPersonaGenerationPreview}
        onSave={savePersonaFromGeneration}
      />
    </>
  );
}
