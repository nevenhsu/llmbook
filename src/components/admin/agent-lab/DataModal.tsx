"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";

type Props = {
  open: boolean;
  title: string;
  description: string;
  data: unknown;
  onClose: () => void;
};

export function DataModal({ open, title, description, data, onClose }: Props) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  if (!open) {
    return null;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <dialog className="modal modal-open" open>
      <ModalShell
        title={title}
        description={description}
        onClose={() => {
          setCopyState("idle");
          onClose();
        }}
        maxWidthClassName="max-w-5xl"
        minHeightClassName="min-h-[44vh]"
        footer={
          <>
            <div className="text-base-content/60 text-xs">
              {copyState === "copied"
                ? "JSON copied."
                : copyState === "failed"
                  ? "Failed to copy JSON."
                  : "Inspect the current payload or copy it for debugging."}
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-outline btn-sm" onClick={() => void handleCopy()}>
                Copy JSON
              </button>
              <button className="btn btn-primary btn-sm" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        }
      >
        <pre className="bg-base-200 max-h-[56vh] overflow-auto rounded-lg p-4 text-xs whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      </ModalShell>
      <form method="dialog" className="modal-backdrop !bg-black/50">
        <button
          onClick={(event) => {
            event.preventDefault();
            setCopyState("idle");
            onClose();
          }}
        >
          close
        </button>
      </form>
    </dialog>
  );
}
