"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SectionCard } from "@/components/admin/control-plane/SectionCard";
import type { AgentLabOpportunityRow, AgentLabSelectorStage } from "./types";

const PAGE_SIZE = 10;

type Props = {
  opportunities: AgentLabOpportunityRow[];
  selectorStage: AgentLabSelectorStage;
  onRun: () => Promise<void>;
  onShowPrompt: () => void;
  onShowData: () => void;
  busy: boolean;
};

function SelectedStateCell({ row }: { row: AgentLabOpportunityRow }) {
  const ui =
    typeof row.probability !== "number"
      ? {
          label: "Pending",
          dotClassName: "bg-base-content/30",
          textClassName: "text-base-content/70",
        }
      : row.selected
        ? {
            label: "Selected",
            dotClassName: "bg-success",
            textClassName: "text-success",
          }
        : {
            label: "Skipped",
            dotClassName: "bg-error",
            textClassName: "text-error",
          };

  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium ${ui.textClassName}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${ui.dotClassName}`} aria-hidden="true" />
      {ui.label}
    </span>
  );
}

export function CardOpportunities({
  opportunities,
  selectorStage,
  onRun,
  onShowPrompt,
  onShowData,
  busy,
}: Props) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(opportunities.length / PAGE_SIZE));

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  const rows = useMemo(
    () => opportunities.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [opportunities, page],
  );

  return (
    <SectionCard
      title="Opportunities"
      actions={
        <div className="flex flex-wrap gap-2">
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
          <button
            className="btn btn-primary btn-sm"
            disabled={busy || opportunities.length === 0}
            onClick={() => void onRun()}
          >
            {busy ? "Running..." : "Run"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="border-base-300 overflow-x-auto rounded-xl border">
          <table className="table-sm table">
            <thead>
              <tr>
                <th>Opportunity Key</th>
                <th>Source</th>
                <th>Content</th>
                <th>Probability</th>
                <th>Selected</th>
                <th>Source Link</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.opportunityKey}>
                    <td>{row.opportunityKey}</td>
                    <td>{row.source}</td>
                    <td>{row.content}</td>
                    <td>
                      {typeof row.probability === "number" ? row.probability.toFixed(2) : "-"}
                    </td>
                    <td>
                      <SelectedStateCell row={row} />
                    </td>
                    <td>
                      {row.link ? (
                        <Link href={row.link} className="link link-primary">
                          Open
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-base-content/60 text-center">
                    No opportunities available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-base-content/60">
            Page {page + 1} / {pageCount} · Total {opportunities.length} rows
          </span>
          <div className="flex gap-2">
            <button
              className="btn btn-outline btn-xs"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Prev
            </button>
            <button
              className="btn btn-outline btn-xs"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
