"use client";

import type { AiModelConfig } from "@/lib/ai/admin/control-plane-contract";

type Props = {
  modelId: string;
  models: AiModelConfig[];
  disableInputs: boolean;
  onModelChange: (value: string) => void;
  onOpenReferenceModal: () => void;
};

export function PersonaBatchToolbar({
  modelId,
  models,
  disableInputs,
  onModelChange,
  onOpenReferenceModal,
}: Props) {
  return (
    <div className="bg-base-100 border-base-300 rounded-2xl border p-5 shadow-sm">
      <div className="flex flex-col gap-6">
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

        <div
          data-testid="reference-sources-header"
          className="flex items-center justify-between gap-3"
        >
          <span className="text-sm font-medium">Reference Sources</span>
          <button
            type="button"
            className="btn btn-primary btn-sm shrink-0 gap-2"
            disabled={disableInputs}
            onClick={onOpenReferenceModal}
          >
            Add Names
          </button>
        </div>
      </div>
    </div>
  );
}
