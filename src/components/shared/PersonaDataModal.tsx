"use client";

import { Save, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { PersonaGenerationStructured } from "@/lib/ai/admin/control-plane-contract";
import type { PersonaItem } from "@/lib/ai/admin/control-plane-types";
import { PersonaInfoCard } from "@/components/admin/control-plane/PersonaInfoCard";
import { PersonaStructuredPreview } from "@/components/admin/control-plane/PersonaStructuredPreview";
import { ModalShell } from "@/components/ui/ModalShell";

type Props = {
  isOpen: boolean;
  title: string;
  description?: string;
  structured: PersonaGenerationStructured | null;
  displayName?: string;
  username?: string;
  onClose: () => void;
  footerMeta?: ReactNode;
  secondaryActionLabel?: string;
  primaryActionLabel?: string;
  onSecondaryAction?: () => void | Promise<void>;
  onPrimaryAction?: () => void | Promise<void>;
  secondaryDisabled?: boolean;
  primaryDisabled?: boolean;
  secondaryLoading?: boolean;
  primaryLoading?: boolean;
};

export function PersonaDataModal({
  isOpen,
  title,
  description = "Inspect the generated persona data before re-running or saving it.",
  structured,
  displayName,
  username,
  onClose,
  footerMeta = null,
  secondaryActionLabel,
  primaryActionLabel,
  onSecondaryAction,
  onPrimaryAction,
  secondaryDisabled = false,
  primaryDisabled = false,
  secondaryLoading = false,
  primaryLoading = false,
}: Props) {
  if (!isOpen) {
    return null;
  }

  const hasStructured = structured !== null;
  const allowSecondary =
    hasStructured && Boolean(onSecondaryAction) && Boolean(secondaryActionLabel);
  const allowPrimary = hasStructured && Boolean(onPrimaryAction) && Boolean(primaryActionLabel);
  const resolvedDisplayName = displayName?.trim() || structured?.persona.display_name || null;
  const resolvedUsername = username?.trim() || "ai_generated_persona";
  const summaryPersona: PersonaItem | null = structured
    ? {
        id: "generated-persona",
        username: resolvedUsername,
        display_name: resolvedDisplayName ?? structured.persona.display_name,
        avatar_url: null,
        bio: structured.persona.bio,
        status: structured.persona.status,
      }
    : null;
  const summaryProfile = structured
    ? {
        persona: {
          id: "generated-persona",
          username: resolvedUsername,
          display_name: resolvedDisplayName ?? structured.persona.display_name,
          bio: structured.persona.bio,
          status: structured.persona.status,
        },
        personaCore: {
          ...structured.persona_core,
          reference_sources: structured.reference_sources,
          other_reference_sources: structured.other_reference_sources,
          reference_derivation: structured.reference_derivation,
        },
        personaMemories: [],
      }
    : null;

  return (
    <dialog className="modal modal-open" open>
      <ModalShell
        title={title}
        description={description}
        onClose={onClose}
        footer={
          <>
            <div>{footerMeta}</div>
            <div className="flex items-center gap-2">
              {secondaryActionLabel ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm gap-2"
                  disabled={!allowSecondary || secondaryDisabled || secondaryLoading}
                  onClick={() => void onSecondaryAction?.()}
                >
                  {secondaryLoading ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {secondaryLoading ? "Working..." : secondaryActionLabel}
                </button>
              ) : null}
              {primaryActionLabel ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm gap-2"
                  disabled={!allowPrimary || primaryDisabled || primaryLoading}
                  onClick={() => void onPrimaryAction?.()}
                >
                  {primaryLoading ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {primaryLoading ? "Saving..." : primaryActionLabel}
                </button>
              ) : null}
            </div>
          </>
        }
      >
        {structured ? (
          <div className="space-y-4">
            {summaryPersona && summaryProfile ? (
              <PersonaInfoCard persona={summaryPersona} profile={summaryProfile} />
            ) : null}
            <PersonaStructuredPreview structured={structured} />
          </div>
        ) : (
          <div className="border-base-300 rounded-lg border border-dashed p-8 text-center text-sm opacity-60">
            No persona data available.
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
