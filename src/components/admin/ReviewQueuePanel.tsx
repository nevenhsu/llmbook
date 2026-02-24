"use client";

import { useState } from "react";
import type { ReviewQueueItem } from "@/lib/ai/review-queue/review-queue";
import type { ReviewQueueMetrics } from "@/lib/ai/observability/review-queue-metrics";

type Props = {
  initialItems: ReviewQueueItem[];
  initialMetrics: ReviewQueueMetrics;
};

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

export default function ReviewQueuePanel({ initialItems, initialMetrics }: Props) {
  const [items, setItems] = useState(initialItems);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");

  const refresh = async () => {
    const response = await fetch("/api/admin/ai/review-queue?status=PENDING,IN_REVIEW&limit=100");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error ?? "Load failed");
    }
    setItems(data.items ?? []);
    setMetrics(data.metrics);
  };

  const handleClaim = async (reviewId: string) => {
    setLoadingId(reviewId);
    setMessage("");
    try {
      await postJson<{ item: ReviewQueueItem }>("/api/admin/ai/review-queue/claim", { reviewId });
      await refresh();
      setMessage("Claimed");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Claim failed");
    } finally {
      setLoadingId(null);
    }
  };

  const handleApprove = async (reviewId: string) => {
    setLoadingId(reviewId);
    setMessage("");
    try {
      await postJson<{ item: ReviewQueueItem }>("/api/admin/ai/review-queue/approve", {
        reviewId,
        reasonCode: "manual_approved",
      });
      await refresh();
      setMessage("Approved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Approve failed");
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (reviewId: string) => {
    setLoadingId(reviewId);
    setMessage("");
    try {
      await postJson<{ item: ReviewQueueItem }>("/api/admin/ai/review-queue/reject", {
        reviewId,
        reasonCode: "manual_rejected",
      });
      await refresh();
      setMessage("Rejected");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reject failed");
    } finally {
      setLoadingId(null);
    }
  };

  const handleExpire = async () => {
    setLoadingId("expire");
    setMessage("");
    try {
      await postJson<{ expiredCount: number }>("/api/admin/ai/review-queue/expire");
      await refresh();
      setMessage("Expired due items processed");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Expire failed");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
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

      <div className="flex items-center gap-2">
        <button className="btn btn-outline btn-sm" onClick={() => refresh()} disabled={!!loadingId}>
          Refresh
        </button>
        <button className="btn btn-outline btn-sm" onClick={handleExpire} disabled={!!loadingId}>
          Expire Due
        </button>
        {message ? <span className="text-sm opacity-80">{message}</span> : null}
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="alert">
            <span>No review items.</span>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="card bg-base-200 border-base-300 border">
              <div className="card-body gap-2 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm opacity-70">task {item.taskId}</div>
                  <div className="badge badge-outline">{item.status}</div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs opacity-80">
                  <span className="badge badge-ghost">risk: {item.riskLevel}</span>
                  <span className="badge badge-ghost">reason: {item.enqueueReasonCode}</span>
                  <span className="badge badge-ghost">
                    expires: {new Date(item.expiresAt).toLocaleString()}
                  </span>
                </div>
                <div className="card-actions justify-end">
                  {item.status === "PENDING" ? (
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={loadingId === item.id}
                      onClick={() => handleClaim(item.id)}
                    >
                      Claim
                    </button>
                  ) : null}
                  {(item.status === "PENDING" || item.status === "IN_REVIEW") && (
                    <>
                      <button
                        className="btn btn-sm btn-success"
                        disabled={loadingId === item.id}
                        onClick={() => handleApprove(item.id)}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-sm btn-error"
                        disabled={loadingId === item.id}
                        onClick={() => handleReject(item.id)}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
