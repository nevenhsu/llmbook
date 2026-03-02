import type { Dispatch, SetStateAction } from "react";
import { FileText, Upload, Layers, Sparkles, Undo2, Eye } from "lucide-react";
import type {
  AiModelConfig,
  AiProviderConfig,
  PolicyReleaseListItem,
  PreviewResult,
} from "@/lib/ai/admin/control-plane-store";
import type { DraftState } from "@/lib/ai/admin/control-plane-types";
import { SectionCard } from "../SectionCard";
import { PreviewPanel } from "../PreviewPanel";
import { optionLabelForModel } from "../control-plane-utils";

export interface PolicyStudioSectionProps {
  draft: DraftState;
  setDraft: Dispatch<SetStateAction<DraftState>>;
  releases: PolicyReleaseListItem[];
  policyPreviewInput: {
    releaseId: string;
    modelId: string;
    taskContext: string;
  };
  setPolicyPreviewInput: Dispatch<
    SetStateAction<{
      releaseId: string;
      modelId: string;
      taskContext: string;
    }>
  >;
  textModels: AiModelConfig[];
  providers: AiProviderConfig[];
  policyPreview: PreviewResult | null;
  createDraft: () => Promise<void>;
  publishRelease: (releaseId: number) => Promise<void>;
  rollbackRelease: (releaseId: number) => Promise<void>;
  runPolicyPreview: () => Promise<void>;
}

export function PolicyStudioSection({
  draft,
  setDraft,
  releases,
  policyPreviewInput,
  setPolicyPreviewInput,
  textModels,
  providers,
  policyPreview,
  createDraft,
  publishRelease,
  rollbackRelease,
  runPolicyPreview,
}: PolicyStudioSectionProps) {
  return (
    <div className="space-y-6">
      <SectionCard title="Policy Draft" icon={<FileText className="h-4 w-4" />}>
        <div className="space-y-6">
          <div className="space-y-6">
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold opacity-70">Core Goal</span>
              </label>
              <textarea
                className="textarea textarea-bordered focus:textarea-primary h-28 w-full text-sm leading-relaxed"
                value={draft.coreGoal}
                onChange={(e) => setDraft((prev) => ({ ...prev, coreGoal: e.target.value }))}
                placeholder="Define the primary objective of the AI system…"
              />
            </div>
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold opacity-70">Style Guide</span>
              </label>
              <textarea
                className="textarea textarea-bordered focus:textarea-primary h-28 w-full text-sm leading-relaxed"
                value={draft.styleGuide}
                onChange={(e) => setDraft((prev) => ({ ...prev, styleGuide: e.target.value }))}
                placeholder="Tone, voice, formatting conventions…"
              />
            </div>
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold opacity-70">Global Policy</span>
              </label>
              <textarea
                className="textarea textarea-bordered focus:textarea-primary h-48 w-full text-sm leading-relaxed"
                value={draft.globalPolicy}
                onChange={(e) => setDraft((prev) => ({ ...prev, globalPolicy: e.target.value }))}
                placeholder="Content rules, behavioral guidelines…"
              />
            </div>
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold opacity-70">Forbidden Rules</span>
              </label>
              <textarea
                className="textarea textarea-bordered focus:textarea-primary h-28 w-full text-sm leading-relaxed"
                value={draft.forbiddenRules}
                onChange={(e) => setDraft((prev) => ({ ...prev, forbiddenRules: e.target.value }))}
                placeholder="Explicit prohibitions…"
              />
            </div>
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold opacity-70">Release Note</span>
              </label>
              <textarea
                className="textarea textarea-bordered focus:textarea-primary h-28 w-full text-sm leading-relaxed"
                value={draft.note}
                onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="What changed in this draft…"
              />
            </div>
          </div>
          <div className="border-base-300 mt-6 flex justify-end border-t pt-5">
            <button
              className="btn btn-primary btn-sm gap-2 shadow-sm"
              onClick={() => void createDraft()}
            >
              <Upload className="h-4 w-4" />
              Create New Draft Release
            </button>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <SectionCard title="Releases" icon={<Layers className="h-4 w-4" />}>
          <div className="overflow-x-auto">
            <table className="table-sm table w-full">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-base-200 divide-y">
                {releases.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center opacity-50">
                      No policy releases yet
                    </td>
                  </tr>
                ) : (
                  releases.map((item) => (
                    <tr key={item.version} className="hover:bg-base-200/40">
                      <td className="font-mono font-medium">v{item.version}</td>
                      <td>
                        {item.isActive ? (
                          <span className="badge badge-success badge-sm gap-1">
                            <Sparkles className="h-3 w-3" />
                            published
                          </span>
                        ) : (
                          <span className="badge badge-ghost badge-sm">draft</span>
                        )}
                      </td>
                      <td className="text-[11px] opacity-70">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {!item.isActive && (
                            <button
                              className="btn btn-xs btn-primary gap-1"
                              onClick={() => void publishRelease(item.version)}
                              title="Publish this release"
                            >
                              <Upload className="h-3 w-3" />
                              Publish
                            </button>
                          )}
                          <button
                            className="btn btn-xs btn-outline gap-1"
                            onClick={() => void rollbackRelease(item.version)}
                            title="Rollback to this version"
                          >
                            <Undo2 className="h-3 w-3" />
                            Rollback
                          </button>
                          <button
                            className="btn btn-xs btn-ghost gap-1"
                            onClick={() =>
                              setPolicyPreviewInput((prev) => ({
                                ...prev,
                                releaseId: String(item.version),
                              }))
                            }
                            title="View description"
                          >
                            <Eye className="h-3 w-3" />
                            Preview
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Manual Preview" icon={<Eye className="h-4 w-4" />}>
          <div className="space-y-5">
            <div className="form-control w-full">
              <label className="label py-0.5">
                <span className="label-text text-xs font-semibold opacity-70">Release ID</span>
              </label>
              <input
                className="input input-bordered input-sm w-full"
                value={policyPreviewInput.releaseId}
                onChange={(e) =>
                  setPolicyPreviewInput((prev) => ({ ...prev, releaseId: e.target.value }))
                }
                placeholder="e.g. 1"
              />
            </div>
            <div className="form-control w-full">
              <label className="label py-0.5">
                <span className="label-text text-xs font-semibold opacity-70">Test Model</span>
              </label>
              <select
                className="select select-bordered select-sm w-full"
                value={policyPreviewInput.modelId}
                onChange={(e) =>
                  setPolicyPreviewInput((prev) => ({ ...prev, modelId: e.target.value }))
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
              <label className="label py-0.5">
                <span className="label-text text-xs font-semibold opacity-70">Task Context</span>
              </label>
              <textarea
                className="textarea textarea-bordered focus:textarea-primary h-28 w-full text-sm"
                value={policyPreviewInput.taskContext}
                onChange={(e) =>
                  setPolicyPreviewInput((prev) => ({
                    ...prev,
                    taskContext: e.target.value,
                  }))
                }
                placeholder="What task should the AI perform? (e.g. summarize a post...)"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                className="btn btn-primary btn-sm gap-2 shadow-sm"
                onClick={() => void runPolicyPreview()}
              >
                <Eye className="h-4 w-4" />
                Run Policy Preview
              </button>
            </div>
          </div>
        </SectionCard>
      </div>

      <PreviewPanel
        preview={policyPreview}
        emptyLabel="Run manual preview to inspect prompt assembly, markdown render, and token budget."
      />
    </div>
  );
}
