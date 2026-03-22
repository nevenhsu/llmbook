"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";

type Props = {
  isOpen: boolean;
  referenceName: string;
  value: string;
  disabled?: boolean;
  promptLoading?: boolean;
  promptElapsedSeconds?: number;
  promptLastCompletedElapsedSeconds?: number | null;
  onClose: () => void;
  onSave: (value: string) => void;
  onPromptAssist: () => void;
};

function formatElapsed(elapsedSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(elapsedSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function EditContextPromptModal({
  isOpen,
  referenceName,
  value,
  disabled = false,
  promptLoading = false,
  promptElapsedSeconds = 0,
  promptLastCompletedElapsedSeconds = null,
  onClose,
  onSave,
  onPromptAssist,
}: Props) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (isOpen) {
      setDraft(value);
    }
  }, [isOpen, value]);

  if (!isOpen) {
    return null;
  }

  const promptStatusText = promptLoading
    ? `Prompt ${formatElapsed(promptElapsedSeconds)}`
    : promptLastCompletedElapsedSeconds !== null
      ? `Prompt ${formatElapsed(promptLastCompletedElapsedSeconds)}`
      : "This keeps existing persona data until you regenerate.";

  return (
    <dialog className="modal modal-open" open>
      <ModalShell
        title="Edit Context Prompt"
        description={`Reference: ${referenceName}`}
        onClose={onClose}
        maxWidthClassName="max-w-3xl"
        minHeightClassName="min-h-[32rem]"
        footer={
          <>
            <span className="text-sm opacity-60">{promptStatusText}</span>
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={disabled}
                onClick={() => onSave(draft)}
              >
                Save
              </button>
            </div>
          </>
        }
      >
        <div className="flex h-full min-h-[22rem] items-start gap-3">
          <textarea
            className="textarea textarea-bordered h-full min-h-[22rem] flex-1 font-mono text-sm leading-6"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Describe the target persona context..."
          />
          <button
            type="button"
            aria-label="Prompt"
            title="Prompt"
            className="btn btn-outline btn-square btn-sm shrink-0"
            disabled={disabled}
            onClick={onPromptAssist}
          >
            {promptLoading ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </button>
        </div>
      </ModalShell>

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
