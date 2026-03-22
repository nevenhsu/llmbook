"use client";

import type { ReactNode } from "react";
import { Pause, WandSparkles } from "lucide-react";
import type {
  AiModelConfig,
  AiProviderConfig,
  PersonaProfile,
} from "@/lib/ai/admin/control-plane-store";
import type { PersonaItem } from "@/lib/ai/admin/control-plane-types";
import PersonaSelector from "@/components/ui/PersonaSelector";
import { SectionCard } from "./SectionCard";
import { ModelSelectionField } from "./ModelSelectionField";
import { PersonaInfoCard } from "./PersonaInfoCard";
import {
  formatPromptAssistStatus,
  readPromptAssistButtonMode,
} from "./persona-prompt-assist-utils";

type Props = {
  title: string;
  icon: ReactNode;
  description: string;
  modelId: string;
  models: AiModelConfig[];
  providers: AiProviderConfig[];
  onModelChange: (modelId: string) => void;
  extraPrompt: string;
  onExtraPromptChange: (value: string) => void;
  extraPromptPlaceholder: string;
  assistAriaLabel: string;
  assistLoading: boolean;
  assistError: string | null;
  assistCompleted: boolean;
  assistElapsedSeconds: number;
  assistIdleDescription: string;
  assistDisabled?: boolean;
  onAssist: () => Promise<void> | void;
  footerActions: ReactNode;
  targetPersonaId?: string;
  targetPersonaOptions?: PersonaItem[];
  onTargetPersonaChange?: (personaId: string) => void;
  targetPersona?: PersonaItem | null;
  targetPersonaProfile?: PersonaProfile | null;
};

export function PersonaPromptCard({
  title,
  icon,
  description,
  modelId,
  models,
  providers,
  onModelChange,
  extraPrompt,
  onExtraPromptChange,
  extraPromptPlaceholder,
  assistAriaLabel,
  assistLoading,
  assistError,
  assistCompleted,
  assistElapsedSeconds,
  assistIdleDescription,
  assistDisabled = false,
  onAssist,
  footerActions,
  targetPersonaId,
  targetPersonaOptions = [],
  onTargetPersonaChange,
  targetPersona,
  targetPersonaProfile,
}: Props) {
  const promptAssistButtonMode = readPromptAssistButtonMode(assistLoading);
  const promptAssistStatus = formatPromptAssistStatus(
    assistLoading,
    assistCompleted,
    assistElapsedSeconds,
    assistError,
  );

  return (
    <SectionCard title={title} icon={icon}>
      <div className="space-y-6">
        <p className="max-w-2xl text-sm leading-relaxed opacity-60">{description}</p>

        <div className="space-y-5">
          {onTargetPersonaChange ? (
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold opacity-70">Target Persona</span>
              </label>
              <PersonaSelector
                value={targetPersonaId ?? ""}
                initialOptions={targetPersonaOptions.map((persona) => ({
                  id: persona.id,
                  username: persona.username,
                  display_name: persona.display_name,
                  avatar_url: persona.avatar_url,
                }))}
                onChange={(personaId) => onTargetPersonaChange(personaId)}
                placeholder="Search persona..."
              />
            </div>
          ) : null}

          <ModelSelectionField
            value={modelId}
            models={models}
            providers={providers}
            onChange={onModelChange}
          />

          {targetPersona ? (
            <PersonaInfoCard persona={targetPersona} profile={targetPersonaProfile ?? null} />
          ) : null}

          <div className="form-control w-full">
            <label className="label py-1">
              <span className="label-text text-xs font-semibold opacity-70">
                Context / Extra Prompt
              </span>
            </label>
            <div className="flex items-start gap-2">
              <textarea
                className="textarea textarea-bordered textarea-sm focus:textarea-primary min-h-28 flex-1 resize-y"
                value={extraPrompt}
                onChange={(event) => onExtraPromptChange(event.target.value)}
                placeholder={extraPromptPlaceholder}
                rows={4}
              />
              <button
                className="bg-base-100 border-base-300 hover:border-primary hover:bg-base-100 btn btn-sm shrink-0 gap-2 border shadow-none"
                disabled={!modelId || assistDisabled}
                aria-label={assistAriaLabel}
                title="Prompt AI"
                onClick={() => void onAssist()}
              >
                {promptAssistButtonMode === "cancel" ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <WandSparkles className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className={`mt-2 text-xs ${assistError ? "text-error" : "opacity-55"}`}>
              {promptAssistStatus ?? assistIdleDescription}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <div className="flex flex-wrap items-center justify-end gap-2">{footerActions}</div>
          </div>
        </div>

        {models.length === 0 ? (
          <div className="alert alert-warning text-sm shadow-sm">
            <div className="flex gap-2">
              <span>
                No eligible model. Add API key to provider and enable at least one text_generation
                model.
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
