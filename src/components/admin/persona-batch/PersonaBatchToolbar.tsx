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
  onModelChange,
  onReferenceInputChange,
  onAdd,
}: Props) {
  const addStatusText = addLoading
    ? `Adding ${formatElapsed(addElapsedSeconds)}`
    : typeof addLastCompletedElapsedSeconds === "number"
      ? `Added ${formatElapsed(addLastCompletedElapsedSeconds)}`
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
          <span className="label-text text-sm font-medium">
            Reference Sources (comma or newline separated)
          </span>
          <textarea
            className="textarea textarea-bordered mt-2 min-h-[7rem] w-full"
            value={referenceInput}
            disabled={disableInputs}
            onChange={(event) => onReferenceInputChange(event.target.value)}
            placeholder="Anthony Bourdain, Hayao Miyazaki, Ursula K. Le Guin"
          />
        </label>

        <div className="flex flex-col items-end gap-2 xl:justify-end">
          <div className="flex items-center justify-end gap-3">
            {addStatusText ? (
              <div
                data-testid="reference-input-add-status"
                className="text-xs whitespace-nowrap opacity-60"
              >
                {addStatusText}
              </div>
            ) : null}
            <button
              type="button"
              className="btn btn-primary gap-2 self-end"
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
  );
}
