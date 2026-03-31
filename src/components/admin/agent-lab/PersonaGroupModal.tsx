"use client";

import { ModalShell } from "@/components/ui/ModalShell";
import type { AgentLabPersonaGroup } from "./types";

type Props = {
  open: boolean;
  group: AgentLabPersonaGroup;
  onClose: () => void;
  onUpdateGroup: (input: { batchSize?: number; groupIndex?: number }) => void;
};

type NumberControlProps = {
  label: string;
  subLabel?: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
};

function NumberControl({ label, subLabel, value, onDecrease, onIncrease }: NumberControlProps) {
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
          <button type="button" className="btn btn-sm btn-square btn-outline" onClick={onDecrease}>
            -
          </button>
          <div className="border-base-300 bg-base-100 min-w-20 rounded-md border px-3 py-1 text-center text-lg font-semibold">
            {value}
          </div>
          <button type="button" className="btn btn-sm btn-square btn-outline" onClick={onIncrease}>
            +
          </button>
        </div>
      </div>
    </div>
  );
}

export function PersonaGroupModal({ open, group, onClose, onUpdateGroup }: Props) {
  if (!open) {
    return null;
  }

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
            <span />
            <button className="btn btn-primary btn-sm" onClick={onClose}>
              Close
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
            value={group.batchSize}
            onDecrease={() => onUpdateGroup({ batchSize: group.batchSize - 1 })}
            onIncrease={() => onUpdateGroup({ batchSize: group.batchSize + 1 })}
          />
          <NumberControl
            label="Group index"
            subLabel={`(max ${group.maxGroupIndex})`}
            value={group.groupIndex}
            onDecrease={() => onUpdateGroup({ groupIndex: group.groupIndex - 1 })}
            onIncrease={() => onUpdateGroup({ groupIndex: group.groupIndex + 1 })}
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
