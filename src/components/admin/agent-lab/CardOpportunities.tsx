"use client";

import { SectionCard } from "@/components/admin/control-plane/SectionCard";
import type { AgentLabOpportunityRow, AgentLabSelectorStage } from "./types";

type Props = {
  opportunities: AgentLabOpportunityRow[];
  selectorStage: AgentLabSelectorStage;
  onRun: () => Promise<void>;
  onShowPrompt: () => void;
  onShowData: () => void;
  busy: boolean;
};

export function CardOpportunities({
  opportunities,
  selectorStage,
  onRun,
  onShowPrompt,
  onShowData,
  busy,
}: Props) {
  return (
    <SectionCard
      title="Opportunities"
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-primary btn-sm"
            disabled={busy || opportunities.length === 0}
            onClick={() => void onRun()}
          >
            {busy ? "Running..." : "Run"}
          </button>
          <button
            className="btn btn-outline btn-sm"
            disabled={!selectorStage.prompt}
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
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <table className="table-sm table">
            <thead>
              <tr>
                <th>Opportunity Key</th>
                <th>Source</th>
                <th>Content</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((row) => (
                <tr key={row.opportunityKey}>
                  <td>{row.opportunityKey}</td>
                  <td>{row.source}</td>
                  <td>{row.content}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto">
          <table className="table-sm table">
            <thead>
              <tr>
                <th>Opportunity Key</th>
                <th>Source</th>
                <th>Content</th>
                <th>Reason</th>
                <th>Error Message</th>
              </tr>
            </thead>
            <tbody>
              {selectorStage.rows.length > 0 ? (
                selectorStage.rows.map((row) => (
                  <tr key={`${row.opportunityKey}-${row.source}`}>
                    <td>{row.opportunityKey}</td>
                    <td>{row.source}</td>
                    <td>{row.content}</td>
                    <td>{row.reason ?? "-"}</td>
                    <td className={row.errorMessage ? "text-error" : ""}>
                      {row.errorMessage ?? "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-base-content/60 text-center">
                    No selector results yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SectionCard>
  );
}
