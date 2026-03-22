"use client";

import { Pause, Play } from "lucide-react";
import type { PersonaBatchRow as PersonaBatchRowType } from "@/lib/ai/admin/persona-batch-contract";
import { PersonaBatchRow } from "./PersonaBatchRow";

type Props = {
  rows: PersonaBatchRowType[];
  chunkSize: number;
  bulkTask: "check" | "prompt" | "generate" | "save" | null;
  bulkElapsedSeconds: number;
  bulkPausedTask: "check" | "prompt" | "generate" | "save" | null;
  bulkPausedElapsedSeconds: number;
  bulkPauseRequested: boolean;
  bulkLastCompletedTask: "check" | "prompt" | "generate" | "save" | null;
  bulkLastElapsedSeconds: number;
  anyApiActive: boolean;
  bulkActionsDisabled: boolean;
  canReset: boolean;
  canRemoveDuplicates: boolean;
  onOpenChunkSize: () => void;
  onBulkPrompt: () => void;
  onBulkGenerate: () => void;
  onBulkSave: () => void;
  onRequestBulkPause: () => void;
  onResumeBulkTask: () => void;
  onRemoveDuplicates: () => void;
  onReset: () => void;
  onEditContextPrompt: (rowId: string) => void;
  onEditIdentity: (rowId: string) => void;
  onViewPersona: (rowId: string) => void;
  onViewError: (rowId: string) => void;
  onRunPromptAssist: (rowId: string) => void;
  onRunGenerate: (rowId: string) => void;
  onRunSave: (rowId: string) => void;
  onClear: (rowId: string) => void;
};

function bulkActiveLabel(task: "check" | "prompt" | "generate" | "save" | null): string | null {
  if (task === "prompt") {
    return "Prompting";
  }
  if (task === "generate") {
    return "Generating";
  }
  if (task === "save") {
    return "Saving";
  }
  return null;
}

function bulkCompletedLabel(task: "check" | "prompt" | "generate" | "save" | null): string | null {
  if (task === "prompt") {
    return "Prompted";
  }
  if (task === "generate") {
    return "Generated";
  }
  if (task === "save") {
    return "Saved";
  }
  return null;
}

