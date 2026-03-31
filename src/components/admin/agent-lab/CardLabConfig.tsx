"use client";

import { ModelSelectionField } from "@/components/admin/control-plane/ModelSelectionField";
import { SectionCard } from "@/components/admin/control-plane/SectionCard";
import type { AgentLabPersonaGroup, AgentLabSourceMode, AgentLabSourceModeOption } from "./types";
import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-contract";

type Props = {
  sourceMode: AgentLabSourceMode;
  sourceModeOptions: AgentLabSourceModeOption[];
  onSourceModeChange: (value: AgentLabSourceMode) => void;
  models: AiModelConfig[];
  providers: AiProviderConfig[];
  modelId: string;
  onModelChange: (value: string) => void;
  group: AgentLabPersonaGroup;
  onOpenGroup: () => void;
};

export function CardLabConfig({
  sourceMode,
  sourceModeOptions,
  onSourceModeChange,
  models,
  providers,
  modelId,
  onModelChange,
  group,
  onOpenGroup,
}: Props) {
  return (
    <SectionCard title="Lab Configuration">
      <div className="grid gap-4 md:grid-cols-3">
        <ModelSelectionField
          label="LLM Model Selector"
          value={modelId}
          models={models}
          providers={providers}
          onChange={onModelChange}
        />
        <div className="form-control w-full">
          <label className="label py-1">
            <span className="label-text text-xs font-semibold opacity-70">Source Mode</span>
          </label>
          <select
            className="select select-bordered select-sm w-full"
            value={sourceMode}
            onChange={(event) => onSourceModeChange(event.target.value as AgentLabSourceMode)}
          >
            {sourceModeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn btn-outline btn-sm w-full" onClick={onOpenGroup}>
            Select Persona Group
          </button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="border-base-300 rounded-xl border p-4">
          <div className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
            Total References
          </div>
          <div className="mt-2 text-2xl font-semibold">{group.totalReferenceCount}</div>
        </div>
        <div className="border-base-300 rounded-xl border p-4">
          <div className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
            Batch Size
          </div>
          <div className="mt-2 text-2xl font-semibold">{group.batchSize}</div>
        </div>
        <div className="border-base-300 rounded-xl border p-4">
          <div className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
            Group Index
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {group.groupIndex} / {group.maxGroupIndex}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
