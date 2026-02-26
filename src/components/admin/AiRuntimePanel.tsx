"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { RefreshCw, Play, AlertTriangle } from "lucide-react";
import type {
  RuntimeEventItem,
  RuntimeTaskItem,
  RuntimeWorkerStatus,
} from "@/lib/ai/observability/runtime-observability-store";
import type { QueueTaskStatus } from "@/lib/ai/task-queue/task-queue";

type RuntimeStatusResponse = {
  workers: RuntimeWorkerStatus[];
  queueCounts: Record<QueueTaskStatus, number>;
  breaker: {
    open: boolean;
    openWorkers: Array<{ workerId: string; reason: string | null }>;
  };
  lastRuntimeEventAt: string | null;
  updatedAt: string;
};

type RuntimeEventsResponse = {
  items: RuntimeEventItem[];
  pagination: {
    limit: number;
    cursor: string | null;
    hasMore: boolean;
    nextCursor: string | null;
  };
};

type RuntimeTasksResponse = {
  items: RuntimeTaskItem[];
  limit: number;
  updatedAt: string;
};

type Props = {
  initialStatus: RuntimeStatusResponse;
  initialEvents: RuntimeEventsResponse;
  initialTasks: RuntimeTasksResponse;
};

type Filters = {
  layer: string;
  reasonCode: string;
  entityId: string;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? "Request failed");
  }
  return data as T;
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? "Request failed");
  }
  return data as T;
}

function formatTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