function formatElapsed(elapsedSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(elapsedSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function PersonaBatchTable({
  rows,
  chunkSize,
  bulkTask,
  bulkElapsedSeconds,
  bulkPausedTask,
  bulkPausedElapsedSeconds,
  bulkPauseRequested,
  bulkLastCompletedTask,
  bulkLastElapsedSeconds,
  anyApiActive,
  bulkActionsDisabled,
  canReset,
  canRemoveDuplicates,
  onOpenChunkSize,
  onBulkPrompt,
  onBulkGenerate,
  onBulkSave,
  onRequestBulkPause,
  onResumeBulkTask,
  onRemoveDuplicates,
  onReset,
  onEditContextPrompt,
  onEditIdentity,
  onViewPersona,
  onViewError,
  onRunPromptAssist,
  onRunGenerate,
  onRunSave,
  onClear,
}: Props) {
  const activeBulkLabel = bulkActiveLabel(bulkTask);
  const pausedBulkLabel = bulkActiveLabel(bulkPausedTask);
  const completedBulkLabel = bulkCompletedLabel(bulkLastCompletedTask);
  const bulkStatusText = activeBulkLabel
    ? `${activeBulkLabel} ${formatElapsed(bulkElapsedSeconds)}`
    : pausedBulkLabel
      ? `${pausedBulkLabel} ${formatElapsed(bulkPausedElapsedSeconds)} paused`
      : completedBulkLabel
        ? `${completedBulkLabel} ${formatElapsed(bulkLastElapsedSeconds)}`
        : null;

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <div
          data-testid="batch-rows-header"
          className="bg-base-100 border-base-content/20 flex flex-col gap-3 rounded-2xl border p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between"
        >
          <div>
            <h2 className="text-lg font-semibold">Batch Rows</h2>
            <p className="text-sm opacity-60">Manage row-level and bulk persona actions here.</p>
          </div>
          <div
            data-testid="batch-rows-header-controls"
            className="flex w-full flex-col gap-2 xl:w-auto"
          >
            <div className="flex w-full flex-wrap items-center gap-2 xl:justify-end">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={anyApiActive}
                onClick={onOpenChunkSize}
              >
                Chunk Size: {chunkSize}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm gap-2"
                disabled={bulkActionsDisabled}
                onClick={onBulkPrompt}
              >
                {bulkTask === "prompt" ? (
                  <span
                    data-testid="bulk-loading-prompt"
                    className="loading loading-spinner loading-xs"
                  />
                ) : null}
                Prompt
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm gap-2"
                disabled={bulkActionsDisabled}
                onClick={onBulkGenerate}
              >
                {bulkTask === "generate" ? (
                  <span
                    data-testid="bulk-loading-generate"
                    className="loading loading-spinner loading-xs"
                  />
                ) : null}
                Generate
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm gap-2"
                disabled={bulkActionsDisabled}
                onClick={onBulkSave}
              >
                {bulkTask === "save" ? (
                  <span
                    data-testid="bulk-loading-save"
                    className="loading loading-spinner loading-xs"
                  />
                ) : null}
                Save
              </button>
              {bulkTask !== null ? (
                <div
                  className="tooltip tooltip-top"
                  data-tip={
                    bulkPauseRequested ? "pausing after current batch" : "pause after current batch"
                  }
                >
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-circle"
                    aria-label="Pause bulk task"
                    disabled={bulkPauseRequested}
                    onClick={onRequestBulkPause}
                  >
                    <Pause className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              {bulkTask === null && bulkPausedTask !== null ? (
                <div className="tooltip tooltip-top" data-tip="resume batch processing">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-circle"
                    aria-label="Resume bulk task"
                    onClick={onResumeBulkTask}
                  >
                    <Play className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              <div
                data-testid="batch-rows-header-trailing"
                className="ml-auto flex items-center gap-2"
              >
                <div className="tooltip tooltip-top" data-tip="remove duplicate names">
                  <button
                    type="button"
                    className="btn btn-outline btn-error btn-sm"
                    disabled={!canRemoveDuplicates}
                    onClick={onRemoveDuplicates}
                  >
                    Clear
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={!canReset}
                  onClick={onReset}
                >
                  Reset
                </button>
              </div>
            </div>
            {bulkStatusText ? <div className="text-xs opacity-60">{bulkStatusText}</div> : null}
          </div>
        </div>
        <div className="border-base-300 rounded-2xl border border-dashed p-10 text-center text-sm opacity-60">
          Add reference names above to start a batch persona run.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        data-testid="batch-rows-header"
        className="bg-base-100 border-base-content/20 flex flex-col gap-3 rounded-2xl border p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between"
      >
        <div>
          <h2 className="text-lg font-semibold">Batch Rows</h2>
          <p className="text-sm opacity-60">Manage row-level and bulk persona actions here.</p>
        </div>
        <div
          data-testid="batch-rows-header-controls"
          className="flex w-full flex-col gap-2 xl:w-auto"
        >
          <div className="flex w-full flex-wrap items-center gap-2 xl:justify-end">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={anyApiActive}
              onClick={onOpenChunkSize}
            >
              Chunk Size: {chunkSize}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm gap-2"
              disabled={bulkActionsDisabled}
              onClick={onBulkPrompt}
            >
              {bulkTask === "prompt" ? (
                <span
                  data-testid="bulk-loading-prompt"
                  className="loading loading-spinner loading-xs"
                />
              ) : null}
              Prompt
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm gap-2"
              disabled={bulkActionsDisabled}
              onClick={onBulkGenerate}
            >
              {bulkTask === "generate" ? (
                <span
                  data-testid="bulk-loading-generate"
                  className="loading loading-spinner loading-xs"
                />
              ) : null}
              Generate
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm gap-2"
              disabled={bulkActionsDisabled}
              onClick={onBulkSave}
            >
              {bulkTask === "save" ? (
                <span
                  data-testid="bulk-loading-save"
                  className="loading loading-spinner loading-xs"
                />
              ) : null}
              Save
            </button>
            {bulkTask !== null ? (
              <div
                className="tooltip tooltip-top"
                data-tip={
                  bulkPauseRequested ? "pausing after current batch" : "pause after current batch"
                }
              >
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-circle"
                  aria-label="Pause bulk task"
                  disabled={bulkPauseRequested}
                  onClick={onRequestBulkPause}
                >
                  <Pause className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            {bulkTask === null && bulkPausedTask !== null ? (
              <div className="tooltip tooltip-top" data-tip="resume batch processing">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-circle"
                  aria-label="Resume bulk task"
                  onClick={onResumeBulkTask}
                >
                  <Play className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            <div
              data-testid="batch-rows-header-trailing"
              className="ml-auto flex items-center gap-2"
            >
              <div className="tooltip tooltip-top" data-tip="remove duplicate names">
                <button
                  type="button"
                  className="btn btn-outline btn-error btn-sm"
                  disabled={!canRemoveDuplicates}
                  onClick={onRemoveDuplicates}
                >
                  Clear
                </button>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={!canReset}
                onClick={onReset}
              >
                Reset
              </button>
            </div>
          </div>
          {bulkStatusText ? <div className="text-xs opacity-60">{bulkStatusText}</div> : null}
        </div>
      </div>
      <div className="bg-base-100 border-base-content/20 overflow-x-auto rounded-2xl border shadow-sm">
        <table className="table w-max min-w-[88rem] border-separate border-spacing-0">
          <thead>
            <tr className="bg-base-200/40">
              <th className="border-base-content/20 border-r border-b">Reference Name</th>
              <th className="border-base-content/20 border-r border-b">Context Prompt</th>
              <th className="border-base-content/20 border-r border-b">Persona</th>
              <th className="border-base-content/20 border-r border-b">Time</th>
              <th className="border-base-content/20 border-r border-b">Actions</th>
              <th className="border-base-content/20 border-b">Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PersonaBatchRow
                key={row.rowId}
                row={row}
                bulkTask={bulkTask}
                anyApiActive={anyApiActive}
                onEditContextPrompt={() => onEditContextPrompt(row.rowId)}
                onEditIdentity={() => onEditIdentity(row.rowId)}
                onViewPersona={() => onViewPersona(row.rowId)}
                onViewError={() => onViewError(row.rowId)}
                onRunPromptAssist={() => void onRunPromptAssist(row.rowId)}
                onRunGenerate={() => void onRunGenerate(row.rowId)}
                onRunSave={() => void onRunSave(row.rowId)}
                onClear={() => void onClear(row.rowId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
