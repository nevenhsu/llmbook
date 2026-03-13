"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Save, Sparkles, UserPlus } from "lucide-react";
import type {
  PreviewResult,
  PersonaGenerationStructured,
} from "@/lib/ai/admin/control-plane-store";
import {
  canSavePersonaGeneration,
  formatPersonaGenerationElapsed,
  type PersonaGenerationModalPhase,
} from "./persona-generation-modal-utils";
import { ModalShell } from "@/components/ui/ModalShell";
import { PreviewPanel } from "./PreviewPanel";
import { derivePersonaUsername } from "./control-plane-utils";

type Props = {
  mode?: "modal" | "page";
  phase: PersonaGenerationModalPhase;
  errorMessage: string | null;
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
  disableActions?: boolean;
  topNotice?: ReactNode;
  onClose?: () => void;
  onRegenerate: () => Promise<void> | void;
  onSave: () => Promise<void> | void;
};

export function PersonaGenerationPreviewSurface({
  mode = "modal",
  phase,
  errorMessage,
  rawOutput,
  elapsedSeconds,
  preview,
  lastSavedAt,
  saveForm,
  setSaveForm,
  isGenerating,
  isSaving,
  disableActions = false,
  topNotice,
  onClose,
  onRegenerate,
  onSave,
}: Props) {
  const canSave = canSavePersonaGeneration(phase, preview) && !disableActions;
  const hasSaved = Boolean(lastSavedAt);
  const actionDisabled = isGenerating || disableActions;
  const content = (
    <>
      {topNotice ? <div className="mb-5">{topNotice}</div> : null}

      {phase === "loading" ? (
        <div className="flex h-full min-h-[24rem] flex-col items-center justify-center gap-5 text-center">
          <span className="loading loading-spinner loading-lg text-primary" />
          <div className="space-y-2">
            <div className="text-lg font-semibold">Generating persona preview</div>
            <div className="text-sm opacity-60">
              Waiting for structured JSON response from the selected model.
            </div>
          </div>
          <div className="bg-base-200 rounded-full px-4 py-2 font-mono text-sm">
            {formatPersonaGenerationElapsed(elapsedSeconds)}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {errorMessage ? (
            <div className="space-y-3">
              <div className="alert alert-error">
                <span>{errorMessage}</span>
              </div>
              {rawOutput ? (
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Raw Model Output</div>
                  <pre className="bg-base-200 max-h-72 overflow-auto rounded-lg border p-3 text-xs whitespace-pre-wrap">
                    {rawOutput}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}

          {preview ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="form-control w-full">
                  <label className="label py-1">
                    <span className="label-text text-xs font-semibold opacity-70">
                      Display Name
                    </span>
                  </label>
                  <input
                    className="input input-bordered input-sm focus:input-primary w-full"
                    value={saveForm.displayName}
                    onChange={(event) => {
                      const displayName = event.target.value;
                      setSaveForm({
                        displayName,
                        username: derivePersonaUsername(displayName),
                      });
                    }}
                    placeholder="e.g. Satoshi Nakamoto"
                  />
                </div>
                <div className="form-control w-full">
                  <label className="label py-1">
                    <span className="label-text text-xs font-semibold opacity-70">
                      Username (auto-prefixed with <span className="font-mono">ai_</span>)
                    </span>
                  </label>
                  <input
                    className="input input-bordered input-sm focus:input-primary w-full"
                    value={saveForm.username}
                    onChange={(event) =>
                      setSaveForm((prev) => ({
                        ...prev,
                        username: derivePersonaUsername(event.target.value),
                      }))
                    }
                    placeholder="e.g. satoshi"
                  />
                </div>
              </div>
              <PreviewPanel
                preview={preview}
                emptyLabel="Run preview first"
                showTokenStatsBar={false}
                showPromptAssemblySection={false}
                showTokenBudgetSection={false}
              />
            </>
          ) : (
            <div className="border-base-300 rounded-lg border border-dashed p-8 text-center text-sm opacity-60">
              No preview response available.
            </div>
          )}
        </div>
      )}
    </>
  );

  const footer = (
    <>
      <span></span>

      <div className="flex items-center gap-2">
        <button
          className="btn btn-outline btn-sm gap-2"
          disabled={actionDisabled}
          onClick={() => void onRegenerate()}
        >
          {isGenerating ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isGenerating ? "Generating..." : "Regenerate"}
        </button>
        <button
          className={`btn btn-primary btn-sm gap-2 ${!canSave || isSaving ? "btn-disabled" : ""}`}
          disabled={!canSave || isSaving}
          onClick={() => {
            if (hasSaved || !canSave || isSaving) {
              return;
            }
            void onSave();
          }}
        >
          {isSaving ? (
            <>
              <span className="loading loading-spinner loading-xs" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {hasSaved ? "Saved" : "Save"}
            </>
          )}
        </button>
      </div>
    </>
  );

  if (mode === "modal" && onClose) {
    return (
      <ModalShell
        title="Persona Generation"
        description={
          phase === "loading"
            ? "Generating structured persona data..."
            : phase === "error"
              ? "Generation failed. Review the error or regenerate."
              : "Review the generated persona data before saving it to the database."
        }
        onClose={onClose}
        footer={footer}
      >
        {content}
      </ModalShell>
    );
  }

  return (
    <div className="bg-base-100 border-base-300 overflow-hidden rounded-2xl border shadow-sm">
      <div className="border-base-300 border-b px-6 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <UserPlus className="h-5 w-5" />
            Persona Generation
          </h3>
          <p className="mt-1 text-sm opacity-60">
            {phase === "loading"
              ? "Generating structured persona data..."
              : phase === "error"
                ? "Generation failed. Review the error or regenerate."
                : "Review the generated persona data before saving it to the database."}
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{content}</div>
      <div className="border-base-300 flex items-center justify-between border-t px-6 py-4">
        {footer}
      </div>
    </div>
  );
}
