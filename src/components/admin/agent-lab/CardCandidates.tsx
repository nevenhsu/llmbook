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
}: Props) {
  const disabled = sourceMode === "notification";
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
              {rows.length > 0 ? (
                rows.map((row, index) => (
                  <tr key={`${row.opportunityKey ?? "none"}-${row.referenceName}-${index}`}>
                    <td>{row.opportunityKey ?? "-"}</td>
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
            Page {page + 1} / {pageCount}
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
