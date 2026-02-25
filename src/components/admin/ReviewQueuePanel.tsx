"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { ReviewQueueItem } from "@/lib/ai/review-queue/review-queue";
import type { ReviewQueueMetrics } from "@/lib/ai/observability/review-queue-metrics";
import {
  RefreshCw,
  List,
  Clock,
  Info,
  Hand,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";

type Props = {
  initialItems: ReviewQueueItem[];
  initialMetrics: ReviewQueueMetrics;
  initialPagination: {
    limit: number;
    cursor: string | null;
    hasMore: boolean;
    nextCursor: string | null;
  };
  initialWarnings?: string[];
  title?: string;
  subtitle?: string;
};

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

async function postJson<T>(url: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? "Request failed");
  }
  return data as T;
}

export default function ReviewQueuePanel({
  initialItems,
  initialMetrics,
  initialPagination,
  initialWarnings,
  title,
  subtitle,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialPagination.cursor);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [pagination, setPagination] = useState(initialPagination);
  const [isPageLoading, setIsPageLoading] = useState(false);

  const [metrics, setMetrics] = useState(initialMetrics);
  const [events, setEvents] = useState<
    Array<{
      reviewId: string;
      taskId: string;
      eventType: "ENQUEUED" | "CLAIMED" | "APPROVED" | "REJECTED" | "EXPIRED";
      reasonCode?: string;
      reviewerId?: string;
      note?: string;
      metadata?: Record<string, unknown>;
      createdAt: string;
    }>
  >([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<
    "claim" | "approve" | "reject" | "expire" | null
  >(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const shownWarningsRef = useRef(new Set<string>());

  const showWarnings = (warnings?: string[]) => {
    if (!warnings?.length) {
      return;
    }
    for (const warning of warnings) {
      if (shownWarningsRef.current.has(warning)) {
        continue;
      }
      shownWarningsRef.current.add(warning);
      toast(warning, { icon: "⚠️" });
    }
  };

  useEffect(() => {
    showWarnings(initialWarnings);
  }, [initialWarnings]);

  const fetchPage = async (targetCursor: string | null) => {
    if (isPageLoading) {
      return;
    }
    setIsPageLoading(true);
    try {
      const response = await fetch(
        `/api/admin/ai/review-queue?status=PENDING,IN_REVIEW&limit=${pagination.limit}${
          targetCursor ? `&cursor=${encodeURIComponent(targetCursor)}` : ""
        }`,
      );
      const data = (await response.json()) as {
        items?: ReviewQueueItem[];
        metrics: ReviewQueueMetrics;
        pagination?: {
          limit: number;
          cursor: string | null;
          hasMore: boolean;
          nextCursor: string | null;
        };
        warnings?: string[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data?.error ?? "Load failed");
      }
      showWarnings(data.warnings);
      setItems(data.items ?? []);
      if (data.pagination) {
        setPagination(data.pagination);
        setCursor(data.pagination.cursor);
      }
      setMetrics(data.metrics);
    } finally {
      setIsPageLoading(false);
    }
  };

  const refresh = async () => {
    await fetchPage(cursor);
  };

  const goToNextPage = async () => {
    if (!pagination.nextCursor || isPageLoading) {
      return;
    }
    try {
      await fetchPage(pagination.nextCursor);
      setCursorHistory((prev) => [...prev, cursor ?? ""]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Page load failed");
    }
  };

  const goToPreviousPage = async () => {
    if (cursorHistory.length === 0 || isPageLoading) {
      return;
    }
    const previous = cursorHistory[cursorHistory.length - 1] || null;
    try {
      await fetchPage(previous);
      setCursorHistory((prev) => prev.slice(0, -1));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Page load failed");
    }
  };

  const loadEvents = async (reviewId?: string) => {
    setIsAuditModalOpen(true);
    setIsAuditLoading(true);
    setEvents([]);
    try {
      const query = reviewId ? `?reviewId=${encodeURIComponent(reviewId)}&limit=30` : "?limit=30";
      const response = await fetch(`/api/admin/ai/review-queue/events${query}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Load events failed");
      }
      setEvents(data.events ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Load failed");
    } finally {
      setIsAuditLoading(false);
    }
  };

  const handleClaim = async (reviewId: string) => {
    setLoadingId(reviewId);
    setLoadingAction("claim");
    try {
      const previous = items.find((item) => item.id === reviewId);
      const data = await postJson<{ item: ReviewQueueItem; warnings?: string[] }>(
        "/api/admin/ai/review-queue/claim",
        { reviewId },
      );
      showWarnings(data.warnings);
      setItems((prev) => prev.map((item) => (item.id === reviewId ? data.item : item)));
      if (previous?.status === "PENDING" && data.item.status === "IN_REVIEW") {
        setMetrics((prev) => ({ ...prev, pendingCount: Math.max(0, prev.pendingCount - 1) }));
      }
      toast.success("Claimed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Claim failed");
    } finally {
      setLoadingId(null);
      setLoadingAction(null);
    }
  };

  const handleApprove = async (reviewId: string) => {
    setLoadingId(reviewId);
    setLoadingAction("approve");
    try {
      const previous = items.find((item) => item.id === reviewId);
      const data = await postJson<{ item: ReviewQueueItem; warnings?: string[] }>(
        "/api/admin/ai/review-queue/approve",
        {
          reviewId,
          reasonCode: "manual_approved",
        },
      );
      showWarnings(data.warnings);
      setItems((prev) => prev.map((item) => (item.id === reviewId ? data.item : item)));
      if (previous?.status === "PENDING") {
        setMetrics((prev) => ({ ...prev, pendingCount: Math.max(0, prev.pendingCount - 1) }));
      }
      toast.success("Approved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Approve failed");
    } finally {
      setLoadingId(null);
      setLoadingAction(null);
    }
  };

  const handleReject = async (reviewId: string) => {
    setLoadingId(reviewId);
    setLoadingAction("reject");
    try {
      const previous = items.find((item) => item.id === reviewId);
      const data = await postJson<{ item: ReviewQueueItem; warnings?: string[] }>(
        "/api/admin/ai/review-queue/reject",
        {
          reviewId,
          reasonCode: "manual_rejected",
        },
      );
      showWarnings(data.warnings);
      setItems((prev) => prev.map((item) => (item.id === reviewId ? data.item : item)));
      if (previous?.status === "PENDING") {
        setMetrics((prev) => ({ ...prev, pendingCount: Math.max(0, prev.pendingCount - 1) }));
      }
      toast.success("Rejected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reject failed");
    } finally {
      setLoadingId(null);
      setLoadingAction(null);
    }
  };

  const handleExpire = async () => {
    setLoadingId("expire");
    setLoadingAction("expire");
    try {
      const data = await postJson<{ expiredCount: number; warnings?: string[] }>(
        "/api/admin/ai/review-queue/expire",
      );
      showWarnings(data.warnings);
      const now = Date.now();
      const expiredPendingOnPage = items.filter(
        (item) => item.status === "PENDING" && new Date(item.expiresAt).getTime() <= now,
      ).length;
      setItems((prev) =>
        prev.filter((item) => {
          const active = item.status === "PENDING" || item.status === "IN_REVIEW";
          const due = new Date(item.expiresAt).getTime() <= now;
          return !(active && due);
        }),
      );
      if (expiredPendingOnPage > 0) {
        setMetrics((prev) => ({
          ...prev,
          pendingCount: Math.max(0, prev.pendingCount - expiredPendingOnPage),
        }));
      }
      toast.success(`Expired due items processed (${data.expiredCount})`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Expire failed");
    } finally {
      setLoadingId(null);
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          {title ? <h1 className="text-2xl font-bold">{title}</h1> : null}
          {subtitle ? <p className="text-sm opacity-80">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              void refresh().catch((error) => {
                toast.error(error instanceof Error ? error.message : "Refresh failed");
              });
            }}
            disabled={!!loadingId || isPageLoading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => loadEvents()}
            disabled={!!loadingId || isPageLoading}
          >
            <List className="h-4 w-4" />
            Load Audit
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleExpire}
            disabled={!!loadingId || isPageLoading}
          >
            <Clock className="h-4 w-4" />
            Expire Due
          </button>
        </div>
      </div>

      <div className="stats stats-vertical bg-base-200 sm:stats-horizontal w-full shadow">
        <div className="stat">
          <div className="stat-title">Pending</div>
          <div className="stat-value text-primary">{metrics.pendingCount}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Expired (24h)</div>
          <div className="stat-value text-warning">{metrics.expiredCount}</div>
          <div className="stat-desc">ratio {(metrics.expiredRatio * 100).toFixed(1)}%</div>
        </div>
        <div className="stat">
          <div className="stat-title">Avg Expire Wait</div>
          <div className="stat-value text-secondary text-xl">
            {metrics.avgExpiredWaitMs ? `${Math.round(metrics.avgExpiredWaitMs / 3600000)}h` : "-"}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {isPageLoading ? (
          <>
            <div className="skeleton h-52 w-full"></div>
            <div className="skeleton h-52 w-full"></div>
            <div className="skeleton h-52 w-full"></div>
          </>
        ) : items.length === 0 ? (
          <div className="alert">
            <span>No review items.</span>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="card bg-base-200 border-base-300 border">
              <div className="card-body gap-3 p-4">
                <div className="flex flex-col items-start gap-3 text-left">
                  {/* Persona Header & Status */}
                  <div className="flex w-full items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        fallbackSeed={item.personaId}
                        src={metadataString(item.metadata, "avatarUrl") ?? undefined}
                        size="md"
                        isPersona
                      />
                      <div className="flex flex-col text-left">
                        <span className="text-base font-bold">
                          {metadataString(item.metadata, "userDisplayName") ||
                            metadataString(item.metadata, "personaName") ||
                            `Persona ${item.personaId.slice(0, 4)}`}
                        </span>
                        {(metadataString(item.metadata, "userUsername") ||
                          metadataString(item.metadata, "personaUsername")) && (
                          <div className="flex items-center gap-1 text-sm opacity-60">
                            @
                            {metadataString(item.metadata, "userUsername") ||
                              metadataString(item.metadata, "personaUsername")}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                        <div
                          className={`badge badge-outline badge-sm font-mono ${
                            item.status === "APPROVED"
                              ? "badge-success"
                              : item.status === "REJECTED"
                                ? "badge-error"
                                : ""
                          }`}
                        >
                          {item.status}
                        </div>
                      </div>
                      <div className="text-xs opacity-60">
                        {new Date(item.expiresAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex w-full items-center justify-between gap-3 opacity-80">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`badge badge-outline badge-sm font-mono text-[10px] ${
                          item.riskLevel === "HIGH"
                            ? "badge-error"
                            : item.riskLevel === "GRAY"
                              ? "badge-warning"
                              : "badge-ghost"
                        }`}
                      >
                        risk: {item.riskLevel}
                      </span>
                      <span className="badge badge-ghost badge-sm font-mono text-[10px]">
                        reason: {item.enqueueReasonCode}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] opacity-70">
                      task: {item.taskId.slice(0, 8)}
                    </div>
                  </div>

                  {/* Risk Signal and Full Text Collapse */}
                  <div className="collapse-arrow bg-base-100 border-base-300 collapse w-full rounded-md border">
                    <input type="checkbox" />
                    <div className="collapse-title flex min-h-0 flex-col items-start gap-1 p-3 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <span className="text-error font-semibold">Risk signal:</span>
                        <span className="font-mono text-xs font-bold opacity-80">
                          {metadataString(item.metadata, "safetyReasonCode") ??
                            item.enqueueReasonCode}
                        </span>
                      </div>
                      {metadataString(item.metadata, "safetyReason") && (
                        <span className="mt-1 text-left text-xs opacity-80">
                          {metadataString(item.metadata, "safetyReason")}
                        </span>
                      )}
                    </div>
                    <div className="collapse-content px-4 pb-3">
                      <div className="divider my-1"></div>
                      <div className="mb-2 text-left text-xs font-semibold opacity-80">
                        Candidate reply
                      </div>
                      <div className="text-left text-sm break-words whitespace-pre-wrap opacity-90">
                        {metadataString(item.metadata, "generatedText") || "No text available"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card-actions mt-1 justify-end">
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={loadingId === item.id}
                    onClick={() => loadEvents(item.id)}
                  >
                    <Info className="h-4 w-4" />
                    Audit
                  </button>
                  {item.status === "PENDING" ? (
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={loadingId === item.id}
                      onClick={() => handleClaim(item.id)}
                    >
                      {loadingId === item.id && loadingAction === "claim" ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Hand className="h-4 w-4" />
                      )}
                      Claim
                    </button>
                  ) : null}
                  {(item.status === "PENDING" || item.status === "IN_REVIEW") && (
                    <>
                      <button
                        className="btn btn-success btn-sm"
                        disabled={loadingId === item.id}
                        onClick={() => handleApprove(item.id)}
                      >
                        {loadingId === item.id && loadingAction === "approve" ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Approve
                      </button>
                      <button
                        className="btn btn-error btn-sm"
                        disabled={loadingId === item.id}
                        onClick={() => handleReject(item.id)}
                      >
                        {loadingId === item.id && loadingAction === "reject" ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {(cursorHistory.length > 0 || pagination.hasMore) && (
          <div className="mt-4 flex justify-center gap-2">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                void goToPreviousPage();
              }}
              disabled={isPageLoading || cursorHistory.length === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                void goToNextPage();
              }}
              disabled={isPageLoading || !pagination.hasMore || !pagination.nextCursor}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <dialog className={`modal ${isAuditModalOpen ? "modal-open" : ""}`}>
        <div className="modal-box flex max-h-[90vh] min-h-[50vh] w-11/12 max-w-5xl flex-col">
          <form method="dialog">
            <button
              className="btn btn-circle btn-ghost btn-sm absolute top-2 right-2"
              onClick={(e) => {
                e.preventDefault();
                setIsAuditModalOpen(false);
              }}
            >
              ✕
            </button>
          </form>
          <h3 className="mb-4 shrink-0 text-lg font-bold">Audit Events</h3>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isAuditLoading ? (
              <div className="flex flex-col gap-3">
                <div className="skeleton h-8 w-full"></div>
                <div className="skeleton h-8 w-full"></div>
                <div className="skeleton h-8 w-full"></div>
              </div>
            ) : events.length === 0 ? (
              <div className="text-sm opacity-70">No audit events loaded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-xs table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Event</th>
                      <th>Review</th>
                      <th>Task</th>
                      <th>Reason</th>
                      <th>Reviewer</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event, idx) => (
                      <tr key={`${event.reviewId}-${event.eventType}-${idx}`}>
                        <td>{new Date(event.createdAt).toLocaleString()}</td>
                        <td>{event.eventType}</td>
                        <td className="font-mono text-[11px]">{event.reviewId.slice(0, 8)}</td>
                        <td className="font-mono text-[11px]">{event.taskId.slice(0, 8)}</td>
                        <td>{event.reasonCode ?? "-"}</td>
                        <td className="font-mono text-[11px]">
                          {event.reviewerId ? event.reviewerId.slice(0, 8) : "-"}
                        </td>
                        <td className="max-w-sm text-[11px] break-words whitespace-pre-wrap">
                          {[
                            metadataString(event.metadata, "safetyReasonCode"),
                            metadataString(event.metadata, "safetyReason"),
                            metadataString(event.metadata, "generatedText"),
                          ]
                            .filter(Boolean)
                            .join(" | ") || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsAuditModalOpen(false);
            }}
          >
            close
          </button>
        </form>
      </dialog>
    </div>
  );
}
