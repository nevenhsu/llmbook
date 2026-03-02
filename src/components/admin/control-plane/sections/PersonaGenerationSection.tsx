import type { Dispatch, SetStateAction } from "react";
import { UserPlus, Sparkles, Save, Bot } from "lucide-react";
import type {
  AiModelConfig,
  AiProviderConfig,
  PreviewResult,
  PersonaGenerationStructured,
} from "@/lib/ai/admin/control-plane-store";
import { SectionCard } from "../SectionCard";
import { PreviewPanel } from "../PreviewPanel";
import { optionLabelForModel, derivePersonaUsername } from "../control-plane-utils";

export interface PersonaGenerationSectionProps {
  personaGeneration: {
    modelId: string;
    extraPrompt: string;
  };
  setPersonaGeneration: Dispatch<
    SetStateAction<{
      modelId: string;
      extraPrompt: string;
    }>
  >;
  personaGenerationModels: AiModelConfig[];
  providers: AiProviderConfig[];
  personaGenerationLoading: boolean;
  personaPreviewRunCount: number;
  personaLastSavedAt: string | null;
  personaSaveForm: {
    displayName: string;
    username: string;
  };
  setPersonaSaveForm: Dispatch<
    SetStateAction<{
      displayName: string;
      username: string;
    }>
  >;
  personaSaveLoading: boolean;
  personaGenerationPreview: (PreviewResult & { structured: PersonaGenerationStructured }) | null;
  personaStepStatus: {
    generated: boolean;
    saved: boolean;
  };
  runPersonaGenerationPreview: () => Promise<void>;
  savePersonaFromGeneration: () => Promise<void>;
}

