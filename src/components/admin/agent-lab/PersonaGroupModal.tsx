"use client";

import { ModalShell } from "@/components/ui/ModalShell";
import type { AgentLabPersonaGroup } from "./types";

type Props = {
  open: boolean;
  group: AgentLabPersonaGroup;
  onClose: () => void;
};

export function PersonaGroupModal({ open, group, onClose }: Props) {
  if (!open) {
    return null;
  }

  return (
    <dialog className="modal modal-open" open>
      <ModalShell
        title="Persona Group"
        description="Reference-window details for the current source mode."
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
        <div className="grid gap-3 md:grid-cols-3">
          <div className="border-base-300 rounded-xl border p-4">
            <div className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
              Total Persona Reference Count
            </div>
            <div className="mt-2 text-2xl font-semibold">{group.totalReferenceCount}</div>
          </div>
          <div className="border-base-300 rounded-xl border p-4">
            <div className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
              Persona Reference Batch Size
            </div>
            <div className="mt-2 text-2xl font-semibold">{group.batchSize}</div>
          </div>
          <div className="border-base-300 rounded-xl border p-4">
            <div className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
              Group Index
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {group.groupIndex} / {group.maxGroupIndex}
            </div>
          </div>
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
