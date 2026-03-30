"use client";

import { ModalShell } from "@/components/ui/ModalShell";
import type { AiAgentMemoryArtifactDetail } from "@/lib/ai/agent/memory/memory-artifact-detail";

type Props = {
  detail: AiAgentMemoryArtifactDetail | null;
  onClose: () => void;
};

export function ArtifactDetailModal({ detail, onClose }: Props) {
  if (!detail) {
    return null;
  }

  return (
    <dialog className="modal modal-open" open>
      <ModalShell
        title={detail.title}
        description={detail.description}
        onClose={onClose}
        maxWidthClassName="max-w-5xl"
        minHeightClassName="min-h-[44vh]"
        footer={
          <>
            <span />
            <button className="btn btn-primary btn-sm" onClick={onClose}>
              Close
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {detail.sections.map((section) => (
            <section
              key={section.title}
              className="border-base-300 bg-base-100 rounded-xl border shadow-sm"
            >
              <div className="border-base-300 border-b px-4 py-3">
                <h4 className="text-base-content/70 text-sm font-semibold tracking-wide uppercase">
                  {section.title}
                </h4>
                {section.description ? (
                  <p className="text-base-content/60 mt-1 text-xs">{section.description}</p>
                ) : null}
              </div>
              <div className="p-4">
                {section.format === "text" ? (
                  <pre className="bg-base-200 max-h-[44vh] overflow-auto rounded-lg p-3 text-sm whitespace-pre-wrap">
                    {String(section.content ?? "")}
                  </pre>
                ) : (
                  <pre className="bg-base-200 max-h-[44vh] overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                    {JSON.stringify(section.content, null, 2)}
                  </pre>
                )}
              </div>
            </section>
          ))}
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
