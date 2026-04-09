"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SectionCard } from "@/components/admin/control-plane/SectionCard";
import PaginationClient from "@/components/ui/PaginationClient";
import OperatorStatusBadge from "@/components/ui/OperatorStatusBadge";
import PersonaIdentityCell from "@/components/ui/PersonaIdentityCell";
import { ApiError, apiFetchJson, apiPost } from "@/lib/api/fetch-json";
import type { AiAgentOperatorImageTableResponse } from "@/lib/ai/agent/operator-console/types";

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

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Request failed.";
}

export default function AiAgentImageQueuePage() {
  const [data, setData] = useState<AiAgentOperatorImageTableResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rowActionPending, setRowActionPending] = useState<string | null>(null);

  const loadImages = useCallback(
    async (nextPage = page) => {
      setLoading(true);
      setError(null);
      try {
        setData(
          await apiFetchJson<AiAgentOperatorImageTableResponse>(
            `/api/admin/ai/agent/panel/images?page=${nextPage}&pageSize=10`,
          ),
        );
      } catch (loadError) {
        setError(toErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    },
    [page],
  );

  useEffect(() => {
    void loadImages(page);
  }, [loadImages, page]);

  async function handleRerun(mediaId: string) {
    setRowActionPending(mediaId);
    setActionError(null);
    setNotice(null);
    try {
      const result = await apiPost<{ message: string }>(
        `/api/admin/ai/agent/media/jobs/${mediaId}/actions`,
        {
          action: "retry_generation",
          mode: "execute",
        },
      );
      setNotice(result.message);
      await loadImages(page);
    } catch (rerunError) {
      setActionError(toErrorMessage(rerunError));
    } finally {
      setRowActionPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-base-content/50 text-sm font-semibold tracking-[0.24em] uppercase">
            Admin
          </p>
          <h1 className="text-3xl font-semibold">AI Agent Image Queue</h1>
          <p className="text-base-content/70 max-w-3xl text-sm">
            Dedicated admin surface for the media/image queue. Generated rows can rerun directly on
            the image queue without going through jobs-runtime.
          </p>
        </div>

        <Link href="/admin/ai/agent-panel" className="btn btn-outline btn-sm">
          Back to Operator Console
        </Link>
      </div>

      {notice ? <div className="alert alert-success text-sm">{notice}</div> : null}
      {actionError ? <div className="alert alert-error text-sm">{actionError}</div> : null}

      <SectionCard
        title="Image Queue"
        actions={
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              void loadImages(page);
            }}
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
                  <th>Image URL</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-base-content/60 text-center">
                      Loading rows...
                    </td>
                  </tr>
                ) : data && data.rows.length > 0 ? (
                  data.rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <PersonaIdentityCell persona={row.persona} />
                      </td>
                      <td>
                        {row.imageUrl ? (
                          <div className="flex items-center gap-3">
                            {/* Intentional: admin preview rows may point at arbitrary remote media URLs. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={row.imageUrl}
                              alt={`Image preview for ${row.imageUrl}`}
                              className="border-base-300 h-12 w-12 rounded-lg border object-cover"
                              loading="lazy"
                            />
                            <a href={row.imageUrl} className="link link-hover text-sm break-all">
                              {row.imageUrl}
                            </a>
                          </div>
                        ) : (
                          <span className="text-base-content/50 text-sm">-</span>
                        )}
                      </td>
                      <td>
                        <OperatorStatusBadge status={row.status} />
                      </td>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          disabled={!row.canRedo || rowActionPending === row.id}
                          onClick={() => {
                            void handleRerun(row.id);
                          }}
                        >
                          {rowActionPending === row.id ? "Rerunning..." : "Rerun"}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-base-content/60 text-center">
                      No image rows.
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
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
