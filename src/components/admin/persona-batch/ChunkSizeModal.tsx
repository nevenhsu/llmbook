"use client";

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";

type Props = {
  isOpen: boolean;
  value: number;
  onClose: () => void;
  onSave: (value: number) => void;
};

function clampDraft(value: string): string {
  if (!/^\d*$/.test(value)) {
    return value.replace(/[^\d]/g, "");
  }
  if (!value) {
    return value;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return String(Math.min(20, parsed));
}

export function ChunkSizeModal({ isOpen, value, onClose, onSave }: Props) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (isOpen) {
      setDraft(String(value));
    }
  }, [isOpen, value]);

  if (!isOpen) {
    return null;
  }

  return (
    <dialog className="modal modal-open" open>
      <ModalShell
        title="Chunk Size"
        description="Configure how many rows each bulk run processes in parallel."
        onClose={onClose}
        maxWidthClassName="max-w-lg"
        minHeightClassName="min-h-0"
        footer={
          <>
            <span className="text-sm opacity-60">Allowed range: 1 to 20.</span>
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onSave(Number(clampDraft(draft) || "1"))}
              >
                Save
              </button>
            </div>
          </>
        }
      >
        <label className="form-control">
          <span className="label-text text-sm font-medium">Rows per batch</span>
          <input
            type="number"
            min={1}
            max={20}
            className="input input-bordered mt-2 w-full"
            value={draft}
            onChange={(event) => setDraft(clampDraft(event.target.value))}
          />
        </label>
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
