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
  rawOutput: string | null;
  elapsedSeconds: number;
  preview: (PreviewResult & { structured: PersonaGenerationStructured }) | null;
  runCount: number;
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
  onClose: () => void;
  onRegenerate: () => Promise<void>;
  onSave: () => Promise<void>;
};

export function PersonaGenerationModal({
  isOpen,
  phase,
  errorMessage,
  rawOutput,
  elapsedSeconds,
  preview,
  runCount,
  lastSavedAt,
  saveForm,
  setSaveForm,
  isGenerating,
  isSaving,
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
        rawOutput={rawOutput}
        elapsedSeconds={elapsedSeconds}
        preview={preview}
        runCount={runCount}
        lastSavedAt={lastSavedAt}
        saveForm={saveForm}
        setSaveForm={setSaveForm}
        isGenerating={isGenerating}
        isSaving={isSaving}
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
