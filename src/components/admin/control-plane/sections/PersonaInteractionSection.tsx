import type { Dispatch, SetStateAction } from "react";
import { MessageSquare, Eye, WandSparkles, Pause } from "lucide-react";
import type {
  AiModelConfig,
  AiProviderConfig,
  PersonaProfile,
  PreviewResult,
} from "@/lib/ai/admin/control-plane-store";
import type { PersonaItem } from "@/lib/ai/admin/control-plane-types";
import PersonaSelector from "@/components/ui/PersonaSelector";
import { SectionCard } from "../SectionCard";
import { ModelSelectionField } from "../ModelSelectionField";
import { InteractionPreviewModal } from "../InteractionPreviewModal";
import { PersonaInfoCard } from "../PersonaInfoCard";
import { defaultInteractionTaskContext } from "../control-plane-utils";
import {
  formatPromptAssistStatus,
  readPromptAssistButtonMode,
} from "../persona-prompt-assist-utils";
import type { PersonaGenerationModalPhase } from "../persona-generation-modal-utils";

export interface PersonaInteractionSectionProps {
  interactionInput: {
    personaId: string;
    modelId: string;
    taskType: "post" | "comment";
    taskContext: string;
  };
  setInteractionInput: Dispatch<
    SetStateAction<{
      personaId: string;
      modelId: string;
      taskType: "post" | "comment";
      taskContext: string;
    }>
  >;
  personas: PersonaItem[];
  textModels: AiModelConfig[];
  providers: AiProviderConfig[];
  interactionPreview: PreviewResult | null;
  interactionPreviewModalOpen: boolean;
  interactionPreviewModalPhase: PersonaGenerationModalPhase;
  interactionPreviewModalError: string | null;
  interactionPreviewElapsedSeconds: number;
  selectedPersona: PersonaItem | null;
  selectedPersonaProfile: PersonaProfile | null;
  interactionTaskAssistLoading: boolean;
  interactionTaskAssistError: string | null;
  interactionTaskAssistElapsedSeconds: number;
  runInteractionPreview: () => Promise<void>;
  closeInteractionPreviewModal: () => void;
  assistInteractionTaskContext: () => Promise<void>;
}

export function PersonaInteractionSection({
  interactionInput,
  setInteractionInput,
  personas,
  textModels,
  providers,
  interactionPreview,
  interactionPreviewModalOpen,
  interactionPreviewModalPhase,
  interactionPreviewModalError,
  interactionPreviewElapsedSeconds,
  selectedPersona,
  selectedPersonaProfile,
  interactionTaskAssistLoading,
  interactionTaskAssistError,
  interactionTaskAssistElapsedSeconds,
  runInteractionPreview,
  closeInteractionPreviewModal,
  assistInteractionTaskContext,
}: PersonaInteractionSectionProps) {
  const taskAssistButtonMode = readPromptAssistButtonMode(interactionTaskAssistLoading);
  const taskAssistStatus = formatPromptAssistStatus(
    interactionTaskAssistLoading,
    false,
    interactionTaskAssistElapsedSeconds,
    interactionTaskAssistError,
  );

  const runPreviewDisabled =
    interactionInput.taskContext.trim().length === 0 || interactionPreviewModalPhase === "loading";

  return (
    <div className="space-y-6">
      <SectionCard title="Interaction Preview" icon={<MessageSquare className="h-4 w-4" />}>
        <div className="space-y-6">
          <div className="space-y-6">
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold opacity-70">Target Persona</span>
              </label>
              <PersonaSelector
                value={interactionInput.personaId}
                initialOptions={personas.map((p) => ({
                  id: p.id,
                  username: p.username,
                  display_name: p.display_name,
                  avatar_url: p.avatar_url,
                }))}
                onChange={(personaId) => setInteractionInput((prev) => ({ ...prev, personaId }))}
                placeholder="Search persona..."
              />
            </div>
            <ModelSelectionField
              value={interactionInput.modelId}
              models={textModels}
              providers={providers}
              onChange={(modelId) => setInteractionInput((prev) => ({ ...prev, modelId }))}
            />
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold opacity-70">Task Category</span>
              </label>
              <select
                className="select select-bordered select-sm w-full"
                value={interactionInput.taskType}
                onChange={(e) => {
                  const taskType = e.target.value as "post" | "comment";
                  setInteractionInput((prev) => ({
                    ...prev,
                    taskType,
                    taskContext: defaultInteractionTaskContext(taskType),
                  }));
                }}
              >
                <option value="post">Post Generation</option>
                <option value="comment">Comment Response</option>
              </select>
            </div>
          </div>

          {selectedPersona && (
            <PersonaInfoCard persona={selectedPersona} profile={selectedPersonaProfile} />
          )}

          <div className="space-y-5">
            <div className="form-control w-full">
              <div className="label flex items-center justify-between gap-3 py-1">
                <span className="label-text text-xs font-semibold opacity-70">
                  Task Context / Content
                </span>
                <button
                  type="button"
                  className="btn btn-outline border-base-300 text-base-content hover:border-primary hover:text-primary btn-xs ml-auto gap-1 shadow-none"
                  disabled={!interactionInput.modelId}
                  onClick={() => void assistInteractionTaskContext()}
                >
                  {taskAssistButtonMode === "cancel" ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <WandSparkles className="h-3.5 w-3.5" />
                  )}
                  AI
                </button>
              </div>
              <textarea
                className="textarea textarea-bordered focus:textarea-primary h-28 w-full font-mono text-sm leading-relaxed"
                value={interactionInput.taskContext}
                onChange={(e) =>
                  setInteractionInput((prev) => ({ ...prev, taskContext: e.target.value }))
                }
                placeholder="Paste post/comment content to test response assembly..."
              />
              <div
                className={`mt-2 text-xs ${interactionTaskAssistError ? "text-error" : "opacity-55"}`}
              >
                {taskAssistStatus ??
                  "Use AI to generate a random scenario for this interaction preview."}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  className="btn btn-primary btn-sm gap-2 shadow-sm"
                  disabled={runPreviewDisabled}
                  onClick={() => void runInteractionPreview()}
                >
                  {interactionPreviewModalPhase === "loading" ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  {interactionPreviewModalPhase === "loading" ? "Generating..." : "Run Preview"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <InteractionPreviewModal
        isOpen={interactionPreviewModalOpen}
        phase={interactionPreviewModalPhase}
        preview={interactionPreview}
        errorMessage={interactionPreviewModalError}
        elapsedSeconds={interactionPreviewElapsedSeconds}
        isGenerating={interactionPreviewModalPhase === "loading"}
        selectedPersona={selectedPersona}
        selectedPersonaProfile={selectedPersonaProfile}
        onClose={closeInteractionPreviewModal}
        onRerun={runInteractionPreview}
      />
    </div>
  );
}
