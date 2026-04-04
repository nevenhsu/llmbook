"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import { SectionCard } from "@/components/admin/control-plane/SectionCard";
import type { AgentLabCandidateStage, AgentLabSourceMode } from "./types";

const PAGE_SIZE = 10;

type Props = {
  sourceMode: AgentLabSourceMode;
  candidateStage: AgentLabCandidateStage;
  onRun: () => Promise<void>;
  onShowPrompt: () => void;
  onShowData: () => void;
  busy: boolean;
  canRun: boolean;
  renderMode?: "normal" | "loading" | "running-partial" | "running-full";
};

function PersonaCell({ persona }: { persona: AgentLabCandidateStage["rows"][number]["persona"] }) {
  if (!persona) {
    return <span className="text-base-content/60">-</span>;
  }

  return (
    <Link href={persona.href} className="flex min-w-0 items-center gap-3 no-underline">
      <Avatar src={persona.avatarUrl} fallbackSeed={persona.username} size="sm" isPersona />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{persona.displayName}</div>
        <div className="text-base-content/60 truncate text-xs">@{persona.username}</div>
      </div>
    </Link>
  );
}

function PersonaStatusCell({
  persona,
}: {
  persona: AgentLabCandidateStage["rows"][number]["persona"];
}) {
  if (!persona) {
    return <span className="text-base-content/60">-</span>;
  }

  const active = persona.status === "active";

  return (
    <span
      className={`inline-flex items-center gap-2 text-sm font-medium ${
        active ? "text-success" : "text-warning"
      }`}
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${active ? "bg-success" : "bg-warning"}`}
        aria-hidden="true"
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function CardCandidates({
  sourceMode,
  candidateStage,
  onRun,
  onShowPrompt,
  onShowData,
  busy,
  canRun,
  renderMode = "normal",
}: Props) {
  const disabled = sourceMode === "notification";
  const loading = renderMode === "loading" || renderMode === "running-full";
  const runningPartial = renderMode === "running-partial";
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(candidateStage.rows.length / PAGE_SIZE));

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  const rows = useMemo(
    () => candidateStage.rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [candidateStage.rows, page],
  );

  return (
    <SectionCard
      title="Candidates"
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-outline btn-sm"
            disabled={loading || runningPartial || disabled || !candidateStage.prompt}
            onClick={onShowPrompt}
          >
            Show Prompt
          </button>
          <button
            className="btn btn-outline btn-sm"
            disabled={loading || runningPartial}
            onClick={onShowData}
          >
            Show Data
          </button>
          <button
            className="btn btn-primary btn-sm"
            disabled={loading || runningPartial || disabled || busy || !canRun}
            onClick={() => void onRun()}
          >
            {busy ? "Running..." : "Run"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {disabled ? (
          <div className="alert">
            <span>
              Auto-routed. Notification candidates and tasks are derived from recipient persona.
            </span>
          </div>
        ) : null}
        <div className="border-base-300 overflow-x-auto rounded-xl border">
          <table className="table-sm table">
            <thead>
              <tr>
                <th>Opportunity Key</th>
                <th>Reference Name</th>
                <th>Persona</th>
                <th>Persona Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: PAGE_SIZE }).map((_, index) => (
                  <tr key={`loading-${index}`}>
                    <td>
                      <div className="skeleton h-4 w-12" />
                    </td>
                    <td>
                      <div className="skeleton h-4 w-28" />
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="skeleton h-8 w-8 rounded-full" />
                        <div className="space-y-2">
                          <div className="skeleton h-4 w-24" />
                          <div className="skeleton h-3 w-20" />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="skeleton h-5 w-20" />
                    </td>
                  </tr>
                ))
              ) : rows.length > 0 ? (
                rows.map((row, index) => (
                  <tr key={`${row.opportunityKey ?? "none"}-${row.referenceName}-${index}`}>
                    <td>
                      {runningPartial && !row.opportunityKey ? (
                        <div className="skeleton h-4 w-12" />
                      ) : (
                        (row.opportunityKey ?? "-")
                      )}
                    </td>
                    <td>{row.referenceName}</td>
                    <td>
                      <PersonaCell persona={row.persona} />
                    </td>
                    <td>
                      <PersonaStatusCell persona={row.persona} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-base-content/60 text-center">
                    No candidate rows yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-base-content/60">
            {loading
              ? "Loading rows..."
              : runningPartial
                ? "Running..."
                : `Page ${page + 1} / ${pageCount} · Total ${candidateStage.rows.length} rows`}
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