export function PersonaGenerationSection({
  personaGeneration,
  setPersonaGeneration,
  personaGenerationModels,
  providers,
  personaGenerationLoading,
  personaPreviewRunCount,
  personaLastSavedAt,
  personaSaveForm,
  setPersonaSaveForm,
  personaSaveLoading,
  personaGenerationPreview,
  personaStepStatus,
  runPersonaGenerationPreview,
  savePersonaFromGeneration,
}: PersonaGenerationSectionProps) {
  return (
    <>
      <div className="space-y-6">
        <SectionCard title="Generate Persona" icon={<UserPlus className="h-4 w-4" />}>
          <div className="space-y-6">
            <p className="max-w-2xl text-sm leading-relaxed opacity-60">
              Automate persona creation in three steps: choose model and prompt context, generate
              the content preview, then review and save to the database.
            </p>

            {/* Step indicator */}
            <div className="flex items-center gap-2 py-2">
              <div className="flex items-center gap-2">
                <span className="badge badge-primary badge-sm font-bold">1</span>
                <span className="text-[11px] font-semibold tracking-wider uppercase opacity-60">
                  Configure
                </span>
              </div>
              <div className="bg-base-300/50 h-[2px] flex-1" />
              <div className="flex items-center gap-2">
                <span
                  className={`badge badge-sm font-bold ${personaStepStatus.generated ? "badge-success" : "badge-ghost"}`}
                >
                  2
                </span>
                <span
                  className={`text-[11px] font-semibold tracking-wider uppercase ${personaStepStatus.generated ? "text-success" : "opacity-60"}`}
                >
                  {personaStepStatus.generated ? "Generated ✓" : "Generate"}
                </span>
              </div>
              <div className="bg-base-300/50 h-[2px] flex-1" />
              <div className="flex items-center gap-2">
                <span
                  className={`badge badge-sm font-bold ${personaStepStatus.saved ? "badge-success" : "badge-ghost"}`}
                >
                  3
                </span>
                <span
                  className={`text-[11px] font-semibold tracking-wider uppercase ${personaStepStatus.saved ? "text-success" : "opacity-60"}`}
                >
                  {personaStepStatus.saved ? "Saved ✓" : "Save"}
                </span>
              </div>
            </div>

            <div className="space-y-5">
              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold opacity-70">
                    Model Selection
                  </span>
                </label>
                <select
                  className="select select-bordered select-sm focus:select-primary w-full"
                  value={personaGeneration.modelId}
                  onChange={(e) =>
                    setPersonaGeneration((prev) => ({ ...prev, modelId: e.target.value }))
                  }
                >
                  <option value="">Select model (key required)</option>
                  {personaGenerationModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {optionLabelForModel(model, providers)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold opacity-70">
                    Context / Extra Prompt
                  </span>
                </label>
                <input
                  className="input input-bordered input-sm focus:input-primary w-full"
                  value={personaGeneration.extraPrompt}
                  onChange={(e) =>
                    setPersonaGeneration((prev) => ({ ...prev, extraPrompt: e.target.value }))
                  }
                  placeholder="Specific background context or guidelines for this persona..."
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  className="btn btn-primary btn-sm gap-2 shadow-sm"
                  disabled={personaGenerationLoading}
                  onClick={() => void runPersonaGenerationPreview()}
                >
                  <Sparkles className="h-4 w-4" />
                  {personaGenerationLoading
                    ? "Generating…"
                    : personaPreviewRunCount > 0
                      ? "Regenerate Content"
                      : "Generate Persona"}
                </button>
              </div>
            </div>

            {personaGenerationModels.length === 0 && (
              <div className="alert alert-warning text-sm shadow-sm">
                <div className="flex gap-2">
                  <Bot className="h-5 w-5" />
                  <span>
                    No eligible model. Add API key to provider and enable at least one
                    text_generation model.
                  </span>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {personaGenerationPreview ? (
          <SectionCard
            title="Save Persona"
            icon={<Save className="h-4 w-4" />}
            actions={
              <div className="flex items-center gap-3 text-[10px] font-bold tracking-widest uppercase opacity-50">
                <span>Runs: {personaPreviewRunCount}</span>
                {personaLastSavedAt && (
                  <span>Last saved: {new Date(personaLastSavedAt).toLocaleTimeString()}</span>
                )}
              </div>
            }
          >
            <div className="space-y-6">
              <div className="space-y-5">
                <div className="form-control w-full">
                  <label className="label py-1">
                    <span className="label-text text-xs font-semibold opacity-70">
                      Display Name
                    </span>
                  </label>
                  <input
                    className="input input-bordered input-sm focus:input-primary w-full"
                    value={personaSaveForm.displayName}
                    onChange={(e) => {
                      const displayName = e.target.value;
                      setPersonaSaveForm({
                        displayName,
                        username: derivePersonaUsername(displayName),
                      });
                    }}
                    placeholder="e.g. Satoshi Nakamoto"
                  />
                </div>
                <div className="form-control w-full">
                  <label className="label py-1">
                    <span className="label-text text-xs font-semibold opacity-70">
                      Username (automatically prefixed with <span className="font-mono">ai_</span>)
                    </span>
                  </label>
                  <input
                    className="input input-bordered input-sm focus:input-primary w-full"
                    value={personaSaveForm.username}
                    onChange={(e) =>
                      setPersonaSaveForm((prev) => ({
                        ...prev,
                        username: derivePersonaUsername(e.target.value),
                      }))
                    }
                    placeholder="e.g. satoshi"
                  />
                </div>
              </div>
              <div className="border-base-300 flex justify-end border-t pt-5">
                <button
                  className="btn btn-primary btn-sm gap-2 shadow-sm"
                  disabled={personaSaveLoading}
                  onClick={() => void savePersonaFromGeneration()}
                >
                  <Save className="h-4 w-4" />
                  {personaSaveLoading ? "Saving to Database…" : "Save Final Persona"}
                </button>
              </div>
              <PreviewPanel preview={personaGenerationPreview} emptyLabel="Run preview first" />
            </div>
          </SectionCard>
        ) : (
          <PreviewPanel
            preview={null}
            emptyLabel="Generate content preview to finalize the persona."
          />
        )}
      </div>
    </>
  );
}
