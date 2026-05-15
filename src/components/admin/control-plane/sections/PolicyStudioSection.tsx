import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { FileText, Layers, Eye, RotateCcw, Trash2, Upload } from "lucide-react";
import type { PolicyReleaseListItem } from "@/lib/ai/admin/control-plane-store";
import type { DraftState } from "@/lib/ai/admin/control-plane-types";
import { SectionCard } from "../SectionCard";
import ConfirmModal from "@/components/ui/ConfirmModal";

export interface PolicyStudioSectionProps {
  draft: DraftState;
  setDraft: Dispatch<SetStateAction<DraftState>>;
  activeReleaseVersion: number | null;
  releases: PolicyReleaseListItem[];
  viewPolicyVersion: (version: number) => void;
  updatePolicy: () => Promise<void>;
  publishPolicy: () => Promise<void>;
  rollbackRelease: (version: number) => Promise<void>;
  deletePolicyRelease: (version: number) => Promise<void>;
}

export function PolicyStudioSection({
  draft,
  setDraft,
  activeReleaseVersion,
  releases,
  viewPolicyVersion,
  updatePolicy,
  publishPolicy,
  rollbackRelease,
  deletePolicyRelease,
}: PolicyStudioSectionProps) {
  const [page, setPage] = useState(1);
  const [rollbackTarget, setRollbackTarget] = useState<PolicyReleaseListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PolicyReleaseListItem | null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);

  const sortedReleases = useMemo(
    () => [...releases].sort((a, b) => b.version - a.version),
    [releases],
  );
  const perPage = 5;
  const totalPages = Math.max(1, Math.ceil(sortedReleases.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sortedReleases.slice((currentPage - 1) * perPage, currentPage * perPage);
  const nextReleaseVersion = (sortedReleases[0]?.version ?? 0) + 1;

  const selectedRelease = useMemo(
    () => releases.find((item) => item.version === draft.selectedVersion) ?? null,
    [releases, draft.selectedVersion],
  );

  return (
    <div className="space-y-6">
      <SectionCard title="Releases" icon={<Layers className="h-4 w-4" />}>
        <div className="space-y-4">
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
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center opacity-50">
                      No policy releases yet
                    </td>
                  </tr>
                ) : (
                  pageItems.map((item) => {
                    const isCurrent = item.isActive;
                    return (
                      <tr key={item.version} className="hover:bg-base-200/40">
                        <td className="font-mono font-medium">v{item.version}</td>
                        <td>
                          {item.isActive ? (
                            <span className="badge badge-success badge-sm">active</span>
                          ) : (
                            <span className="badge badge-ghost badge-sm">inactive</span>
                          )}
                        </td>
                        <td className="text-[11px] opacity-70">
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              className="btn btn-xs btn-ghost gap-1"
                              onClick={() => viewPolicyVersion(item.version)}
                              title="View"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </button>
                            <button
                              className="btn btn-xs btn-ghost gap-1"
                              disabled={isCurrent}
                              onClick={() => setRollbackTarget(item)}
                              title="Rollback"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Rollback
                            </button>
                            <button
                              className={`btn btn-xs gap-1 ${isCurrent ? "btn-disabled btn-ghost" : "btn-ghost text-error"}`}
                              disabled={isCurrent}
                              onClick={() => setDeleteTarget(item)}
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs opacity-70">
              {sortedReleases.length === 0
                ? "0 releases"
                : `${(currentPage - 1) * perPage + 1}-${Math.min(
                    currentPage * perPage,
                    sortedReleases.length,
                  )} of ${sortedReleases.length}`}
            </div>
            <div className="join">
              <button
                className="btn btn-sm join-item"
                disabled={currentPage <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Prev
              </button>
              <button className="btn btn-sm join-item pointer-events-none">
                {currentPage}/{totalPages}
              </button>
              <button
                className="btn btn-sm join-item"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Policy Draft" icon={<FileText className="h-4 w-4" />}>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs opacity-70">
              Selected: <span className="font-semibold">v{draft.selectedVersion}</span>
              {activeReleaseVersion ? (
                <span className="ml-1">
                  ({draft.selectedVersion === activeReleaseVersion ? "active" : "inactive"})
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="btn btn-neutral btn-sm"
                disabled={!selectedRelease}
                onClick={() => setPublishModalOpen(true)}
              >
                Publish
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => void updatePolicy()}>
                <Upload className="h-4 w-4" />
                Update
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold opacity-70">System Baseline</span>
              </label>
              <textarea
                className="textarea textarea-bordered focus:textarea-primary h-28 w-full text-sm leading-relaxed"
                value={draft.systemBaseline}
                onChange={(e) => setDraft((prev) => ({ ...prev, systemBaseline: e.target.value }))}
                placeholder="Define the primary objective of the AI system…"
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
                <span className="label-text text-xs font-semibold opacity-70">Output Style</span>
              </label>
              <textarea
                className="textarea textarea-bordered focus:textarea-primary h-40 w-full text-sm leading-relaxed"
                value={draft.styleGuide}
                onChange={(e) => setDraft((prev) => ({ ...prev, styleGuide: e.target.value }))}
                placeholder="Tone, structure, and length guidance for post/comment output…"
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
        </div>
      </SectionCard>

      <ConfirmModal
        isOpen={Boolean(rollbackTarget)}
        onClose={() => setRollbackTarget(null)}
        onConfirm={() => {
          if (!rollbackTarget) {
            return;
          }
          setRollbackLoading(true);
          void rollbackRelease(rollbackTarget.version)
            .then(() => setRollbackTarget(null))
            .finally(() => setRollbackLoading(false));
        }}
        title="Rollback Policy Release"
        message={
          rollbackTarget
            ? `Rollback active policy to v${rollbackTarget.version}?`
            : "Rollback policy release?"
        }
        confirmText="Rollback"
        variant="warning"
        isLoading={rollbackLoading}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) {
            return;
          }
          setDeleteLoading(true);
          void deletePolicyRelease(deleteTarget.version)
            .then(() => setDeleteTarget(null))
            .finally(() => setDeleteLoading(false));
        }}
        title="Delete Policy Release"
        message={deleteTarget ? `Delete old policy v${deleteTarget.version}?` : "Delete policy?"}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteLoading}
      />

      <ConfirmModal
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        onConfirm={() => {
          setPublishLoading(true);
          void publishPolicy()
            .then(() => setPublishModalOpen(false))
            .finally(() => setPublishLoading(false));
        }}
        title="Publish Policy"
        message={`Publish draft as active v${nextReleaseVersion}?`}
        confirmText="Publish"
        variant="primary"
        isLoading={publishLoading}
        confirmDisabled={!selectedRelease}
      />
    </div>
  );
}
