"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Save, Sparkles, UserPlus } from "lucide-react";
import { normalizeUsernameInput, validateUsernameFormat } from "@/lib/username-validation";
import type {
  PersonaProfile,
  PreviewResult,
  PersonaGenerationStructured,
} from "@/lib/ai/admin/control-plane-store";
import type { PersonaItem } from "@/lib/ai/admin/control-plane-types";
import {
  canSavePersonaGeneration,
  formatPersonaGenerationElapsed,
  type PersonaGenerationModalPhase,
} from "./persona-generation-modal-utils";
import { ModalShell } from "@/components/ui/ModalShell";
import { PersonaStructuredPreview } from "./PersonaStructuredPreview";
import { PersonaInfoCard } from "./PersonaInfoCard";

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
  title?: string;
  loadingDescription?: string;
  errorDescription?: string;
  successDescription?: string;
  primaryActionLabel?: string;
  completedActionLabel?: string;
  onClose?: () => void;
  onRegenerate: () => Promise<void> | void;
  onSave: () => Promise<void> | void;
};

function buildGeneratedPersonaCardData(
  structured: PersonaGenerationStructured,
  saveForm: {
    displayName: string;
    username: string;
  },
): { persona: PersonaItem; profile: PersonaProfile } {
  const displayName = saveForm.displayName;
  const username = saveForm.username;

  return {
    persona: {
      id: "generated-persona-preview",
      username,
      display_name: displayName,
      avatar_url: null,
      bio: structured.persona.bio,
      status: structured.persona.status,
    },
    profile: {
      persona: {
        id: "generated-persona-preview",
        username,
        display_name: displayName,
        avatar_url: null,
        bio: structured.persona.bio,
        status: structured.persona.status,
      },
      personaCore: {
        reference_sources: structured.reference_sources,
        other_reference_sources: structured.other_reference_sources,
        reference_derivation: structured.reference_derivation,
      },
      personaMemories: [],
    },
  };
}

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
  title = "Persona Generation",
  loadingDescription = "Generating structured persona data...",
  errorDescription = "Generation failed. Review the error or regenerate.",
  successDescription = "Review the generated persona data before saving it to the database.",
  primaryActionLabel = "Save",
  completedActionLabel = "Saved",
  onClose,
  onRegenerate,
  onSave,
}: Props) {
  const canSave = canSavePersonaGeneration(phase, preview) && !disableActions;
  const trimmedDisplayName = saveForm.displayName.trim();
  const normalizedUsername = saveForm.username.trim().toLowerCase();
  const usernameValidation =
    preview && saveForm.username.trim().length > 0
      ? validateUsernameFormat(normalizedUsername, true)
      : { valid: false, error: "AI Persona 的 username 必須以 ai_ 開頭" };
  const identityError =
    preview && trimmedDisplayName.length === 0
      ? "Display name is required."
      : preview && saveForm.username.trim().length === 0
        ? "Username is required."
        : preview && !usernameValidation.valid
          ? (usernameValidation.error ?? "Invalid username")
          : null;
  const hasSaved = Boolean(lastSavedAt);
  const actionDisabled = isGenerating || disableActions;
  const showElapsedStatus = phase === "loading" || (phase !== "idle" && elapsedSeconds > 0);
  const elapsedLabel =
    phase === "loading"
      ? "Generating time"
      : phase === "error"
        ? "Attempt time"
        : "Generation time";
  const canPersist = canSave && !identityError;
  const generatedPersonaCard = preview
    ? buildGeneratedPersonaCardData(preview.structured, saveForm)
    : null;
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
                  <div className="text-sm font-semibold">LLM Response</div>
                  <pre className="bg-base-200 max-h-72 overflow-auto rounded-lg border p-3 text-xs whitespace-pre-wrap">
                    {rawOutput}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}

          {preview ? (
            <>
              <PersonaInfoCard
                persona={generatedPersonaCard!.persona}
                profile={generatedPersonaCard!.profile}
                testIdPrefix="generated-persona"
              />
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
                      setSaveForm((prev) => ({
                        ...prev,
                        displayName,
                      }));
                    }}
                    placeholder="e.g. Satoshi Nakamoto"
                  />
                </div>
                <div className="form-control w-full">
                  <label className="label py-1">
                    <span className="label-text text-xs font-semibold opacity-70">
                      Username (must start with <span className="font-mono">ai_</span>)
                    </span>
                  </label>
                  <input
                    className="input input-bordered input-sm focus:input-primary w-full"
                    value={saveForm.username}
                    onChange={(event) => {
                      const nextUsername = normalizeUsernameInput(event.target.value, {
                        isPersona: true,
                      });
                      setSaveForm((prev) => ({
                        ...prev,
                        username: nextUsername,
                      }));
                    }}
                    placeholder="e.g. satoshi"
                  />
                </div>
              </div>
              {identityError ? <div className="text-error text-xs">{identityError}</div> : null}
              <PersonaStructuredPreview structured={preview.structured} />
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
      <span className="min-w-0 text-sm opacity-70">
        {showElapsedStatus
          ? `${elapsedLabel}: ${formatPersonaGenerationElapsed(elapsedSeconds)}`
          : ""}
      </span>

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
          className={`btn btn-primary btn-sm gap-2 ${!canPersist || isSaving ? "btn-disabled" : ""}`}
          disabled={!canPersist || isSaving}
          onClick={() => {
            if (hasSaved || !canPersist || isSaving) {
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
              {hasSaved ? completedActionLabel : primaryActionLabel}
            </>
          )}
        </button>
      </div>
    </>
  );

  if (mode === "modal" && onClose) {
    return (
      <ModalShell
        title={title}
        description={
          phase === "loading"
            ? loadingDescription
            : phase === "error"
              ? errorDescription
              : successDescription
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
            {title}
          </h3>
          <p className="mt-1 text-sm opacity-60">
            {phase === "loading"
              ? loadingDescription
              : phase === "error"
                ? errorDescription
                : successDescription}
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
