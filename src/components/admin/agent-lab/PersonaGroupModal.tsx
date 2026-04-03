"use client";

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import type { AgentLabPersonaGroup, AgentLabSourceMode } from "./types";

type Props = {
  open: boolean;
  sourceMode: AgentLabSourceMode;
  group: AgentLabPersonaGroup;
  onClose: () => void;
  onSave: (input: { batchSize: number; groupIndex: number }) => Promise<void>;
  busy: boolean;
};

type NumberControlProps = {
  label: string;
  subLabel?: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
};

function NumberControl({
  label,
  subLabel,
  value,
  onDecrease,
  onIncrease,
  disabled = false,
}: NumberControlProps & { disabled?: boolean }) {
  return (
    <div className="border-base-300 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-base-content/70 text-[16px] font-medium">{label}</div>
          {subLabel ? (
            <div className="text-base-content/45 mt-1 text-[10px]">{subLabel}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-square btn-outline"
            onClick={onDecrease}
            disabled={disabled}
          >
            -
          </button>
          <div className="border-base-300 bg-base-100 min-w-20 rounded-md border px-3 py-1 text-center text-lg font-semibold">
            {value}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-square btn-outline"
            onClick={onIncrease}
            disabled={disabled}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

export function PersonaGroupModal({ open, sourceMode, group, onClose, onSave, busy }: Props) {
  const [draftBatchSize, setDraftBatchSize] = useState(group.batchSize);
  const [draftGroupIndex, setDraftGroupIndex] = useState(group.groupIndex);

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraftBatchSize(group.batchSize);
    setDraftGroupIndex(group.groupIndex);
  }, [group.batchSize, group.groupIndex, open]);

  if (!open) {
    return null;
  }

  const nextMaxGroupIndex =
    draftBatchSize > 0 ? Math.max(0, Math.ceil(group.totalReferenceCount / draftBatchSize) - 1) : 0;
  const clampedGroupIndex = Math.min(Math.max(draftGroupIndex, 0), nextMaxGroupIndex);

  return (
    <dialog className="modal modal-open" open>
      <ModalShell
        title="Reference Names Group"
        description="Adjust persona reference batch size and group index."
        onClose={onClose}
        maxWidthClassName="max-w-2xl"
        minHeightClassName="min-h-[30vh]"
        footer={
          <>
            <button className="btn btn-outline btn-sm" onClick={onClose} disabled={busy}>
              Close
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={() =>
                void onSave({ batchSize: draftBatchSize, groupIndex: clampedGroupIndex })
              }
            >
              {busy ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="border-base-300 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-base-content/70 text-[16px] font-medium">
                Total persona reference count
              </div>
              <div className="text-2xl font-semibold">{group.totalReferenceCount}</div>
            </div>
          </div>
          <NumberControl
            label="Persona reference batch size"
            value={draftBatchSize}
            disabled={busy}
            onDecrease={() => setDraftBatchSize((current) => Math.max(1, current - 1))}
            onIncrease={() => setDraftBatchSize((current) => current + 1)}
          />
          <NumberControl
            label="Group index"
            subLabel={
              sourceMode === "notification"
                ? "Disabled for notification mode"
                : `(max ${nextMaxGroupIndex})`
            }
            value={clampedGroupIndex}
            disabled={sourceMode === "notification" || busy}
            onDecrease={() => setDraftGroupIndex((current) => Math.max(0, current - 1))}
            onIncrease={() =>
              setDraftGroupIndex((current) => Math.min(nextMaxGroupIndex, current + 1))
            }
          />
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
