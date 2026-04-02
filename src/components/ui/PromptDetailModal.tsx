"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui/ModalShell";

type Props = {
  open: boolean;
  title: string;
  description: string;
  assembledPrompt: string;
  modelPayload: unknown | null;
  promptInput: unknown | null;
  onClose: () => void;
};

export function PromptDetailModal({
  open,
  title,
  description,
  assembledPrompt,
  modelPayload,
  promptInput,
  onClose,
}: Props) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  if (!open) {
    return null;
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(assembledPrompt);
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
        minHeightClassName="min-h-[50vh]"
        footer={
          <>
            <div className="text-base-content/60 text-xs">
              {copyState === "copied"
                ? "Prompt copied."
                : copyState === "failed"
                  ? "Failed to copy prompt."
                  : "Copy the exact assembled prompt used by the current execution preview."}
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-outline btn-sm" onClick={() => void handleCopyPrompt()}>
                Copy Prompt
              </button>
              <button className="btn btn-primary btn-sm" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        }
      >
        <div className="space-y-4">
          <section className="border-base-300 bg-base-100 rounded-xl border shadow-sm">
            <div className="border-base-300 border-b px-4 py-3">
              <h4 className="text-base-content/70 text-sm font-semibold tracking-wide uppercase">
                Assembled Prompt
              </h4>
            </div>
            <div className="p-4">
              <pre className="bg-base-200 max-h-[34vh] overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                {assembledPrompt}
              </pre>
            </div>
          </section>
          {promptInput !== null ? (
            <section className="border-base-300 bg-base-100 rounded-xl border shadow-sm">
              <div className="border-base-300 border-b px-4 py-3">
                <h4 className="text-base-content/70 text-sm font-semibold tracking-wide uppercase">
                  Prompt Input
                </h4>
              </div>
              <div className="p-4">
                <pre className="bg-base-200 max-h-[22vh] overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                  {JSON.stringify(promptInput, null, 2)}
                </pre>
              </div>
            </section>
          ) : null}
          {modelPayload !== null ? (
            <section className="border-base-300 bg-base-100 rounded-xl border shadow-sm">
              <div className="border-base-300 border-b px-4 py-3">
                <h4 className="text-base-content/70 text-sm font-semibold tracking-wide uppercase">
                  Model Payload
                </h4>
              </div>
              <div className="p-4">
                <pre className="bg-base-200 max-h-[26vh] overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                  {JSON.stringify(modelPayload, null, 2)}
                </pre>
              </div>
            </section>
          ) : null}
        </div>
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
