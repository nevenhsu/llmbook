"use client";

import { ModalShell } from "@/components/ui/ModalShell";
import type { PromptAssemblyPreview } from "@/lib/ai/admin/persona-generation-prompt-template";

type Props = {
  isOpen: boolean;
  preview: PromptAssemblyPreview | null;
  onClose: () => void;
};

export function PromptAssemblyModal({ isOpen, preview, onClose }: Props) {
  if (!isOpen || !preview) {
    return null;
  }

  const budget = preview.tokenBudget;

  return (
    <dialog className="modal modal-open" open>
      <ModalShell
        title="Prompt Assembly"
        description="Review the staged prompt bundle and token budget injected into the model before persona generation runs."
        onClose={onClose}
        maxWidthClassName="max-w-5xl"
        minHeightClassName="min-h-[48vh]"
        footer={
          <>
            <span></span>
            <button className="btn btn-primary btn-sm" onClick={onClose}>
              Close
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="px-1">
              <h4 className="text-sm font-semibold">Prompt Assembly</h4>
              <p className="mt-1 text-xs opacity-60">
                Review each generation stage separately, then expand raw prompt text only when you
                need the exact payload.
              </p>
            </div>

            {preview.stages.map((stage) => (
              <div
                key={stage.name}
                className="bg-base-100 border-base-300/60 overflow-hidden rounded-xl border"
              >
                <div className="collapse-arrow collapse">
                  <input type="checkbox" />
                  <div className="collapse-title bg-base-200/70 px-4 py-3">
                    <div className="flex items-start justify-between gap-3 pr-6">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold">
                            Stage {stage.index}: {stage.name}
                          </div>
                          {stage.hasValidatedContext ? (
                            <span className="badge badge-outline badge-sm border-base-300/70 text-[11px] font-medium">
                              [validated_context]
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs opacity-65">{stage.goal}</div>
                      </div>
                      <div className="bg-base-100 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap opacity-80">
                        {stage.tokens.toLocaleString()} tokens
                      </div>
                    </div>
                  </div>
                  <div className="collapse-content border-base-300/50 bg-base-200/30 border-t px-0 pb-0">
                    <pre className="max-h-[34vh] overflow-auto p-4 text-xs whitespace-pre-wrap">
                      {stage.rawPrompt}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-base-100 border-base-300/60 overflow-hidden rounded-xl border">
            <div className="bg-base-200/70 px-4 py-3 text-sm font-semibold">Token Budget</div>
            <div className="bg-base-200/30 space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="bg-base-200 rounded-lg px-3 py-2">
                  <div className="text-xs opacity-60">Estimated Input</div>
                  <div className="font-mono text-sm font-semibold">
                    {budget.estimatedInputTokens.toLocaleString()}
                  </div>
                </div>
                <div className="bg-base-200 rounded-lg px-3 py-2">
                  <div className="text-xs opacity-60">Max Input</div>
                  <div className="font-mono text-sm font-semibold">
                    {budget.maxInputTokens.toLocaleString()}
                  </div>
                </div>
                <div className="bg-base-200 rounded-lg px-3 py-2">
                  <div className="text-xs opacity-60">Max Output</div>
                  <div className="font-mono text-sm font-semibold">
                    {budget.maxOutputTokens.toLocaleString()}
                  </div>
                </div>
              </div>

              {budget.compressedStages.length > 0 ? (
                <div className="text-sm opacity-70">
                  Compressed stages: {budget.compressedStages.join(" -> ")}
                </div>
              ) : null}

              {budget.exceeded ? (
                <div className="alert alert-warning text-sm">
                  {budget.message ?? "Token budget exceeded. Please simplify the prompt blocks."}
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="table-xs table">
                  <thead>
                    <tr>
                      <th>Block</th>
                      <th className="text-right">Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budget.blockStats.map((block) => (
                      <tr key={block.name}>
                        <td>{block.name}</td>
                        <td className="text-right font-mono">{block.tokens.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
