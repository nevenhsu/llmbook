import type { Dispatch, SetStateAction } from "react";
import type {
  PreviewResult,
  PersonaGenerationStructured,
} from "@/lib/ai/admin/control-plane-store";
import type { PersonaGenerationModalPhase } from "./persona-generation-modal-utils";
import { PersonaGenerationPreviewSurface } from "./PersonaGenerationPreviewSurface";

type Props = {
  isOpen: boolean;
  phase: PersonaGenerationModalPhase;
  errorMessage: string | null;
  errorDetails?: Record<string, unknown> | null;
  rawOutput: string | null;
  elapsedSeconds: number;
  preview: (PreviewResult & { structured: PersonaGenerationStructured }) | null;
  lastSavedAt: string | null;
  saveForm: {
    displayName: string;
    username: string;
  };
  setSaveForm: Dispatch<
    SetStateAction<{
      displayName: string;
      username: string;
    }>
  >;
  isGenerating: boolean;
  isSaving: boolean;
  title?: string;
  loadingDescription?: string;
  errorDescription?: string;
  successDescription?: string;
  primaryActionLabel?: string;
  completedActionLabel?: string;
  onClose: () => void;
  onRegenerate: () => Promise<void>;
  onSave: () => Promise<void>;
};

export function PersonaGenerationModal({
  isOpen,
  phase,
  errorMessage,
  errorDetails = null,
  rawOutput,
  elapsedSeconds,
  preview,
  lastSavedAt,
  saveForm,
  setSaveForm,
  isGenerating,
  isSaving,
  title,
  loadingDescription,
  errorDescription,
  successDescription,
  primaryActionLabel,
  completedActionLabel,
  onClose,
  onRegenerate,
  onSave,
}: Props) {
  if (!isOpen) {
    return null;
  }

  return (
    <dialog className="modal modal-open" open>
      <PersonaGenerationPreviewSurface
        mode="modal"
        phase={phase}
        errorMessage={errorMessage}
        errorDetails={errorDetails}
        rawOutput={rawOutput}
        elapsedSeconds={elapsedSeconds}
        preview={preview}
        lastSavedAt={lastSavedAt}
        saveForm={saveForm}
        setSaveForm={setSaveForm}
        isGenerating={isGenerating}
        isSaving={isSaving}
        title={title}
        loadingDescription={loadingDescription}
        errorDescription={errorDescription}
        successDescription={successDescription}
        primaryActionLabel={primaryActionLabel}
        completedActionLabel={completedActionLabel}
        onClose={onClose}
        onRegenerate={onRegenerate}
        onSave={onSave}
      />

      <form method="dialog" className="modal-backdrop !bg-black/50">
        <button
          onClick={(event) => {
            event.preventDefault();
            onClose();
          }}
        >
          close
        </button>
      </form>
    </dialog>
  );
}
