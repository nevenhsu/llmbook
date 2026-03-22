"use client";

import type { AiModelConfig } from "@/lib/ai/admin/control-plane-contract";

type Props = {
  modelId: string;
  models: AiModelConfig[];
  referenceInput: string;
  disableInputs: boolean;
  addLoading: boolean;
  addElapsedSeconds?: number;
  addLastCompletedElapsedSeconds?: number | null;
  addLastCompletedAddedCount?: number | null;
  addLastCompletedDuplicateCount?: number | null;
  onModelChange: (value: string) => void;
  onReferenceInputChange: (value: string) => void;
  onAdd: () => void;
};

function formatElapsed(elapsedSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(elapsedSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function PersonaBatchToolbar({
  modelId,
  models,
  referenceInput,
  disableInputs,
  addLoading,
  addElapsedSeconds = 0,
  addLastCompletedElapsedSeconds = null,
  addLastCompletedAddedCount = null,
  addLastCompletedDuplicateCount = null,
  onModelChange,
  onReferenceInputChange,
  onAdd,
}: Props) {
  const completedSummary =
    typeof addLastCompletedAddedCount === "number" &&
    typeof addLastCompletedDuplicateCount === "number"
      ? `${addLastCompletedAddedCount} ${
          addLastCompletedAddedCount === 1 ? "row" : "rows"
        }, ${addLastCompletedDuplicateCount} ${
          addLastCompletedDuplicateCount === 1 ? "duplicate" : "duplicates"
        }`
      : null;
  const addStatusSummaryText = addLoading
    ? "Adding"
    : completedSummary
      ? `Added ${completedSummary}`
      : null;
  const addStatusElapsedText = addLoading
    ? formatElapsed(addElapsedSeconds)
    : typeof addLastCompletedElapsedSeconds === "number" && completedSummary
      ? formatElapsed(addLastCompletedElapsedSeconds)
      : null;

  return (
    <div className="bg-base-100 border-base-300 rounded-2xl border p-5 shadow-sm">
      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)_auto]">
        <label className="form-control">
          <span className="label-text text-sm font-medium">Model Selection</span>
          <select
            className="select select-bordered mt-2 w-full"
            value={modelId}
            disabled={disableInputs}
            onChange={(event) => onModelChange(event.target.value)}
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="form-control">
          <span className="label-text text-sm font-medium">Reference Sources</span>
          <textarea
            className="textarea textarea-bordered mt-2 min-h-[7rem] w-full"
            value={referenceInput}
            disabled={disableInputs}
            onChange={(event) => onReferenceInputChange(event.target.value)}
            placeholder=""
          />
          <span className="mt-2 text-xs opacity-60">
            comma or newline separated, ex: Anthony Bourdain, Hayao Miyazaki, Ursula K. Le Guin
          </span>
        </label>

        <div className="xl:col-span-3">
          <div className="flex items-center justify-between gap-3">
            {addStatusSummaryText ? (
              <div data-testid="reference-input-add-status" className="text-xs opacity-60">
                <span
                  data-testid="reference-input-add-status-summary"
                  className="whitespace-nowrap"
                >
                  {addStatusSummaryText}
                </span>
              </div>
            ) : null}
            <div className="ml-auto flex items-center gap-3">
              {addStatusElapsedText ? (
                <span
                  data-testid="reference-input-add-status-elapsed"
                  className="text-xs whitespace-nowrap opacity-60"
                >
                  {addStatusElapsedText}
                </span>
              ) : null}
              <button
                type="button"
                className="btn btn-primary shrink-0 gap-2"
                disabled={disableInputs || referenceInput.trim().length === 0}
                onClick={onAdd}
              >
                {addLoading ? <span className="loading loading-spinner loading-xs" /> : null}
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
