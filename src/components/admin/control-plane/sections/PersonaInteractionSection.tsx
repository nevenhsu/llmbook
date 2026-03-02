import type { Dispatch, SetStateAction } from "react";
import { MessageSquare, Route, Eye, Bot } from "lucide-react";
import type {
  AiModelConfig,
  AiProviderConfig,
  PreviewResult,
} from "@/lib/ai/admin/control-plane-store";
import type { PersonaItem } from "@/lib/ai/admin/control-plane-types";
import PersonaSelector from "@/components/ui/PersonaSelector";
import { SectionCard } from "../SectionCard";
import { PreviewPanel } from "../PreviewPanel";
import { optionLabelForModel } from "../control-plane-utils";

export interface PersonaInteractionSectionProps {
  interactionInput: {
    personaId: string;
    modelId: string;
    taskType: "post" | "comment";
    taskContext: string;
    soulOverrideJson: string;
    longMemoryOverride: string;
  };
  setInteractionInput: Dispatch<
    SetStateAction<{
      personaId: string;
      modelId: string;
      taskType: "post" | "comment";
      taskContext: string;
      soulOverrideJson: string;
      longMemoryOverride: string;
    }>
  >;
  personas: PersonaItem[];
  textModels: AiModelConfig[];
  providers: AiProviderConfig[];
  interactionPreview: PreviewResult | null;
  selectedPersona: PersonaItem | null;
  applyRoutePrimaryModel: () => void;
  runInteractionPreview: () => Promise<void>;
  routePrimaryModelLabel: () => string;
}

export function PersonaInteractionSection({
  interactionInput,
  setInteractionInput,
  personas,
  textModels,
  providers,
  interactionPreview,
  selectedPersona,
  applyRoutePrimaryModel,
  runInteractionPreview,
  routePrimaryModelLabel,
}: PersonaInteractionSectionProps) {
  return (
    <div className="space-y-6">
      <SectionCard title="Interaction Preview" icon={<MessageSquare className="h-4 w-4" />}>
        <div className="space-y-6">
          <div className="bg-base-200/50 flex items-center gap-2 rounded-lg p-3 text-xs">
            <Route className="text-primary h-4 w-4 opacity-50" />
            <span>
              Effective route primary for <strong>{interactionInput.taskType}</strong>:
            </span>
            <span className="badge badge-sm badge-ghost border-base-300 font-mono">
              {routePrimaryModelLabel()}
            </span>
          </div>

          <div className="space-y-6">
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold opacity-70">Target Persona</span>
              </label>
              <PersonaSelector
                value={interactionInput.personaId}
                initialOptions={personas.map((p) => ({
                  id: p.id,
                  username: p.username,
                  display_name: p.display_name,
                  avatar_url: p.avatar_url,
                }))}
                onChange={(personaId) => setInteractionInput((prev) => ({ ...prev, personaId }))}
                placeholder="Search persona..."
              />
            </div>
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold opacity-70">Model Override</span>
              </label>
              <select
                className="select select-bordered select-sm focus:select-primary w-full"
                value={interactionInput.modelId}
                onChange={(e) =>
                  setInteractionInput((prev) => ({ ...prev, modelId: e.target.value }))
                }
              >
                <option value="">Select model</option>
                {textModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {optionLabelForModel(model, providers)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold opacity-70">Task Category</span>
              </label>
              <select
                className="select select-bordered select-sm focus:select-primary w-full"
                value={interactionInput.taskType}
                onChange={(e) =>
                  setInteractionInput((prev) => ({
                    ...prev,
                    taskType: e.target.value as "post" | "comment",
                  }))
                }
              >
                <option value="post">Post Generation</option>
                <option value="comment">Comment Response</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn btn-outline btn-sm gap-2" onClick={applyRoutePrimaryModel}>
                <Route className="h-4 w-4" />
                Apply Route
              </button>
              <button
                className="btn btn-primary btn-sm gap-2 shadow-sm"
                onClick={() => void runInteractionPreview()}
              >
                <Eye className="h-4 w-4" />
                Run Preview
              </button>
            </div>
          </div>

          {selectedPersona && (
            <div className="bg-primary/5 border-primary/10 flex items-center gap-3 rounded-lg border p-3 text-xs">
              <Bot className="text-primary h-4 w-4" />
              <div className="flex flex-col">
                <span className="text-base-content font-bold">{selectedPersona.display_name}</span>
                <span className="font-mono opacity-50">@{selectedPersona.username}</span>
              </div>
            </div>
          )}

          <div className="space-y-5">
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold opacity-70">
                  Task Context / Content
                </span>
              </label>
              <textarea
                className="textarea textarea-bordered focus:textarea-primary h-28 w-full font-mono text-sm leading-relaxed"
                value={interactionInput.taskContext}
                onChange={(e) =>
                  setInteractionInput((prev) => ({ ...prev, taskContext: e.target.value }))
                }
                placeholder="Paste post/comment content to test response assembly..."
              />
            </div>

            <div className="space-y-6">
              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold opacity-70">
                    Soul State Override (JSON)
                  </span>
                </label>
                <textarea
                  className="textarea textarea-bordered focus:textarea-primary h-40 w-full font-mono text-sm leading-relaxed"
                  value={interactionInput.soulOverrideJson}
                  onChange={(e) =>
                    setInteractionInput((prev) => ({ ...prev, soulOverrideJson: e.target.value }))
                  }
                  placeholder='{ "instruction_override": "Be more aggressive..." }'
                />
              </div>
              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold opacity-70">
                    Long Memory Context Override
                  </span>
                </label>
                <textarea
                  className="textarea textarea-bordered focus:textarea-primary h-40 w-full text-sm leading-relaxed"
                  value={interactionInput.longMemoryOverride}
                  onChange={(e) =>
                    setInteractionInput((prev) => ({
                      ...prev,
                      longMemoryOverride: e.target.value,
                    }))
                  }
                  placeholder="Mock long-term memory retrieval context…"
                />
              </div>
            </div>
          </div>

          <PreviewPanel
            preview={interactionPreview}
            emptyLabel="Run persona interaction preview to inspect prompt assembly and render output."
          />
        </div>
      </SectionCard>
    </div>
  );
}
