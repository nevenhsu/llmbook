import type { Dispatch, SetStateAction } from "react";
import { MessageSquare, Eye, WandSparkles, Pause } from "lucide-react";
import type {
  AiModelConfig,
  AiProviderConfig,
  PersonaProfile,
  PreviewResult,
} from "@/lib/ai/admin/control-plane-store";
import type { InteractionContextAssistOutput } from "@/lib/ai/admin/interaction-context-assist-schema";
import type { PersonaItem } from "@/lib/ai/admin/control-plane-types";
import PersonaSelector from "@/components/ui/PersonaSelector";
import { SectionCard } from "../SectionCard";
import { ModelSelectionField } from "../ModelSelectionField";
import { InteractionPreviewModal } from "../InteractionPreviewModal";
import { PersonaInfoCard } from "../PersonaInfoCard";
import { defaultInteractionTargetContext } from "../control-plane-utils";
import {
  formatPromptAssistStatus,
  readPromptAssistButtonMode,
} from "../persona-prompt-assist-utils";
import type { PersonaGenerationModalPhase } from "../persona-generation-modal-utils";

export interface PersonaInteractionSectionProps {
  interactionInput: {
    personaId: string;
    modelId: string;
    taskType: "post" | "comment" | "reply";
    targetContextText: string;
    contentMode: "discussion" | "story";
  };
  setInteractionInput: Dispatch<
    SetStateAction<{
      personaId: string;
      modelId: string;
      taskType: "post" | "comment" | "reply";
      targetContextText: string;
      contentMode: "discussion" | "story";
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
  structuredContext: InteractionContextAssistOutput | null;
  setStructuredContext: Dispatch<SetStateAction<InteractionContextAssistOutput | null>>;
  runInteractionPreview: () => Promise<void>;
  closeInteractionPreviewModal: () => void;
  assistInteractionTaskContext: () => Promise<void>;
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold opacity-50">{label}</div>
      <div className="mt-0.5 text-sm leading-relaxed opacity-80">{value}</div>
    </div>
  );
}

function StructuredContextRow({ output }: { output: InteractionContextAssistOutput }) {
  switch (output.taskType) {
    case "post":
      return (
        <div className="border-base-300 bg-base-200/60 mt-2 rounded-lg border px-3 py-2.5">
          <FieldRow label="Title Direction" value={output.titleDirection} />
          <div className="mt-2">
            <FieldRow label="Content Direction" value={output.contentDirection} />
          </div>
        </div>
      );

    case "comment":
      return (
        <div className="border-base-300 bg-base-200/60 mt-2 rounded-lg border px-3 py-2.5">
          <FieldRow label="Article" value={output.articleTitle} />
          <div className="mt-2">
            <FieldRow label="Outline" value={output.articleOutline} />
          </div>
        </div>
      );

    case "reply":
      return (
        <div className="border-base-300 bg-base-200/60 mt-2 rounded-lg border px-3 py-2.5">
          <FieldRow label="Article Outline" value={output.articleOutline} />
          <div className="mt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold opacity-50">Comment Thread</span>
              <span className="text-[10px] opacity-35">{output.comments.length}</span>
            </div>
            <div className="mt-1 space-y-0.5">
              {output.comments.map((c, i) => (
                <div key={i} className="flex gap-1.5 text-xs">
                  <span className="mt-0.5 font-medium opacity-25 select-none">{i + 1}.</span>
                  <span className="opacity-75">{c.content}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
  }
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
  structuredContext,
  setStructuredContext,
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

  const selectedModel = textModels.find((m) => m.id === interactionInput.modelId);
  const selectedProvider = providers.find((p) => p.id === selectedModel?.providerId);
  const hasProvider =
    selectedProvider != null && selectedProvider.hasKey && selectedProvider.status === "active";

  const runPreviewDisabled =
    !interactionInput.personaId ||
    !hasProvider ||
    (structuredContext === null && interactionInput.targetContextText.trim().length === 0) ||
    interactionPreviewModalPhase === "loading";

  const assistDisabled = !interactionInput.modelId || structuredContext !== null;

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
                  const taskType = e.target.value as "post" | "comment" | "reply";
                  setStructuredContext(null);
                  setInteractionInput((prev) => ({
                    ...prev,
                    taskType,
                    targetContextText: defaultInteractionTargetContext(taskType),
                  }));
                }}
              >
                <option value="post">Post Generation</option>
                <option value="comment">Comment Response</option>
                <option value="reply">Thread Reply</option>
              </select>
            </div>
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold opacity-70">Content Mode</span>
              </label>
              <select
                className="select select-bordered select-sm w-full"
                value={interactionInput.contentMode}
                onChange={(e) => {
                  const contentMode = e.target.value as "discussion" | "story";
                  setStructuredContext(null);
                  setInteractionInput((prev) => ({ ...prev, contentMode }));
                }}
              >
                <option value="discussion">Discussion</option>
                <option value="story">Story</option>
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
                  Target Context / Content
                </span>
                <button
                  type="button"
                  className="btn btn-outline border-base-300 text-base-content hover:border-primary hover:text-primary btn-xs ml-auto gap-1 shadow-none"
                  disabled={assistDisabled}
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
                value={interactionInput.targetContextText}
                onChange={(e) => {
                  setStructuredContext(null);
                  setInteractionInput((prev) => ({
                    ...prev,
                    targetContextText: e.target.value,
                  }));
                }}
                placeholder="Paste post/comment content to test response assembly..."
              />

              {structuredContext && <StructuredContextRow output={structuredContext} />}

              <div
                className={`mt-2 text-xs ${interactionTaskAssistError ? "text-error" : "opacity-55"}`}
              >
                {structuredContext
                  ? "Structured context ready. Edit the text to discard and switch to manual mode."
                  : (taskAssistStatus ??
                    "Use AI to generate a random target context for this interaction preview.")}
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
