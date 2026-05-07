import toast from "react-hot-toast";
import { Copy, Eye, Layers } from "lucide-react";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import {
  parseMarkdownActionOutput,
  parsePostActionOutput,
  parsePostBodyActionOutput,
} from "@/lib/ai/prompt-runtime/action-output";
import SafeHtml from "@/components/ui/SafeHtml";
import { renderBadge } from "./control-plane-utils";

export interface PreviewPanelProps {
  preview: PreviewResult | null;
  emptyLabel: string;
}

function buildRawResponseFromDebug(preview: PreviewResult): string {
  const records = preview.stageDebugRecords;
  if (!records || records.length === 0) {
    return preview.rawResponse ?? preview.markdown;
  }

  return records
    .map((record) => {
      const latestAttempt = record.attempts[record.attempts.length - 1];
      const header = `## Stage: ${record.name}`;
      const meta = latestAttempt
        ? `finishReason: ${latestAttempt.finishReason ?? "unknown"}\n${latestAttempt.text}`
        : "(no response)";
      return `${header}\n${meta}`;
    })
    .join("\n\n---\n\n");
}

function extractImageRequest(preview: PreviewResult): {
  needImage: boolean;
  imagePrompt: string | null;
  imageAlt: string | null;
} {
  const raw = preview.rawResponse;
  if (!raw) {
    return { needImage: false, imagePrompt: null, imageAlt: null };
  }

  const postOutput = parsePostActionOutput(raw);
  if (!postOutput.error && postOutput.title) {
    return postOutput.imageRequest;
  }

  const bodyOutput = parsePostBodyActionOutput(raw);
  if (!bodyOutput.error) {
    return bodyOutput.imageRequest;
  }

  const markdownOutput = parseMarkdownActionOutput(raw);
  if (markdownOutput.output?.imageRequest) {
    return markdownOutput.output.imageRequest;
  }

  return { needImage: false, imagePrompt: null, imageAlt: null };
}

function extractProbability(preview: PreviewResult): number | null {
  const raw = preview.rawResponse;
  if (!raw) {
    return null;
  }

  const postOutput = parsePostActionOutput(raw);
  if (!postOutput.error && postOutput.title) {
    return postOutput.metadata.probability;
  }

  const bodyOutput = parsePostBodyActionOutput(raw);
  if (!bodyOutput.error) {
    return bodyOutput.metadata.probability;
  }

  const markdownOutput = parseMarkdownActionOutput(raw);
  if (markdownOutput.output?.metadata?.probability !== undefined) {
    return markdownOutput.output.metadata.probability;
  }

  return null;
}

export function PreviewPanel({ preview, emptyLabel }: PreviewPanelProps) {
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
  const rawResponse = buildRawResponseFromDebug(preview);
  const postOutput = preview.rawResponse ? parsePostActionOutput(preview.rawResponse) : null;
  const shouldRenderStructuredPost =
    postOutput !== null &&
    !postOutput.error &&
    Boolean(postOutput.title) &&
    postOutput.body.trim().length > 0 &&
    postOutput.tags.length > 0;
  const imageRequest = extractImageRequest(preview);
  const probability = extractProbability(preview);
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
        {probability !== null && probability > 0 && (
          <span className="badge badge-info gap-1">Probability {probability}%</span>
        )}
        {budget.exceeded && (
          <span className="badge badge-error">{budget.message ?? "Token budget exceeded"}</span>
        )}
      </div>

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
      </div>
    </div>
  );
}