export default function AiRuntimePanel({ initialStatus, initialEvents, initialTasks }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [events, setEvents] = useState(initialEvents);
  const [tasks, setTasks] = useState(initialTasks);
  const [loading, setLoading] = useState(false);
  const [resumeWorkerId, setResumeWorkerId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    layer: "",
    reasonCode: "",
    entityId: "",
  });

  const eventsQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(events.pagination.limit));
    if (filters.layer.trim()) {
      params.set("layer", filters.layer.trim());
    }
    if (filters.reasonCode.trim()) {
      params.set("reasonCode", filters.reasonCode.trim());
    }
    if (filters.entityId.trim()) {
      params.set("entityId", filters.entityId.trim());
    }
    return params.toString();
  }, [events.pagination.limit, filters]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const [nextStatus, nextEvents, nextTasks] = await Promise.all([
        fetchJson<RuntimeStatusResponse>("/api/admin/ai/runtime/status"),
        fetchJson<RuntimeEventsResponse>(`/api/admin/ai/runtime/events?${eventsQuery}`),
        fetchJson<RuntimeTasksResponse>(`/api/admin/ai/runtime/tasks?limit=${tasks.limit}`),
      ]);
      setStatus(nextStatus);
      setEvents(nextEvents);
      setTasks(nextTasks);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refresh failed");
    } finally {
      setLoading(false);
    }
  }, [eventsQuery, tasks.limit]);

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshAll();
    }, 12_000);
    return () => clearInterval(timer);
  }, [refreshAll]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const handleTryResume = async (workerId: string) => {
    setResumeWorkerId(workerId);
    try {
      await postJson("/api/admin/ai/runtime/resume", { workerId });
      toast.success(`Resume requested for ${workerId}`);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Resume failed");
    } finally {
      setResumeWorkerId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">AI Runtime Observability</h1>
          <p className="text-sm opacity-80">Worker health, queue, events, and recent tasks.</p>
        </div>
        <button
          className="btn btn-outline btn-sm"
          disabled={loading}
          onClick={() => void refreshAll()}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="card border-base-300 bg-base-100 border">
          <div className="card-body p-4">
            <div className="text-sm opacity-70">Breaker</div>
            <div
              className={`text-lg font-semibold ${status.breaker.open ? "text-error" : "text-success"}`}
            >
              {status.breaker.open ? "OPEN" : "CLOSED"}
            </div>
            <div className="text-xs opacity-70">
              Last event: {formatTime(status.lastRuntimeEventAt)}
            </div>
          </div>
        </div>
        <div className="card border-base-300 bg-base-100 border md:col-span-2">
          <div className="card-body p-4">
            <div className="mb-2 text-sm opacity-70">Queue Counts</div>
            <div className="grid grid-cols-3 gap-2 text-sm md:grid-cols-6">
              {Object.entries(status.queueCounts).map(([key, value]) => (
                <div key={key} className="border-base-300 rounded border px-2 py-1 text-center">
                  <div className="font-semibold">{value}</div>
                  <div className="opacity-70">{key}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card border-base-300 bg-base-100 border">
        <div className="card-body p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Worker Status
          </div>
          <div className="overflow-x-auto">
            <table className="table-sm table">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Status</th>
                  <th>Circuit</th>
                  <th>Current Task</th>
                  <th>Last Heartbeat</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {status.workers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center opacity-70">
                      No worker status
                    </td>
                  </tr>
                ) : (
                  status.workers.map((worker) => (
                    <tr key={worker.workerId}>
                      <td className="font-mono text-xs">{worker.workerId}</td>
                      <td>{worker.status}</td>
                      <td>{worker.circuitOpen ? (worker.circuitReason ?? "OPEN") : "CLOSED"}</td>
                      <td className="font-mono text-xs">{worker.currentTaskId ?? "-"}</td>
                      <td className="text-xs">{formatTime(worker.lastHeartbeat)}</td>
                      <td className="text-right">
                        {worker.circuitOpen ? (
                          <button
                            className="btn btn-xs btn-warning"
                            disabled={resumeWorkerId === worker.workerId}
                            onClick={() => void handleTryResume(worker.workerId)}
                          >
                            <Play className="h-3.5 w-3.5" />
                            Try Resume
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card border-base-300 bg-base-100 border">
          <div className="card-body p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <input
                className="input input-bordered input-sm"
                placeholder="layer"
                value={filters.layer}
                onChange={(event) => setFilters((prev) => ({ ...prev, layer: event.target.value }))}
              />
              <input
                className="input input-bordered input-sm"
                placeholder="reasonCode"
                value={filters.reasonCode}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, reasonCode: event.target.value }))
                }
              />
              <input
                className="input input-bordered input-sm"
                placeholder="entityId"
                value={filters.entityId}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, entityId: event.target.value }))
                }
              />
            </div>
            <div className="overflow-x-auto">
              <table className="table-xs table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Layer</th>
                    <th>Op</th>
                    <th>Reason</th>
                    <th>Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {events.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center opacity-70">
                        No events
                      </td>
                    </tr>
                  ) : (
                    events.items.map((event) => (
                      <tr key={event.id}>
                        <td className="text-xs">{formatTime(event.occurredAt)}</td>
                        <td>{event.layer}</td>
                        <td>{event.operation}</td>
                        <td className="font-mono text-xs">{event.reasonCode}</td>
                        <td className="font-mono text-xs">{event.entityId}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card border-base-300 bg-base-100 border">
          <div className="card-body p-4">
            <h2 className="mb-2 text-sm font-semibold">Recent Tasks</h2>
            <div className="overflow-x-auto">
              <table className="table-xs table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>Lease Owner</th>
                    <th>Runtime</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center opacity-70">
                        No tasks
                      </td>
                    </tr>
                  ) : (
                    tasks.items.map((task) => (
                      <tr key={task.id}>
                        <td className="font-mono text-xs">{task.id.slice(0, 8)}</td>
                        <td>{task.status}</td>
                        <td className="font-mono text-xs">
                          {task.skipOrFailReason ?? task.latestTransitionReason ?? "-"}
                        </td>
                        <td className="font-mono text-xs">{task.leaseOwner ?? "-"}</td>
                        <td className="font-mono text-xs">
                          {task.latestRuntimeEvent?.reasonCode ?? "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
