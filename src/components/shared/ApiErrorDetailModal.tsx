"use client";

import toast from "react-hot-toast";
import { Copy } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";

type Props = {
  isOpen: boolean;
  title: string;
  errorMessage: string;
  apiUrl: string;
  payload: unknown;
  rawResponse: unknown;
  onClose: () => void;
};

function formatJsonBlock(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

export function ApiErrorDetailModal({
  isOpen,
  title,
  errorMessage,
  apiUrl,
  payload,
  rawResponse,
  onClose,
}: Props) {
  if (!isOpen) {
    return null;
  }

  const copyPayload = JSON.stringify(
    {
      errorMessage,
      apiUrl,
      payload,
      rawResponse,
    },
    null,
    2,
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyPayload);
      toast.success("JSON copied");
    } catch {
      toast.error("Failed to copy JSON");
    }
  };

  return (
    <dialog className="modal modal-open" open>
      <ModalShell
        title={title}
        description="Inspect the request payload and raw API response for debugging."
        onClose={onClose}
        maxWidthClassName="max-w-4xl"
        minHeightClassName="min-h-[40vh]"
        footer={
          <>
            <span className="text-sm opacity-60">{errorMessage}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-outline btn-sm gap-2"
                onClick={() => void handleCopy()}
              >
                <Copy className="h-4 w-4" />
                Copy JSON
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        }
      >
        <div className="space-y-5">
          <section className="space-y-2">
            <div className="text-xs font-semibold tracking-wide uppercase opacity-55">
              Error Message
            </div>
            <div className="alert alert-error">
              <span>{errorMessage}</span>
            </div>
          </section>

          <section className="space-y-2">
            <div className="text-xs font-semibold tracking-wide uppercase opacity-55">API URL</div>
            <pre className="bg-base-200 rounded-lg border p-3 text-xs whitespace-pre-wrap">
              {apiUrl}
            </pre>
          </section>

          <section className="space-y-2">
            <div className="text-xs font-semibold tracking-wide uppercase opacity-55">Payload</div>
            <pre className="bg-base-200 max-h-60 overflow-auto rounded-lg border p-3 text-xs whitespace-pre-wrap">
              {formatJsonBlock(payload)}
            </pre>
          </section>

          <section className="space-y-2">
            <div className="text-xs font-semibold tracking-wide uppercase opacity-55">
              Raw Response
            </div>
            <pre className="bg-base-200 max-h-60 overflow-auto rounded-lg border p-3 text-xs whitespace-pre-wrap">
              {formatJsonBlock(rawResponse)}
            </pre>
          </section>
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
