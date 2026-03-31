"use client";

import { SectionCard } from "@/components/admin/control-plane/SectionCard";
import type { AgentLabCandidateStage, AgentLabSourceMode } from "./types";

type Props = {
  sourceMode: AgentLabSourceMode;
  candidateStage: AgentLabCandidateStage;
  onRun: () => Promise<void>;
  onShowPrompt: () => void;
  onShowData: () => void;
  busy: boolean;
  canRun: boolean;
};

export function CardCandidates({
  sourceMode,
  candidateStage,
  onRun,
  onShowPrompt,
  onShowData,
  busy,
  canRun,
}: Props) {
  const disabled = sourceMode === "notification";

  return (
    <SectionCard
      title="Candidates"
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-primary btn-sm"
            disabled={disabled || busy || !canRun}
            onClick={() => void onRun()}
          >
            {busy ? "Running..." : "Run"}
          </button>
          <button
            className="btn btn-outline btn-sm"
            disabled={disabled || !candidateStage.prompt}
            onClick={onShowPrompt}
          >
            Show Prompt
          </button>
          <button className="btn btn-outline btn-sm" onClick={onShowData}>
            Show Data
          </button>
        </div>
      }
    >
      {disabled ? (
        <div className="alert">
          <span>Auto-routed. Notification tasks are already bound to a target persona.</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="table-sm table">
              <thead>
                <tr>
                  <th>Reference Name</th>
                  <th>Persona</th>
                </tr>
              </thead>
              <tbody>
                {candidateStage.selectedReferences.length > 0 ? (
                  candidateStage.selectedReferences.map((row) => (
                    <tr key={`${row.referenceName}-${row.personaId ?? "none"}`}>
                      <td>{row.referenceName}</td>
                      <td>{row.personaDisplayName ?? "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="text-base-content/60 text-center">
                      No selected references yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto">
            <table className="table-sm table">
              <thead>
                <tr>
                  <th>Opportunity Key</th>
                  <th>Reference Name</th>
                  <th>Target Persona</th>
                  <th>Dispatch Kind</th>
                  <th>Reason</th>
                  <th>Dedupe Key</th>
                  <th>Error Message</th>
                </tr>
              </thead>
              <tbody>
                {candidateStage.rows.length > 0 ? (
                  candidateStage.rows.map((row) => (
                    <tr key={`${row.opportunityKey}-${row.dedupeKey}`}>
                      <td>{row.opportunityKey}</td>
                      <td>{row.referenceName}</td>
                      <td>{row.targetPersona.displayName}</td>
                      <td>{row.dispatchKind}</td>
                      <td>{row.reason}</td>
                      <td>{row.dedupeKey}</td>
                      <td className={row.errorMessage ? "text-error" : ""}>
                        {row.errorMessage ?? "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-base-content/60 text-center">
                      No candidate results yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
