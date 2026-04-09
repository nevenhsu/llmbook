"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SectionCard } from "@/components/admin/control-plane/SectionCard";
import PaginationClient from "@/components/ui/PaginationClient";
import OperatorStatusBadge from "@/components/ui/OperatorStatusBadge";
import OperatorTabs from "@/components/ui/OperatorTabs";
import OperatorTaskTable from "@/components/ui/OperatorTaskTable";
import PersonaIdentityCell from "@/components/ui/PersonaIdentityCell";
import { ApiError, apiFetchJson, apiPost } from "@/lib/api/fetch-json";
import type {
  AiAgentOperatorImageTableResponse,
  AiAgentOperatorJobListResponse,
  AiAgentOperatorMemoryTableResponse,
  AiAgentOperatorRuntimeTabResponse,
  AiAgentOperatorTaskTableResponse,
} from "@/lib/ai/agent/operator-console/types";

type TabId = "runtime" | "jobs" | "public" | "notification" | "image" | "memory";

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

function jobLabel(jobType: AiAgentOperatorJobListResponse["rows"][number]["jobType"]): string {
  switch (jobType) {
    case "public_task":
      return "Public Task";
    case "notification_task":
      return "Notification Task";
    case "image_generation":
      return "Image";
    case "memory_compress":
      return "Memory";
  }
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-base-300 bg-base-100 rounded-xl border p-4 shadow-sm">
      <div className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default function AiAgentOperatorConsole() {
  const [activeTab, setActiveTab] = useState<TabId>("runtime");
  const [runtimeData, setRuntimeData] = useState<AiAgentOperatorRuntimeTabResponse | null>(null);
  const [jobsData, setJobsData] = useState<AiAgentOperatorJobListResponse | null>(null);
  const [publicData, setPublicData] = useState<AiAgentOperatorTaskTableResponse | null>(null);
  const [notificationData, setNotificationData] = useState<AiAgentOperatorTaskTableResponse | null>(
    null,
  );
  const [imageData, setImageData] = useState<AiAgentOperatorImageTableResponse | null>(null);
  const [memoryData, setMemoryData] = useState<AiAgentOperatorMemoryTableResponse | null>(null);

  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [publicLoading, setPublicLoading] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [memoryLoading, setMemoryLoading] = useState(false);

  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [memoryError, setMemoryError] = useState<string | null>(null);

  const [jobsPage, setJobsPage] = useState(1);
  const [publicPage, setPublicPage] = useState(1);
  const [notificationPage, setNotificationPage] = useState(1);
  const [imagePage, setImagePage] = useState(1);
  const [memoryPage, setMemoryPage] = useState(1);

  const [runtimeActionPending, setRuntimeActionPending] = useState<string | null>(null);
  const [jobsRuntimeActionPending, setJobsRuntimeActionPending] = useState<string | null>(null);
  const [rowActionPending, setRowActionPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadRuntime = useCallback(async () => {
    setRuntimeLoading(true);
    setRuntimeError(null);
    try {
      setRuntimeData(
        await apiFetchJson<AiAgentOperatorRuntimeTabResponse>("/api/admin/ai/agent/panel/runtime"),
      );
    } catch (error) {
      setRuntimeError(toErrorMessage(error));
    } finally {
      setRuntimeLoading(false);
    }
  }, []);

  const loadJobs = useCallback(
    async (page = jobsPage) => {
      setJobsLoading(true);
      setJobsError(null);
      try {
        setJobsData(
          await apiFetchJson<AiAgentOperatorJobListResponse>(
            `/api/admin/ai/agent/panel/jobs?page=${page}&pageSize=10`,
          ),
        );
      } catch (error) {
        setJobsError(toErrorMessage(error));
      } finally {
        setJobsLoading(false);
      }
    },
    [jobsPage],
  );

  const loadTaskTable = useCallback(async (kind: "public" | "notification", page: number) => {
    const setLoading = kind === "public" ? setPublicLoading : setNotificationLoading;
    const setError = kind === "public" ? setPublicError : setNotificationError;
    const setData = kind === "public" ? setPublicData : setNotificationData;

    setLoading(true);
    setError(null);
    try {
      setData(
        await apiFetchJson<AiAgentOperatorTaskTableResponse>(
          `/api/admin/ai/agent/panel/tasks/${kind}?page=${page}&pageSize=10`,
        ),
      );
    } catch (error) {
      setError(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadImages = useCallback(
    async (page = imagePage) => {
      setImageLoading(true);
      setImageError(null);
      try {
        setImageData(
          await apiFetchJson<AiAgentOperatorImageTableResponse>(
            `/api/admin/ai/agent/panel/images?page=${page}&pageSize=10`,
          ),
        );
      } catch (error) {
        setImageError(toErrorMessage(error));
      } finally {
        setImageLoading(false);
      }
    },
    [imagePage],
  );

  const loadMemory = useCallback(
    async (page = memoryPage) => {
      setMemoryLoading(true);
      setMemoryError(null);
      try {
        setMemoryData(
          await apiFetchJson<AiAgentOperatorMemoryTableResponse>(
            `/api/admin/ai/agent/panel/memory?page=${page}&pageSize=10`,
          ),
        );
      } catch (error) {
        setMemoryError(toErrorMessage(error));
      } finally {
        setMemoryLoading(false);
      }
    },
    [memoryPage],
  );

  async function handleRuntimeAction(action: "pause" | "start") {
    setRuntimeActionPending(action);
    setActionError(null);
    setNotice(null);
    try {
      const result = await apiPost<{
        summary: string;
      }>(`/api/admin/ai/agent/panel/runtime/${action}`, {});
      setNotice(result.summary);
      await loadRuntime();
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setRuntimeActionPending(null);
    }
  }

  async function handleJobsRuntimeAction(action: "pause" | "start") {
    setJobsRuntimeActionPending(action);
    setActionError(null);
    setNotice(null);
    try {
      const result = await apiPost<{ summary: string }>(
        `/api/admin/ai/agent/panel/jobs/runtime/${action}`,
        {},
      );
      setNotice(result.summary);
      await Promise.all([loadJobs(), loadRuntime()]);
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setJobsRuntimeActionPending(null);
    }
  }

  async function enqueueJob(input: {
    jobType: "public_task" | "notification_task" | "image_generation" | "memory_compress";
    subjectId: string;
    actionKey: string;
    after?: () => Promise<void>;
  }) {
    setRowActionPending(input.actionKey);
    setActionError(null);
    setNotice(null);
    try {
      const result = await apiPost<{
        mode: "deduped" | "enqueued";
        task: { id: string; status: string };
      }>("/api/admin/ai/agent/panel/jobs", {
        jobType: input.jobType,
        subjectId: input.subjectId,
      });
      setNotice(
        result.mode === "deduped"
          ? `Active job already exists (${result.task.id}).`
          : `Queued ${input.jobType} as ${result.task.id}.`,
      );
      await Promise.all([
        loadJobs(1),
        loadRuntime(),
        input.after ? input.after() : Promise.resolve(),
      ]);
    } catch (error) {
      setActionError(toErrorMessage(error));
    } finally {
      setRowActionPending(null);
    }
  }

  useEffect(() => {
    void loadRuntime();
  }, [loadRuntime]);

  useEffect(() => {
    if (activeTab === "jobs" && !jobsData) {
      void loadJobs();
    }
    if (activeTab === "public" && !publicData) {
      void loadTaskTable("public", publicPage);
    }
    if (activeTab === "notification" && !notificationData) {
      void loadTaskTable("notification", notificationPage);
    }
    if (activeTab === "image" && !imageData) {
      void loadImages();
    }
    if (activeTab === "memory" && !memoryData) {
      void loadMemory();
    }
  }, [
    activeTab,
    imageData,
    jobsData,
    loadImages,
    loadJobs,
    loadMemory,
    loadTaskTable,
    memoryData,
    notificationData,
    notificationPage,
    publicData,
    publicPage,
  ]);

  useEffect(() => {
    if (activeTab !== "runtime" && activeTab !== "jobs") {
      return;
    }

    const interval = window.setInterval(
      () => {
        void loadRuntime();
        if (activeTab === "jobs") {
          void loadJobs();
        }
      },
      activeTab === "jobs" ? 10_000 : 5_000,
    );

    return () => {
      window.clearInterval(interval);
    };
  }, [activeTab, loadJobs, loadRuntime]);

  useEffect(() => {
    if (activeTab === "jobs") {
      void loadJobs(jobsPage);
    }
  }, [activeTab, jobsPage, loadJobs]);

  useEffect(() => {
    if (activeTab === "public") {
      void loadTaskTable("public", publicPage);
    }
  }, [activeTab, loadTaskTable, publicPage]);

  useEffect(() => {
    if (activeTab === "notification") {
      void loadTaskTable("notification", notificationPage);
    }
  }, [activeTab, loadTaskTable, notificationPage]);

  useEffect(() => {
    if (activeTab === "image") {
      void loadImages(imagePage);
    }
  }, [activeTab, imagePage, loadImages]);

  useEffect(() => {
    if (activeTab === "memory") {
      void loadMemory(memoryPage);
    }
  }, [activeTab, loadMemory, memoryPage]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-base-content/50 text-sm font-semibold tracking-[0.24em] uppercase">
          Admin
        </p>
        <h1 className="text-3xl font-semibold">AI Agent Operator Console</h1>
        <p className="text-base-content/70 max-w-3xl text-sm">
          Client-loaded operator controls for runtime visibility, manual jobs, task redo, image
          redo, and persona memory compression.
        </p>
      </div>

      {notice ? <div className="alert alert-success text-sm">{notice}</div> : null}
      {actionError ? <div className="alert alert-error text-sm">{actionError}</div> : null}

      <OperatorTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: "runtime", label: "Runtime" },
          { id: "jobs", label: "Jobs" },
          { id: "public", label: "Public" },
          { id: "notification", label: "Notification" },
          { id: "image", label: "Image" },
          { id: "memory", label: "Memory" },
        ]}
      />

      {activeTab === "runtime" ? (
        <div className="space-y-6">
          {runtimeError ? <div className="alert alert-error text-sm">{runtimeError}</div> : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Queue Tasks" value={runtimeData?.summary.queueTasksAll ?? "-"} />
            <StatCard label="Public Tasks" value={runtimeData?.summary.publicTasks ?? "-"} />
            <StatCard
              label="Notification Tasks"
              value={runtimeData?.summary.notificationTasks ?? "-"}
            />
            <StatCard label="Image Queue" value={runtimeData?.summary.imageQueue ?? "-"} />
            <StatCard label="Jobs Queue" value={runtimeData?.summary.jobsQueue ?? "-"} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              title="Main Runtime"
              actions={
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      void handleRuntimeAction("pause");
                    }}
                    disabled={
                      runtimeLoading ||
                      runtimeActionPending !== null ||
                      runtimeData?.mainRuntime.paused === true
                    }
                  >
                    {runtimeActionPending === "pause" ? "Pausing..." : "Pause"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-neutral btn-sm"
                    onClick={() => {
                      void handleRuntimeAction("start");
                    }}
                    disabled={
                      runtimeLoading ||
                      runtimeActionPending !== null ||
                      runtimeData?.mainRuntime.paused !== true
                    }
                  >
                    {runtimeActionPending === "start" ? "Starting..." : "Start"}
                  </button>
                </div>
              }
            >
              {runtimeLoading && !runtimeData ? (
                <div className="text-base-content/60 text-sm">Loading runtime...</div>
              ) : runtimeData ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <OperatorStatusBadge status={runtimeData.mainRuntime.statusLabel} />
                    <span className="text-base-content/70">{runtimeData.mainRuntime.detail}</span>
                  </div>
                  <div>Paused: {runtimeData.mainRuntime.paused ? "Yes" : "No"}</div>
                  <div>
                    Runtime App Seen: {formatDateTime(runtimeData.mainRuntime.runtimeAppSeenAt)}
                  </div>
                  <div>Cooldown Until: {formatDateTime(runtimeData.mainRuntime.cooldownUntil)}</div>
                  <div>Last Started: {formatDateTime(runtimeData.mainRuntime.lastStartedAt)}</div>
                  <div>Last Finished: {formatDateTime(runtimeData.mainRuntime.lastFinishedAt)}</div>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard title="Jobs Runtime Snapshot">
              {runtimeData ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <OperatorStatusBadge status={runtimeData.jobsRuntime.statusLabel} />
                    <span className="text-base-content/70">{runtimeData.jobsRuntime.detail}</span>
                  </div>
                  <div>Paused: {runtimeData.jobsRuntime.paused ? "Yes" : "No"}</div>
                  <div>Runtime Key: {runtimeData.jobsRuntime.runtimeKey}</div>
                  <div>Last Started: {formatDateTime(runtimeData.jobsRuntime.lastStartedAt)}</div>
                  <div>Last Finished: {formatDateTime(runtimeData.jobsRuntime.lastFinishedAt)}</div>
                </div>
              ) : (
                <div className="text-base-content/60 text-sm">Loading jobs runtime...</div>
              )}
            </SectionCard>
          </div>
        </div>
      ) : null}

      {activeTab === "jobs" ? (
        <div className="space-y-6">
          <SectionCard
            title="Jobs Runtime"
            actions={
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={
                    jobsRuntimeActionPending !== null ||
                    jobsLoading ||
                    jobsData?.runtimeState.paused === true
                  }
                  onClick={() => {
                    void handleJobsRuntimeAction("pause");
                  }}
                >
                  {jobsRuntimeActionPending === "pause" ? "Pausing..." : "Pause"}
                </button>
                <button
                  type="button"
                  className="btn btn-neutral btn-sm"
                  disabled={
                    jobsRuntimeActionPending !== null ||
                    jobsLoading ||
                    jobsData?.runtimeState.paused !== true
                  }
                  onClick={() => {
                    void handleJobsRuntimeAction("start");
                  }}
                >
                  {jobsRuntimeActionPending === "start" ? "Starting..." : "Start"}
                </button>
              </div>
            }
          >
            {jobsError ? <div className="alert alert-error text-sm">{jobsError}</div> : null}
            {jobsLoading && !jobsData ? (
              <div className="text-base-content/60 text-sm">Loading jobs runtime...</div>
            ) : jobsData ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <OperatorStatusBadge status={jobsData.runtimeState.statusLabel} />
                  <span className="text-base-content/70">{jobsData.runtimeState.detail}</span>
                </div>
                <div>Runtime Key: {jobsData.runtimeState.runtimeKey}</div>
                <div>Queue Active: {jobsData.summary.active}</div>
                <div>Queue Terminal: {jobsData.summary.terminal}</div>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Jobs Queue" actions={null}>
            <div className="space-y-4">
              <div className="border-base-300 overflow-x-auto rounded-xl border">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Target</th>
                      <th>Status</th>
                      <th>Finished</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobsLoading ? (
                      <tr>
                        <td colSpan={5} className="text-base-content/60 text-center">
                          Loading rows...
                        </td>
                      </tr>
                    ) : jobsData && jobsData.rows.length > 0 ? (
                      jobsData.rows.map((row) => (
                        <tr key={row.id}>
                          <td>{jobLabel(row.jobType)}</td>
                          <td>
                            {row.target.kind === "memory" ? (
                              <PersonaIdentityCell persona={row.target.persona} />
                            ) : row.target.href ? (
                              <Link href={row.target.href} className="link link-hover text-sm">
                                {row.target.label}
                              </Link>
                            ) : row.target.kind === "image" && row.target.imageUrl ? (
                              <a href={row.target.imageUrl} className="link link-hover text-sm">
                                {row.target.label}
                              </a>
                            ) : (
                              <span className="text-base-content/50 text-sm">-</span>
                            )}
                          </td>
                          <td>
                            <OperatorStatusBadge status={row.status} />
                          </td>
                          <td>{formatDateTime(row.finishedAt)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-outline btn-xs"
                              disabled={!row.canRedo || rowActionPending === row.id}
                              onClick={() => {
                                void enqueueJob({
                                  jobType: row.jobType,
                                  subjectId: row.subjectId,
                                  actionKey: row.id,
                                  after: () => loadJobs(jobsPage),
                                });
                              }}
                            >
                              {rowActionPending === row.id ? "Queueing..." : "Redo"}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-base-content/60 text-center">
                          No jobs.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {jobsData ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-base-content/60 text-sm">
                    Page {jobsData.page} / {jobsData.totalPages} · Total {jobsData.totalItems}
                  </div>
                  <PaginationClient
                    page={jobsData.page}
                    totalPages={jobsData.totalPages}
                    onPageChange={setJobsPage}
                  />
                </div>
              ) : null}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "public" ? (
        <OperatorTaskTable
          title="Public Tasks"
          data={publicData}
          loading={publicLoading}
          error={publicError}
          onRefresh={() => {
            void loadTaskTable("public", publicPage);
          }}
          onPageChange={setPublicPage}
          onRedo={(taskId) => {
            void enqueueJob({
              jobType: "public_task",
              subjectId: taskId,
              actionKey: taskId,
              after: () => loadTaskTable("public", publicPage),
            });
          }}
          pendingActionId={rowActionPending}
        />
      ) : null}

      {activeTab === "notification" ? (
        <OperatorTaskTable
          title="Notification Tasks"
          data={notificationData}
          loading={notificationLoading}
          error={notificationError}
          onRefresh={() => {
            void loadTaskTable("notification", notificationPage);
          }}
          onPageChange={setNotificationPage}
          onRedo={(taskId) => {
            void enqueueJob({
              jobType: "notification_task",
              subjectId: taskId,
              actionKey: taskId,
              after: () => loadTaskTable("notification", notificationPage),
            });
          }}
          pendingActionId={rowActionPending}
        />
      ) : null}

      {activeTab === "image" ? (
        <SectionCard
          title="Image Queue"
          actions={
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                void loadImages(imagePage);
              }}
              disabled={imageLoading}
            >
              {imageLoading ? "Loading..." : "Refresh"}
            </button>
          }
        >
          <div className="space-y-4">
            {imageError ? <div className="alert alert-error text-sm">{imageError}</div> : null}
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
                  {imageLoading ? (
                    <tr>
                      <td colSpan={5} className="text-base-content/60 text-center">
                        Loading rows...
                      </td>
                    </tr>
                  ) : imageData && imageData.rows.length > 0 ? (
                    imageData.rows.map((row) => (
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
                              void enqueueJob({
                                jobType: "image_generation",
                                subjectId: row.id,
                                actionKey: row.id,
                                after: () => loadImages(imagePage),
                              });
                            }}
                          >
                            {rowActionPending === row.id ? "Queueing..." : "Redo"}
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
            {imageData ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-base-content/60 text-sm">
                  Page {imageData.page} / {imageData.totalPages} · Total {imageData.totalItems}
                </div>
                <PaginationClient
                  page={imageData.page}
                  totalPages={imageData.totalPages}
                  onPageChange={setImagePage}
                />
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "memory" ? (
        <SectionCard
          title="Memory"
          actions={
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                void loadMemory(memoryPage);
              }}
              disabled={memoryLoading}
            >
              {memoryLoading ? "Loading..." : "Refresh"}
            </button>
          }
        >
          <div className="space-y-4">
            {memoryError ? <div className="alert alert-error text-sm">{memoryError}</div> : null}
            <div className="border-base-300 overflow-x-auto rounded-xl border">
              <table className="table">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Long Memory</th>
                    <th>Short Memories</th>
                    <th>Latest Memory</th>
                    <th>Last Compressed</th>
                    <th>Priority</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {memoryLoading ? (
                    <tr>
                      <td colSpan={7} className="text-base-content/60 text-center">
                        Loading rows...
                      </td>
                    </tr>
                  ) : memoryData && memoryData.rows.length > 0 ? (
                    memoryData.rows.map((row) => (
                      <tr key={row.persona.id}>
                        <td>
                          <PersonaIdentityCell persona={row.persona} />
                        </td>
                        <td>{row.longMemoryPresent ? "Yes" : "No"}</td>
                        <td>{row.shortMemoryCount}</td>
                        <td>{formatDateTime(row.latestMemoryUpdatedAt)}</td>
                        <td>{formatDateTime(row.lastCompressedAt)}</td>
                        <td>{row.priorityScore ?? "-"}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            disabled={rowActionPending === row.persona.id}
                            onClick={() => {
                              void enqueueJob({
                                jobType: "memory_compress",
                                subjectId: row.persona.id,
                                actionKey: row.persona.id,
                                after: () => loadMemory(memoryPage),
                              });
                            }}
                          >
                            {rowActionPending === row.persona.id ? "Queueing..." : "Run"}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-base-content/60 text-center">
                        No personas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {memoryData ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-base-content/60 text-sm">
                  Page {memoryData.page} / {memoryData.totalPages} · Total {memoryData.totalItems}
                </div>
                <PaginationClient
                  page={memoryData.page}
                  totalPages={memoryData.totalPages}
                  onPageChange={setMemoryPage}
                />
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
