"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { UserPlus, Sparkles, Bot, WandSparkles, Pause, Eye } from "lucide-react";
import type {
  AiModelConfig,
  AiProviderConfig,
  PreviewResult,
  PersonaGenerationStructured,
} from "@/lib/ai/admin/control-plane-store";
import type { PromptAssemblyPreview } from "@/lib/ai/admin/persona-generation-prompt-template";
import { SectionCard } from "../SectionCard";
import { PersonaGenerationModal } from "../PersonaGenerationModal";
import { optionLabelForModel } from "../control-plane-utils";
import { PromptAssemblyModal } from "../PromptAssemblyModal";
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
  promptAssemblyPreview: PromptAssemblyPreview | null;
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
  promptAssemblyPreview,
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
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
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
                    placeholder="Context, worldview, or a favorite celebrity..."
                  />
                  <button
                    className="bg-base-100 border-base-300 hover:border-primary hover:bg-base-100 btn btn-sm join-item gap-2 border shadow-none"
                    disabled={!personaGeneration.modelId}
                    aria-label="Prompt AI"
                    title="Prompt AI"
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
                    "Empty prompt: generate a concise English prompt. Existing prompt: optimize in the same language. You can include named references here."}
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    className="btn btn-outline btn-sm gap-2"
                    disabled={!promptAssemblyPreview}
                    onClick={() => setIsPromptModalOpen(true)}
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
                </div>
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
        lastSavedAt={personaLastSavedAt}
        saveForm={personaSaveForm}
        setSaveForm={setPersonaSaveForm}
        isGenerating={personaGenerationLoading}
        isSaving={personaSaveLoading}
        onClose={closePersonaGenerationModal}
        onRegenerate={runPersonaGenerationPreview}
        onSave={savePersonaFromGeneration}
      />
      <PromptAssemblyModal
        isOpen={isPromptModalOpen}
        preview={promptAssemblyPreview}
        onClose={() => setIsPromptModalOpen(false)}
      />
    </>
  );
}
