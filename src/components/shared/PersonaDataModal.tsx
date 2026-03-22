"use client";

import { Save, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { PersonaGenerationStructured } from "@/lib/ai/admin/control-plane-contract";
import { PersonaStructuredPreview } from "@/components/admin/control-plane/PersonaStructuredPreview";
import { ModalShell } from "@/components/ui/ModalShell";

type Props = {
  isOpen: boolean;
  title: string;
  description?: string;
  structured: PersonaGenerationStructured | null;
  displayName?: string;
  username?: string;
  referenceLabels?: string[];
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
  referenceLabels = [],
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
  const resolvedReferenceLabels = Array.from(
    new Set(
      (referenceLabels.length > 0
        ? referenceLabels
        : (structured?.reference_sources.map((item) => item.name) ?? [])
      )
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );

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
            {resolvedDisplayName || username || resolvedReferenceLabels.length > 0 ? (
              <section className="from-base-200 via-base-100 to-base-200 border-base-300/70 rounded-2xl border bg-gradient-to-br p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold tracking-wide uppercase opacity-55">
                      Persona Identity
                    </div>
                    <div className="text-xl font-semibold">{resolvedDisplayName ?? "—"}</div>
                    {username ? (
                      <div className="font-mono text-xs opacity-65">{username}</div>
                    ) : null}
                  </div>
                  {resolvedReferenceLabels.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold tracking-wide uppercase opacity-55">
                        References
                      </div>
                      <div className="flex max-w-2xl flex-wrap gap-2">
                        {resolvedReferenceLabels.map((label) => (
                          <span
                            key={label}
                            className="badge badge-outline border-base-300/70 px-3 py-3 text-xs"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
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
