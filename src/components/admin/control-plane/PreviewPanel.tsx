import toast from "react-hot-toast";
import { Copy, Eye, Layers } from "lucide-react";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import SafeHtml from "@/components/ui/SafeHtml";
import { renderBadge } from "./control-plane-utils";

export interface PreviewPanelProps {
  preview: PreviewResult | null;
  emptyLabel: string;
  showTokenStatsBar?: boolean;
  showPromptAssemblySection?: boolean;
  showTokenBudgetSection?: boolean;
}

export function PreviewPanel({
  preview,
  emptyLabel,
  showTokenStatsBar = true,
  showPromptAssemblySection = true,
  showTokenBudgetSection = true,
}: PreviewPanelProps) {
  if (!preview) {
    return (
      <div className="border-base-300 flex items-center justify-center rounded-lg border border-dashed p-8 text-sm opacity-50">
        <div className="text-center">
          <Eye className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p>{emptyLabel}</p>
        </div>
      </div>
    );
  }

  const budget = preview.tokenBudget;
  const rawResponse = preview.rawResponse ?? preview.markdown;
  const usagePercent = budget.maxInputTokens
    ? Math.round((budget.estimatedInputTokens / budget.maxInputTokens) * 100)
    : 0;

  const copyRenderedPreview = async () => {
    try {
      await navigator.clipboard.writeText(preview.markdown);
      toast.success("Rendered preview copied");
    } catch {
      toast.error("Failed to copy rendered preview");
    }
  };

  return (
    <div className="space-y-4">
      {showTokenBudgetSection && budget.exceeded && (
        <div className="alert alert-warning text-sm">
          {budget.message ?? "Token budget exceeded. Please simplify global rules."}
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        <details
          className="collapse-arrow border-base-300 collapse relative rounded-lg border"
          open
        >
          <summary className="collapse-title text-sm font-semibold">Rendered Preview</summary>
          <div className="absolute top-3 right-9 z-10">
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square"
              aria-label="Copy rendered preview"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void copyRenderedPreview();
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="collapse-content">
            <div className="rounded-lg border p-3">
              <SafeHtml markdown={preview.markdown} className="tiptap-html" />
            </div>
          </div>
        </details>
        {showPromptAssemblySection ? (
          <details className="collapse-arrow border-base-300 collapse rounded-lg border">
            <summary className="collapse-title text-sm font-semibold">Prompt Assembly</summary>
            <div className="collapse-content">
              <pre className="bg-base-200 max-h-64 overflow-auto rounded p-3 text-xs whitespace-pre-wrap">
                {preview.assembledPrompt}
              </pre>
            </div>
          </details>
        ) : null}
        <details className="collapse-arrow border-base-300 collapse rounded-lg border">
          <summary className="collapse-title text-sm font-semibold">Raw Response</summary>
          <div className="collapse-content">
            <pre className="bg-base-200 max-h-64 overflow-auto rounded p-3 text-xs whitespace-pre-wrap">
              {rawResponse}
            </pre>
          </div>
        </details>
        {showTokenBudgetSection ? (
          <details className="collapse-arrow border-base-300 collapse rounded-lg border">
            <summary className="collapse-title text-sm font-semibold">Token Budget</summary>
            <div className="collapse-content">
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
          </details>
        ) : null}
      </div>

      {showTokenStatsBar ? (
        <div className="bg-base-200/50 flex flex-wrap items-center gap-2 rounded-lg p-3">
          {renderBadge(preview.renderOk, preview.renderError)}
          <div className="flex items-center gap-2">
            <span className="badge badge-outline gap-1">
              <Layers className="h-3 w-3" />
              Input {budget.estimatedInputTokens.toLocaleString()}/
              {budget.maxInputTokens.toLocaleString()}
            </span>
            <progress
              className={`progress w-20 ${usagePercent > 90 ? "progress-error" : usagePercent > 70 ? "progress-warning" : "progress-success"}`}
              value={usagePercent}
              max={100}
            />
          </div>
          <span className="badge badge-outline">
            Max Out {budget.maxOutputTokens.toLocaleString()}
          </span>
          {budget.compressedStages.length > 0 && (
            <span className="badge badge-warning gap-1">
              Compressed: {budget.compressedStages.join(" → ")}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
