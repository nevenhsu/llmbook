"use client";

import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import type { PersonaGenerationStageDebugRecord } from "@/lib/ai/admin/control-plane-contract";

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  });
}

function StageAttemptBlock({
  attempt,
  text,
  finishReason,
  providerId,
  modelId,
  hadError,
}: {
  attempt: string;
  text: string;
  finishReason: string | null;
  providerId: string | null;
  modelId: string | null;
  hadError: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-base-300 border-t pt-2 first:border-t-0 first:pt-0">
      <button
        type="button"
        className={`flex w-full items-center gap-1 text-left text-xs font-medium ${hadError ? "text-error" : ""}`}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <span>{attempt}</span>
        {finishReason ? <span className="badge badge-xs">{finishReason}</span> : null}
        {hadError ? <span className="badge badge-error badge-xs">error</span> : null}
        {providerId ? (
          <span className="text-base-content/40 text-[10px]">
            {providerId}/{modelId}
          </span>
        ) : null}
      </button>
      {expanded ? (
        <pre className="bg-base-200 mt-1 max-h-48 overflow-auto rounded p-2 text-[10px] whitespace-pre-wrap">
          {text || "(empty)"}
        </pre>
      ) : null}
    </div>
  );
}

function StageBlock({ record }: { record: PersonaGenerationStageDebugRecord }) {
  const [expanded, setExpanded] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);

  const handleCopyAll = useCallback(() => {
    const parts = [
      `## Stage: ${record.name}`,
      `Output tokens: ${record.outputMaxTokens}`,
      "",
      "### Prompt",
      record.displayPrompt,
      "",
    ];
    for (const a of record.attempts) {
      parts.push(
        `### ${a.attempt}`,
        `provider: ${a.providerId ?? "-"} / ${a.modelId ?? "-"}`,
        `finishReason: ${a.finishReason ?? "-"}`,
        `hadError: ${a.hadError}`,
        a.text || "(empty)",
        "",
      );
    }
    copyToClipboard(parts.join("\n"));
  }, [record]);

  return (
    <div className="border-base-300 rounded-lg border">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm font-semibold"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          {record.name}
          <span className="text-base-content/50 text-[11px] font-normal">
            ({record.attempts.length} attempt{record.attempts.length !== 1 ? "s" : ""})
          </span>
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs h-6 min-h-0 px-2"
          onClick={handleCopyAll}
          title="Copy stage data"
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>

      {expanded ? (
        <div className="border-base-300 space-y-3 border-t px-3 py-2">
          <div>
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-medium"
              onClick={() => setPromptExpanded((prev) => !prev)}
            >
              {promptExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Prompt{" "}
              <span className="text-base-content/40 text-[10px]">
                ({record.outputMaxTokens} max tokens)
              </span>
            </button>
            {promptExpanded ? (
              <pre className="bg-base-200 mt-1 max-h-64 overflow-auto rounded p-2 text-[10px] whitespace-pre-wrap">
                {record.displayPrompt}
              </pre>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium">Responses</div>
            {record.attempts.map((a) => (
              <StageAttemptBlock
                key={a.attempt}
                attempt={a.attempt}
                text={a.text}
                finishReason={a.finishReason}
                providerId={a.providerId}
                modelId={a.modelId}
                hadError={a.hadError}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  records?: PersonaGenerationStageDebugRecord[];
  errorMessage?: string | null;
  errorDetails?: Record<string, unknown> | null;
  rawOutput?: string | null;
};

export function PersonaGenerationDebugCard({
  records,
  errorMessage,
  errorDetails,
  rawOutput,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const effectiveRecords =
    records ?? (errorDetails?.stageDebugRecords as PersonaGenerationStageDebugRecord[] | undefined);

  const hasRecords = effectiveRecords && effectiveRecords.length > 0;
  const hasError = errorMessage || errorDetails || (rawOutput !== undefined && rawOutput !== null);
  const debugActive = records !== undefined && records !== null;

  const handleCopyAll = useCallback(() => {
    const parts: string[] = [];
    if (errorMessage) {
      parts.push("## Error", errorMessage, "");
    }
    if (errorDetails) {
      parts.push("## Error Details", JSON.stringify(errorDetails, null, 2), "");
    }
    if (rawOutput !== undefined && rawOutput !== null) {
      parts.push("## Raw Output", rawOutput || "(empty)", "");
    }
    if (effectiveRecords) {
      for (const record of effectiveRecords) {
        parts.push(`## Stage: ${record.name}`, "");
        parts.push("### Prompt", record.displayPrompt, "");
        for (const a of record.attempts) {
          parts.push(
            `### ${a.attempt}`,
            `finishReason: ${a.finishReason ?? "-"}`,
            a.text || "(empty)",
            "",
          );
        }
      }
    }
    copyToClipboard(parts.join("\n"));
  }, [effectiveRecords, errorMessage, errorDetails, rawOutput]);

  const label = hasError && !hasRecords ? "Error Debug" : "Stage Debug";
  const count = hasRecords ? effectiveRecords!.length : 0;
  const countLabel = hasRecords
    ? `(${count} stage${count !== 1 ? "s" : ""})`
    : debugActive
      ? "(no data)"
      : "";

  if (!hasRecords && !hasError && !debugActive) return null;

  return (
    <div className="border-base-300 rounded-lg border">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm font-semibold"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          {label}
          <span className="text-base-content/50 text-[11px] font-normal">{countLabel}</span>
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs h-6 min-h-0 px-2"
          onClick={handleCopyAll}
          title="Copy all data"
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>

      {expanded ? (
        <div className="border-base-300 space-y-2 border-t p-3">
          {hasError ? (
            <div className="space-y-3">
              {errorMessage ? (
                <div>
                  <div className="text-error text-xs font-medium">Error</div>
                  <pre className="bg-base-200 mt-1 max-h-36 overflow-auto rounded p-2 text-[10px] whitespace-pre-wrap">
                    {errorMessage}
                  </pre>
                </div>
              ) : null}
              {rawOutput !== undefined && rawOutput !== null ? (
                <div>
                  <div className="text-xs font-medium">Raw LLM Output</div>
                  <pre className="bg-base-200 mt-1 max-h-48 overflow-auto rounded p-2 text-[10px] whitespace-pre-wrap">
                    {rawOutput || "(empty output)"}
                  </pre>
                </div>
              ) : null}
              {errorDetails ? (
                <div>
                  <div className="text-xs font-medium">Details</div>
                  <pre className="bg-base-200 mt-1 max-h-48 overflow-auto rounded p-2 text-[10px] whitespace-pre-wrap">
                    {JSON.stringify(errorDetails, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
          {hasRecords
            ? effectiveRecords!.map((record) => <StageBlock key={record.name} record={record} />)
            : null}
        </div>
      ) : null}
    </div>
  );
}
