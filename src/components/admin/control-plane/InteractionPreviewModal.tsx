"use client";

import { Sparkles } from "lucide-react";
import type { PersonaProfile, PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { PersonaItem } from "@/lib/ai/admin/control-plane-types";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  formatPersonaGenerationElapsed,
  type PersonaGenerationModalPhase,
} from "./persona-generation-modal-utils";
import { PersonaInfoCard } from "./PersonaInfoCard";
import { StageDebugCard } from "@/components/shared/StageDebugCard";
import { PreviewPanel } from "./PreviewPanel";

type Props = {
  isOpen: boolean;
  phase: PersonaGenerationModalPhase;
  preview: PreviewResult | null;
  errorMessage: string | null;
  elapsedSeconds: number;
  isGenerating: boolean;
  selectedPersona: PersonaItem | null;
  selectedPersonaProfile: PersonaProfile | null;
  onClose: () => void;
  onRerun: () => Promise<void> | void;
};

export function InteractionPreviewModal({
  isOpen,
  phase,
  preview,
  errorMessage,
  elapsedSeconds,
  isGenerating,
  selectedPersona,
  selectedPersonaProfile,
  onClose,
  onRerun,
}: Props) {
  if (!isOpen) {
    return null;
  }

  const showElapsedStatus = phase === "loading" || (phase !== "idle" && elapsedSeconds > 0);
  const elapsedLabel =
    phase === "loading" ? "Generating time" : phase === "error" ? "Attempt time" : "Preview time";

  return (
    <dialog className="modal modal-open" open>
      <ModalShell
        title="Interaction Preview"
        description={
          phase === "loading"
            ? "Generating live interaction preview..."
            : phase === "error"
              ? "Preview failed. Review the error or rerun."
              : "Review the model-generated interaction preview for the current target context."
        }
        onClose={onClose}
        footer={
          <>
            <span className="min-w-0 text-sm opacity-70">
              {showElapsedStatus
                ? `${elapsedLabel}: ${formatPersonaGenerationElapsed(elapsedSeconds)}`
                : ""}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-outline btn-sm gap-2"
                disabled={isGenerating}
                onClick={() => void onRerun()}
              >
                {isGenerating ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isGenerating ? "Generating..." : "Rerun"}
              </button>
            </div>
          </>
        }
      >
        {phase === "loading" ? (
          <div className="flex h-full min-h-[24rem] flex-col items-center justify-center gap-5 text-center">
            <span className="loading loading-spinner loading-lg text-primary" />
            <div className="space-y-2">
              <div className="text-lg font-semibold">Generating interaction preview</div>
              <div className="text-sm opacity-60">
                Waiting for the selected model to respond to the current target context.
              </div>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="space-y-3">
            <div className="alert alert-error">
              <span>{errorMessage}</span>
            </div>
            {preview ? (
              <div className="space-y-4">
                {selectedPersona ? (
                  <PersonaInfoCard
                    persona={selectedPersona}
                    profile={selectedPersonaProfile}
                    testIdPrefix="modal-selected-persona"
                  />
                ) : null}
                <PreviewPanel
                  preview={preview}
                  emptyLabel="Run interaction preview to inspect the generated response."
                />
                <StageDebugCard records={preview.stageDebugRecords ?? undefined} />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {selectedPersona ? (
              <PersonaInfoCard
                persona={selectedPersona}
                profile={selectedPersonaProfile}
                testIdPrefix="modal-selected-persona"
              />
            ) : null}
            <PreviewPanel
              preview={preview}
              emptyLabel="Run interaction preview to inspect the generated response."
            />
            <StageDebugCard records={preview?.stageDebugRecords ?? undefined} />
          </div>
        )}
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
