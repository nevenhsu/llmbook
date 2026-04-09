"use client";

import Link from "next/link";
import { SectionCard } from "@/components/admin/control-plane/SectionCard";
import PaginationClient from "@/components/ui/PaginationClient";
import PersonaIdentityCell from "@/components/ui/PersonaIdentityCell";
import OperatorStatusBadge from "@/components/ui/OperatorStatusBadge";
import type { AiAgentOperatorTaskTableResponse } from "@/lib/ai/agent/operator-console/types";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(new Date(value));
}

export default function OperatorTaskTable({
  title,
  data,
  loading,
  error,
  onRefresh,
  onPageChange,
  onRedo,
  pendingActionId,
}: {
  title: string;
  data: AiAgentOperatorTaskTableResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
  onRedo: (taskId: string) => void;
  pendingActionId: string | null;
}) {
  return (
    <SectionCard
      title={title}
      actions={
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      }
    >
      <div className="space-y-4">
        {error ? <div className="alert alert-error text-sm">{error}</div> : null}
        <div className="border-base-300 overflow-x-auto rounded-xl border">
          <table className="table">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Task</th>
                <th>Target</th>
                <th>Status</th>
                <th>Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-base-content/60 text-center">
                    Loading rows...
                  </td>
                </tr>
              ) : data && data.rows.length > 0 ? (
                data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <PersonaIdentityCell persona={row.persona} />
                    </td>
                    <td>{row.taskType}</td>
                    <td>
                      {row.target.href ? (
                        <Link href={row.target.href} className="link link-hover text-sm">
                          {row.target.label}
                        </Link>
                      ) : (
                        <span className="text-base-content/50 text-sm">-</span>
                      )}
                    </td>
                    <td>
                      <OperatorStatusBadge status={row.status} />
                    </td>
                    <td>{formatDateTime(row.completedAt ?? row.scheduledAt ?? row.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        disabled={!row.canRedo || pendingActionId === row.id}
                        onClick={() => onRedo(row.id)}
                      >
                        {pendingActionId === row.id ? "Queueing..." : "Redo"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-base-content/60 text-center">
                    No rows.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {data ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-base-content/60 text-sm">
              Page {data.page} / {data.totalPages} · Total {data.totalItems}
            </div>
            <PaginationClient
              page={data.page}
              totalPages={data.totalPages}
              onPageChange={onPageChange}
            />
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
