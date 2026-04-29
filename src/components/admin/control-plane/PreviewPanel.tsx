import toast from "react-hot-toast";
import { Copy, Eye, Layers } from "lucide-react";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import {
  parseMarkdownActionOutput,
  parsePostActionOutput,
} from "@/lib/ai/prompt-runtime/action-output";
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
  const postOutput = preview.rawResponse ? parsePostActionOutput(preview.rawResponse) : null;
  const shouldRenderStructuredPost =
    postOutput !== null &&
    !postOutput.error &&
    Boolean(postOutput.title) &&
    postOutput.body.trim().length > 0 &&
    postOutput.tags.length > 0;
  const imageRequest = preview.rawResponse
    ? shouldRenderStructuredPost && postOutput
      ? postOutput.imageRequest
      : (parseMarkdownActionOutput(preview.rawResponse).output?.imageRequest ?? {
          needImage: false,
          imagePrompt: null,
          imageAlt: null,
        })
    : {
        needImage: false,
        imagePrompt: null,
        imageAlt: null,
      };
  const usagePercent = budget.maxInputTokens
    ? Math.round((budget.estimatedInputTokens / budget.maxInputTokens) * 100)
    : 0;
  const audit = preview.auditDiagnostics ?? null;
  const flowDiagnostics = preview.flowDiagnostics ?? null;
  const auditRepairGuidance = audit?.repairGuidance ?? [];
  const auditMissingSignals = audit?.missingSignals ?? [];

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

      <div className="space-y-3">
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
              {shouldRenderStructuredPost && postOutput ? (
                <div className="space-y-4">
                  <section className="space-y-1.5">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                      Title
                    </p>
                    <p className="text-base font-semibold">{postOutput.title}</p>
                  </section>
                  <section className="space-y-2">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                      Tags
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {postOutput.tags.map((tag) => (
                        <span key={tag} className="badge badge-outline">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </section>
                  <section className="space-y-2">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                      Body
                    </p>
                    <SafeHtml markdown={postOutput.body} className="tiptap-html" />
                  </section>
                </div>
              ) : (
                <SafeHtml markdown={preview.markdown} className="tiptap-html" />
              )}
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
        <details className="collapse-arrow border-base-300 collapse rounded-lg border">
          <summary className="collapse-title text-sm font-semibold">Image Request</summary>
          <div className="collapse-content">
            <div className="space-y-4 rounded-lg border p-3">
              <section className="space-y-1.5">
                <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                  Need Image
                </p>
                <p className="font-medium">{imageRequest.needImage ? "true" : "false"}</p>
              </section>
              {imageRequest.needImage ? (
                <>
                  <section className="space-y-1.5">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                      Image Prompt
                    </p>
                    <p className="text-sm leading-6">{imageRequest.imagePrompt ?? "None"}</p>
                  </section>
                  <section className="space-y-1.5">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                      Image Alt
                    </p>
                    <p className="text-sm leading-6">{imageRequest.imageAlt ?? "None"}</p>
                  </section>
                </>
              ) : (
                <p className="text-sm opacity-70">No image requested for this preview.</p>
              )}
            </div>
          </div>
        </details>
        {audit ? (
          <details className="collapse-arrow border-base-300 collapse rounded-lg border">
            <summary className="collapse-title text-sm font-semibold">Audit Diagnostics</summary>
            <div className="collapse-content">
              <div className="space-y-4 rounded-lg border p-3">
                <section className="space-y-1.5">
                  <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                    Audit Result
                  </p>
                  <p className="font-medium">
                    {audit.status === "passed_after_repair" ? "Passed After Repair" : "Passed"}
                  </p>
                </section>
                <section className="space-y-4">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                      Repair Applied
                    </p>
                    <p className="font-medium">{audit.repairApplied ? "yes" : "no"}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                      Audit Mode
                    </p>
                    <p className="font-medium">{audit.auditMode}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                      Severity
                    </p>
                    <p className="font-medium">{audit.severity}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                      Confidence
                    </p>
                    <p className="font-medium">{audit.confidence?.toFixed(2) ?? "N/A"}</p>
                  </div>
                </section>
                <section className="space-y-1.5">
                  <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                    Audit Issues
                  </p>
                  {audit.issues.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
                      {audit.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm opacity-70">No persona drift issues were detected.</p>
                  )}
                </section>
                {auditMissingSignals.length > 0 ? (
                  <section className="space-y-1.5">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                      Missing Signals
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
                      {auditMissingSignals.map((signal) => (
                        <li key={signal}>{signal}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {auditRepairGuidance.length > 0 ? (
                  <section className="space-y-1.5">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                      Repair Guidance
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
                      {auditRepairGuidance.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            </div>
          </details>
        ) : null}
        {flowDiagnostics ? (
          <details className="collapse-arrow border-base-300 collapse rounded-lg border">
            <summary className="collapse-title text-sm font-semibold">Flow Diagnostics</summary>
            <div className="collapse-content">
              <div className="space-y-4 rounded-lg border p-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <section className="space-y-1.5">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                      Final Status
                    </p>
                    <p className="font-medium">{flowDiagnostics.finalStatus}</p>
                  </section>
                  <section className="space-y-1.5">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                      Terminal Stage
                    </p>
                    <p className="font-medium">{flowDiagnostics.terminalStage ?? "None"}</p>
                  </section>
                  <section className="space-y-1.5">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                      Attempts
                    </p>
                    <p className="font-medium">{flowDiagnostics.attempts.length}</p>
                  </section>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-xs table">
                    <thead>
                      <tr>
                        <th>Stage</th>
                        <th className="text-right">Main</th>
                        <th className="text-right">Schema Repair</th>
                        <th className="text-right">Quality Repair</th>
                        <th className="text-right">Regenerate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flowDiagnostics.attempts.map((attempt) => (
                        <tr key={attempt.stage}>
                          <td>{attempt.stage}</td>
                          <td className="text-right font-mono">{attempt.main}</td>
                          <td className="text-right font-mono">{attempt.schemaRepair}</td>
                          <td className="text-right font-mono">{attempt.repair}</td>
                          <td className="text-right font-mono">{attempt.regenerate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {flowDiagnostics.gate ? (
                  <section className="space-y-1.5">
                    <p className="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">
                      Gate
                    </p>
                    <p className="text-sm">
                      selected={flowDiagnostics.gate.selectedCandidateIndex ?? "none"} passed=
                      {flowDiagnostics.gate.passedCandidateIndexes.join(", ") || "none"}
                    </p>
                  </section>
                ) : null}
              </div>
            </div>
          </details>
        ) : null}
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
