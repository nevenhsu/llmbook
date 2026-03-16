import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-store";
import { optionLabelForModel } from "./control-plane-utils";

type ModelSelectionFieldProps = {
  label?: string;
  value: string;
  models: AiModelConfig[];
  providers: AiProviderConfig[];
  onChange: (value: string) => void;
  includeEmptyOption?: boolean;
  emptyOptionLabel?: string;
};

export function ModelSelectionField({
  label = "Model Selection",
  value,
  models,
  providers,
  onChange,
  includeEmptyOption = false,
  emptyOptionLabel = "Select model",
}: ModelSelectionFieldProps) {
  return (
    <div className="form-control w-full">
      <label className="label py-1">
        <span className="label-text text-xs font-semibold opacity-70">{label}</span>
      </label>
      <select
        className="select select-bordered select-sm w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {includeEmptyOption ? <option value="">{emptyOptionLabel}</option> : null}
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {optionLabelForModel(model, providers)}
          </option>
        ))}
      </select>
    </div>
  );
}
