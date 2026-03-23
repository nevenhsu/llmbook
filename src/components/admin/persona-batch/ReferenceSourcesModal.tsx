"use client";

import { useEffect, useRef, useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";

type Props = {
  isOpen: boolean;
  value: string;
  rowCount: number;
  disabled?: boolean;
  addLoading?: boolean;
  addElapsedSeconds?: number;
  addLastCompletedElapsedSeconds?: number | null;
  addLastCompletedAddedCount?: number | null;
  addLastCompletedDuplicateCount?: number | null;
  onChange: (value: string) => void;
  onAdd: () => void;
  onClose: () => void;
};

function formatElapsed(elapsedSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(elapsedSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ReferenceSourcesModal({
  isOpen,
  value,
  rowCount,
  disabled = false,
  addLoading = false,
  addElapsedSeconds = 0,
  addLastCompletedElapsedSeconds = null,
  addLastCompletedAddedCount = null,
  addLastCompletedDuplicateCount = null,
  onChange,
  onAdd,
  onClose,
}: Props) {
  const [showCompletedSummary, setShowCompletedSummary] = useState(false);
  const previousAddLoadingRef = useRef(addLoading);
  const previousCompletedSummaryKeyRef = useRef<string | null>(null);
  const previousIsOpenRef = useRef(isOpen);

  useEffect(() => {
    const wasOpen = previousIsOpenRef.current;
    previousIsOpenRef.current = isOpen;

    if (!wasOpen && isOpen) {
      setShowCompletedSummary(false);
      previousCompletedSummaryKeyRef.current =
        typeof addLastCompletedAddedCount === "number" &&
        typeof addLastCompletedDuplicateCount === "number"
          ? `${addLastCompletedAddedCount}:${addLastCompletedDuplicateCount}:${addLastCompletedElapsedSeconds ?? "none"}`
          : null;
    }
  }, [
    addLastCompletedAddedCount,
    addLastCompletedDuplicateCount,
    addLastCompletedElapsedSeconds,
    isOpen,
  ]);

  useEffect(() => {
    if (
      !isOpen ||
      typeof addLastCompletedAddedCount !== "number" ||
      typeof addLastCompletedDuplicateCount !== "number"
    ) {
      previousCompletedSummaryKeyRef.current = null;
      return;
    }

    const nextKey = `${addLastCompletedAddedCount}:${addLastCompletedDuplicateCount}:${addLastCompletedElapsedSeconds ?? "none"}`;
    if (previousCompletedSummaryKeyRef.current !== nextKey) {
      previousCompletedSummaryKeyRef.current = nextKey;
      setShowCompletedSummary(true);
    }
  }, [
    addLastCompletedAddedCount,
    addLastCompletedDuplicateCount,
    addLastCompletedElapsedSeconds,
    isOpen,
  ]);

  useEffect(() => {
    const wasAddLoading = previousAddLoadingRef.current;
    previousAddLoadingRef.current = addLoading;

    if (
      isOpen &&
      wasAddLoading &&
      !addLoading &&
      typeof addLastCompletedAddedCount === "number" &&
      typeof addLastCompletedDuplicateCount === "number"
    ) {
      setShowCompletedSummary(true);
    }
  }, [addLastCompletedAddedCount, addLastCompletedDuplicateCount, addLoading, isOpen]);

  if (!isOpen) {
    return null;
  }

  const elapsedText = addLoading
    ? formatElapsed(addElapsedSeconds)
    : showCompletedSummary && typeof addLastCompletedElapsedSeconds === "number"
      ? formatElapsed(addLastCompletedElapsedSeconds)
      : null;
  const leftSummaryText = addLoading
    ? `${rowCount} ${rowCount === 1 ? "row" : "rows"}`
    : showCompletedSummary &&
        typeof addLastCompletedAddedCount === "number" &&
        typeof addLastCompletedDuplicateCount === "number"
      ? `Added ${addLastCompletedAddedCount} ${
          addLastCompletedAddedCount === 1 ? "row" : "rows"
        }, ${addLastCompletedDuplicateCount} ${
          addLastCompletedDuplicateCount === 1 ? "duplicate" : "duplicates"
        }`
      : `${rowCount} ${rowCount === 1 ? "row" : "rows"}`;

  return (
    <dialog className="modal modal-open" open>
      <ModalShell
        title="Reference Sources"
        description="Paste one name per line or separate names with commas."
        onClose={onClose}
        maxWidthClassName="max-w-3xl"
        minHeightClassName="min-h-[28rem]"
        footer={
          <>
            <span
              data-testid="reference-sources-row-count"
              className="text-sm whitespace-nowrap opacity-60"
            >
              {leftSummaryText}
            </span>
            <div
              data-testid="reference-sources-footer-actions"
              className="ml-auto flex items-center gap-3"
            >
              {elapsedText ? (
                <span
                  data-testid="reference-sources-add-elapsed"
                  className="text-xs whitespace-nowrap opacity-60"
                >
                  {elapsedText}
                </span>
              ) : null}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={disabled || value.trim().length === 0}
                onClick={onAdd}
              >
                {addLoading ? <span className="loading loading-spinner loading-xs" /> : null}
                Add
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        }
      >
        <div className="space-y-3">
          <textarea
            className="textarea textarea-bordered min-h-[18rem] w-full"
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder=""
          />
          <p className="text-xs opacity-60">
            comma or newline separated, ex: Anthony Bourdain, Hayao Miyazaki, Ursula K. Le Guin
          </p>
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
