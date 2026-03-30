"use client";

import { useState } from "react";
import { SectionCard } from "@/components/admin/control-plane/SectionCard";
import { PreviewPanel } from "@/components/admin/control-plane/PreviewPanel";
import { ArtifactDetailModal } from "@/components/ui/ArtifactDetailModal";
import { JsonPreviewCard } from "@/components/ui/JsonPreviewCard";
import { PromptDetailModal } from "@/components/ui/PromptDetailModal";
import { apiFetchJson, apiPost, ApiError } from "@/lib/api/fetch-json";
import {
  buildMemoryArtifactDetail,
  buildMemoryLineageSummary,
  buildMemoryOutcomeTrace,
} from "@/lib/ai/agent/memory";
import { buildMemoryPersonaPreview } from "@/lib/ai/agent/memory";
import { AI_AGENT_PANEL_SECTIONS, type AiAgentPanelSectionId } from "@/lib/ai/agent/panel-sections";
import { buildExecutionPreviewFromTask } from "@/lib/ai/agent/execution/execution-preview";
import type {
  AiAgentRunnerPreviewResponse,
  AiAgentRunnerExecutedResponse,
  AiAgentRunnerGuardedExecuteResponse,
  AiAgentRunnerTarget,
} from "@/lib/ai/agent/execution/admin-runner-service";
import type {
  AiAgentMemoryCompressResponse,
  AiAgentMemoryArtifactDetailId,
  AiAgentMemoryGuardedCompressResponse,
  AiAgentMemoryPersistedCompressResponse,
  AiAgentMemoryPersistedWriteResponse,
  AiAgentMemoryPersonaOption,
  AiAgentMemoryPersonaPreview,
  AiAgentMemoryWriteResponse,
} from "@/lib/ai/agent/memory";
import {
  buildResolvedPersonasPreview,
  buildSelectorOutputPreview,
  buildTaskCandidatePreview,
  buildTaskInjectionPreview,
  buildTaskWritePreview,
} from "@/lib/ai/agent/intake/intake-preview";
import { buildQueueActionPreviewSet } from "@/lib/ai/agent/tasks/queue-action-preview";
import type { AiAgentQueueActionName } from "@/lib/ai/agent/tasks/queue-action-preview";
import { buildOperatorFlowTrace } from "@/lib/ai/agent/operator-flow-trace";
import { buildAiAgentReadinessSummary } from "@/lib/ai/agent/readiness-summary";
import { buildContinuousRuntimeCheckpoint } from "@/lib/ai/agent/continuous-runtime-checkpoint";
import { buildPmAcceptanceSummary } from "@/lib/ai/agent/pm-acceptance-summary";
import { buildPmWalkthroughChecklist } from "@/lib/ai/agent/pm-walkthrough-checklist";
import type { AiAgentRuntimeSourceSnapshot } from "@/lib/ai/agent/intake/intake-read-model";
import type { AiAgentTaskInjectionExecutedResponse } from "@/lib/ai/agent/intake/task-injection-service";
import {
  buildRuntimeControlGuard,
  type AiAgentRuntimeControlResponse,
} from "@/lib/ai/agent/runtime-control-service";
import type {
  AiAgentLatestRunSnapshot,
  AiAgentOverviewSnapshot,
  AiAgentRecentMediaJobSnapshot,
  AiAgentRecentTaskSnapshot,
} from "@/lib/ai/agent/read-models/overview-read-model";
import type { AiAgentMediaJobsResponse } from "@/lib/ai/agent/execution/media-admin-service";
import type { AiAgentMediaJobDetail } from "@/lib/ai/agent/execution/media-admin-service";
import type {
  AiAgentMediaJobActionBlockedResponse,
  AiAgentMediaJobActionExecutedResponse,
  AiAgentMediaJobActionPreviewResponse,
} from "@/lib/ai/agent/execution/media-job-action-service";
import type {
  QueueActionExecutedResponse,
  QueueActionGuardedResponse,
} from "@/lib/ai/agent/tasks/queue-action-service";

type StatCardProps = {
  label: string;
  value: string | number;
  detail?: string;
};

function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <div className="border-base-300 bg-base-100 rounded-xl border p-4 shadow-sm">
      <div className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
        {label}
      </div>
      <div className="text-base-content mt-2 text-2xl font-semibold">{value}</div>
      {detail ? <div className="text-base-content/70 mt-1 text-sm">{detail}</div> : null}
    </div>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(new Date(value));
}

function formatOptionalDateTime(value: string | null): string {
  return value ? formatDateTime(value) : "Not available";
}

function formatShortDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Taipei",
  }).format(new Date(value));
}

function formatRuntimePaused(value: boolean | null): string {
  if (value === null) {
    return "Unknown";
  }
  return value ? "Yes" : "No";
}

function getNestedRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function describeRunnerTarget(target: AiAgentRunnerTarget): string {
  switch (target) {
    case "text_once":
      return "Preview and execute go through the shared admin runner route for live text persistence.";
    case "media_once":
      return "Preview and execute now run the shared media pipeline for the selected completed text task, including generation, storage upload, and media-row completion.";
    case "compress_once":
      return "Preview and execute now reuse the shared memory compression path.";
    case "orchestrator_once":
      return "Preview and execute now run the smallest live orchestrator cycle available in this repo slice, including optional media dispatch after text persistence.";
  }
}

function mergeRecentTasksById(
  current: AiAgentRecentTaskSnapshot[],
  incoming: AiAgentRecentTaskSnapshot[],
): AiAgentRecentTaskSnapshot[] {
  const merged = [...incoming, ...current];
  const seen = new Set<string>();
  return merged.filter((task) => {
    if (seen.has(task.id)) {
      return false;
    }
    seen.add(task.id);
    return true;
  });
}

function rebuildMemoryPreviewForPersonaTasks(
  preview: AiAgentMemoryPersonaPreview,
  tasks: AiAgentRecentTaskSnapshot[],
): AiAgentMemoryPersonaPreview {
  const entries = [
    ...(preview.canonicalLongMemory ? [preview.canonicalLongMemory] : []),
    ...preview.recentShortMemories,
  ];

  return buildMemoryPersonaPreview({
    persona: preview.persona,
    entries,
    recentTasks: tasks.filter((task) => task.personaId === preview.persona.personaId),
  });
}

export default function AiAgentPanel({
  initialSnapshot,
  runtimePreviews,
  runtimeMemoryPreviews,
}: {
  initialSnapshot: AiAgentOverviewSnapshot;
  runtimePreviews?: {
    notification: AiAgentRuntimeSourceSnapshot;
    public: AiAgentRuntimeSourceSnapshot;
  } | null;
  runtimeMemoryPreviews?: {
    personas: AiAgentMemoryPersonaOption[];
    previews: AiAgentMemoryPersonaPreview[];
  } | null;
}) {
  const [activeSection, setActiveSection] = useState<AiAgentPanelSectionId>("overview");
  const [recentTasks, setRecentTasks] = useState(initialSnapshot.recentTasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialSnapshot.recentTasks[0]?.id ?? null,
  );
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    initialSnapshot.recentRuns[0]
      ? `${initialSnapshot.recentRuns[0].runAt}-${initialSnapshot.recentRuns[0].snapshotFrom}`
      : null,
  );
  const [recentMediaJobs, setRecentMediaJobs] = useState(initialSnapshot.recentMediaJobs);
  const [selectedMediaJobId, setSelectedMediaJobId] = useState<string | null>(
    initialSnapshot.recentMediaJobs[0]?.id ?? null,
  );
  const [mediaListLimit, setMediaListLimit] = useState(12);
  const [mediaStatusFilter, setMediaStatusFilter] = useState<
    "all" | "PENDING_GENERATION" | "RUNNING" | "DONE" | "FAILED"
  >("all");
  const [mediaSearchInput, setMediaSearchInput] = useState("");
  const [queueActionPending, setQueueActionPending] = useState<string | null>(null);
  const [injectionPending, setInjectionPending] = useState<"notification" | "public" | null>(null);
  const [injectionResponse, setInjectionResponse] =
    useState<AiAgentTaskInjectionExecutedResponse | null>(null);
  const [injectionError, setInjectionError] = useState<string | null>(null);
  const [queueActionResponse, setQueueActionResponse] = useState<
    QueueActionGuardedResponse | QueueActionExecutedResponse | null
  >(null);
  const [queueActionError, setQueueActionError] = useState<string | null>(null);
  const [runtimeControlPending, setRuntimeControlPending] = useState<string | null>(null);
  const [runtimeControlResponse, setRuntimeControlResponse] =
    useState<AiAgentRuntimeControlResponse | null>(null);
  const [runtimeControlError, setRuntimeControlError] = useState<string | null>(null);
  const [runtimeState, setRuntimeState] = useState(initialSnapshot.runtimeState);
  const [runnerPending, setRunnerPending] = useState<string | null>(null);
  const [runnerResponse, setRunnerResponse] = useState<
    | AiAgentRunnerPreviewResponse
    | AiAgentRunnerGuardedExecuteResponse
    | AiAgentRunnerExecutedResponse
    | null
  >(null);
  const [runnerError, setRunnerError] = useState<string | null>(null);
  const [mediaJobsPending, setMediaJobsPending] = useState(false);
  const [mediaJobsError, setMediaJobsError] = useState<string | null>(null);
  const [mediaJobsApiResult, setMediaJobsApiResult] = useState<AiAgentMediaJobsResponse | null>(
    null,
  );
  const [mediaDetailPending, setMediaDetailPending] = useState(false);
  const [mediaDetailError, setMediaDetailError] = useState<string | null>(null);
  const [mediaJobDetail, setMediaJobDetail] = useState<AiAgentMediaJobDetail | null>(null);
  const [mediaActionPending, setMediaActionPending] = useState<string | null>(null);
  const [mediaActionError, setMediaActionError] = useState<string | null>(null);
  const [mediaActionResult, setMediaActionResult] = useState<
    | AiAgentMediaJobActionPreviewResponse
    | AiAgentMediaJobActionExecutedResponse
    | AiAgentMediaJobActionBlockedResponse
    | null
  >(null);
  const [memoryPreviewSet, setMemoryPreviewSet] = useState(runtimeMemoryPreviews);
  const [selectedMemoryPersonaId, setSelectedMemoryPersonaId] = useState<string | null>(
    runtimeMemoryPreviews?.personas[0]?.personaId ?? null,
  );
  const [memoryPending, setMemoryPending] = useState<string | null>(null);
  const [memoryApiResult, setMemoryApiResult] = useState<unknown>(null);
  const [memoryVerificationTrace, setMemoryVerificationTrace] = useState<unknown>(null);
  const [latestWriteResult, setLatestWriteResult] =
    useState<AiAgentMemoryPersistedWriteResponse | null>(null);
  const [compressionMemoryResult, setCompressionMemoryResult] =
    useState<AiAgentMemoryPersistedCompressResponse | null>(null);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [openMemoryArtifact, setOpenMemoryArtifact] =
    useState<AiAgentMemoryArtifactDetailId | null>(null);
  const [runPromptModalOpen, setRunPromptModalOpen] = useState(false);
  const [intakePromptModalKind, setIntakePromptModalKind] = useState<
    "notification" | "public" | null
  >(null);

  const selectorBatchSize = initialSnapshot.config.values.selectorReferenceBatchSize;
  const selectedTask =
    recentTasks.find((task) => task.id === selectedTaskId) ?? recentTasks[0] ?? null;
  const selectedRun =
    initialSnapshot.recentRuns.find(
      (run) => `${run.runAt}-${run.snapshotFrom}` === selectedRunId,
    ) ??
    initialSnapshot.recentRuns[0] ??
    null;
  const selectedMediaJob =
    recentMediaJobs.find((job) => job.id === selectedMediaJobId) ?? recentMediaJobs[0] ?? null;
  const selectedTaskExecutionPreview = selectedTask
    ? buildExecutionPreviewFromTask(selectedTask)
    : null;
  const activeRunExecutionPreview =
    runnerResponse?.executionPreview ?? selectedTaskExecutionPreview;
  const readinessSummary = buildAiAgentReadinessSummary({
    ...initialSnapshot,
    runtimeState,
  });
  const pauseRuntimeGuard = buildRuntimeControlGuard("pause", runtimeState);
  const resumeRuntimeGuard = buildRuntimeControlGuard("resume", runtimeState);
  const runCycleRuntimeGuard = buildRuntimeControlGuard("run_cycle", runtimeState);
  const selectedTaskQueueActions = selectedTask ? buildQueueActionPreviewSet(selectedTask) : null;
  const activeMemoryPreview =
    memoryPreviewSet?.previews.find(
      (preview) => preview.persona.personaId === selectedMemoryPersonaId,
    ) ??
    memoryPreviewSet?.previews[0] ??
    null;
  const activeLatestWriteResult =
    latestWriteResult?.personaId === activeMemoryPreview?.persona.personaId
      ? latestWriteResult
      : null;
  const activeCompressionMemoryResult =
    compressionMemoryResult?.personaId === activeMemoryPreview?.persona.personaId
      ? compressionMemoryResult
      : null;
  const activeMemoryVerificationTrace =
    activeCompressionMemoryResult?.verificationTrace ??
    activeLatestWriteResult?.verificationTrace ??
    null;
  const activeMemoryArtifactDetail =
    activeMemoryPreview && openMemoryArtifact
      ? buildMemoryArtifactDetail(activeMemoryPreview, openMemoryArtifact)
      : null;
  const memoryLineageSummary = buildMemoryLineageSummary({
    selectedTask,
    activeMemoryPreview,
    latestWriteResult: activeLatestWriteResult,
    compressionResult: activeCompressionMemoryResult,
  });
  const memoryOutcomeTrace = buildMemoryOutcomeTrace({
    selectedTask,
    activeMemoryPreview,
    latestWriteResult: activeLatestWriteResult,
    compressionResult: activeCompressionMemoryResult,
  });
  const operatorFlowTrace = buildOperatorFlowTrace({
    injectionResponse,
    runnerResponse,
    memoryOutcomeTrace,
  });
  const continuousRuntimeCheckpoint = buildContinuousRuntimeCheckpoint({
    snapshot: {
      ...initialSnapshot,
      runtimeState,
    },
    readinessSummary,
    operatorFlowTrace,
  });
  const pmWalkthroughChecklist = buildPmWalkthroughChecklist({
    snapshot: {
      ...initialSnapshot,
      runtimeState,
    },
    operatorFlowTrace,
    checkpoint: continuousRuntimeCheckpoint,
  });
  const pmAcceptanceSummary = buildPmAcceptanceSummary({
    checkpoint: continuousRuntimeCheckpoint,
    checklist: pmWalkthroughChecklist,
  });
  const runMemoryVerificationTrace =
    runnerResponse?.mode === "executed"
      ? (runnerResponse.compressionResult?.verificationTrace ?? null)
      : null;

  function mergeMemoryPreview(personaId: string, patch: Partial<AiAgentMemoryPersonaPreview>) {
    setMemoryPreviewSet((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        previews: current.previews.map((preview) =>
          preview.persona.personaId === personaId ? { ...preview, ...patch } : preview,
        ),
      };
    });
  }

  async function handleRunnerAction(target: AiAgentRunnerTarget, mode: "preview" | "execute") {
    setRunnerPending(`${mode}:${target}`);
    setRunnerError(null);
    setRunnerResponse(null);

    try {
      const response = await apiPost<
        | AiAgentRunnerPreviewResponse
        | AiAgentRunnerGuardedExecuteResponse
        | AiAgentRunnerExecutedResponse
      >(`/api/admin/ai/agent/run/${target}`, {
        mode,
        taskId: target === "text_once" ? (selectedTask?.id ?? null) : null,
      });
      setRunnerResponse(response);
      if (response.mode === "executed" && response.compressionResult) {
        setCompressionMemoryResult(response.compressionResult);
        setMemoryVerificationTrace(response.compressionResult.verificationTrace);
        setSelectedMemoryPersonaId(response.compressionResult.personaId);
        mergeMemoryPreview(
          response.compressionResult.personaId,
          response.compressionResult.preview,
        );
      }
      if (response.mode === "executed") {
        const runnerTasks = [
          ...(response.textResult ? [response.textResult.updatedTask] : []),
          ...(response.orchestratorResult?.notificationInjection.insertedTasks ?? []),
          ...(response.orchestratorResult?.publicInjection.insertedTasks ?? []),
        ];

        if (runnerTasks.length > 0) {
          const mergedTasks = mergeRecentTasksById(recentTasks, runnerTasks).slice(0, 12);
          setRecentTasks(mergedTasks);
          setMemoryPreviewSet((current) => {
            if (!current) {
              return current;
            }

            const touchedPersonaIds = new Set(runnerTasks.map((task) => task.personaId));
            return {
              ...current,
              previews: current.previews.map((preview) =>
                touchedPersonaIds.has(preview.persona.personaId)
                  ? rebuildMemoryPreviewForPersonaTasks(preview, mergedTasks)
                  : preview,
              ),
            };
          });
        }

        if (response.textResult) {
          setSelectedTaskId(response.textResult.updatedTask.id);
          setSelectedMemoryPersonaId(response.textResult.updatedTask.personaId);
        } else if (response.orchestratorResult?.publicInjection.insertedTasks[0]?.id) {
          setSelectedTaskId(response.orchestratorResult.publicInjection.insertedTasks[0].id);
          setSelectedMemoryPersonaId(
            response.orchestratorResult.publicInjection.insertedTasks[0].personaId,
          );
        } else if (response.orchestratorResult?.notificationInjection.insertedTasks[0]?.id) {
          setSelectedTaskId(response.orchestratorResult.notificationInjection.insertedTasks[0].id);
          setSelectedMemoryPersonaId(
            response.orchestratorResult.notificationInjection.insertedTasks[0].personaId,
          );
        }
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setRunnerError(error.message);
      } else {
        setRunnerError("Runner request failed.");
      }
    } finally {
      setRunnerPending(null);
    }
  }

  async function handleRefreshMediaJobs(override?: {
    limit?: number;
    status?: "all" | "PENDING_GENERATION" | "RUNNING" | "DONE" | "FAILED";
    query?: string;
  }) {
    setMediaJobsPending(true);
    setMediaJobsError(null);

    try {
      const limit = override?.limit ?? mediaListLimit;
      const status = override?.status ?? mediaStatusFilter;
      const query = override?.query ?? mediaSearchInput;
      const params = new URLSearchParams({ limit: String(limit) });
      if (status !== "all") {
        params.set("status", status);
      }
      if (query.trim()) {
        params.set("query", query.trim());
      }
      const response = await apiFetchJson<AiAgentMediaJobsResponse>(
        `/api/admin/ai/agent/media/jobs?${params.toString()}`,
      );
      setRecentMediaJobs(response.jobs);
      setMediaJobsApiResult(response);
      setSelectedMediaJobId((current) => {
        if (current && response.jobs.some((job) => job.id === current)) {
          return current;
        }
        return response.jobs[0]?.id ?? null;
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setMediaJobsError(error.message);
      } else {
        setMediaJobsError("Media jobs refresh failed.");
      }
    } finally {
      setMediaJobsPending(false);
    }
  }

  async function handleApplyMediaFilters() {
    await handleRefreshMediaJobs();
  }

  async function handleLoadMoreMediaJobs() {
    const nextLimit = Math.min(mediaListLimit + 12, 48);
    setMediaListLimit(nextLimit);
    await handleRefreshMediaJobs({ limit: nextLimit });
  }

  async function handleLoadMediaJobDetail(jobId: string) {
    setMediaDetailPending(true);
    setMediaDetailError(null);

    try {
      const response = await apiFetchJson<AiAgentMediaJobDetail>(
        `/api/admin/ai/agent/media/jobs/${jobId}`,
      );
      setMediaJobDetail(response);
    } catch (error) {
      if (error instanceof ApiError) {
        setMediaDetailError(error.message);
      } else {
        setMediaDetailError("Media job detail request failed.");
      }
    } finally {
      setMediaDetailPending(false);
    }
  }

  async function handleMediaJobAction(mode: "preview" | "execute", jobId: string) {
    setMediaActionPending(`${mode}:${jobId}`);
    setMediaActionError(null);
    setMediaActionResult(null);

    try {
      const response = await apiPost<
        | AiAgentMediaJobActionPreviewResponse
        | AiAgentMediaJobActionExecutedResponse
        | AiAgentMediaJobActionBlockedResponse
      >(`/api/admin/ai/agent/media/jobs/${jobId}/actions`, {
        action: "retry_generation",
        mode,
      });
      setMediaActionResult(response);

      if (response.mode === "executed") {
        setRecentMediaJobs((current) =>
          current.map((job) =>
            job.id === response.updatedDetail.job.id ? response.updatedDetail.job : job,
          ),
        );
        setMediaJobDetail(response.updatedDetail);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        const details = error.details as AiAgentMediaJobActionBlockedResponse | undefined;
        if (details?.mode === "blocked_execute") {
          setMediaActionResult(details);
        }
        setMediaActionError(error.message);
      } else {
        setMediaActionError("Media action request failed.");
      }
    } finally {
      setMediaActionPending(null);
    }
  }

  async function handleQueueAction(action: AiAgentQueueActionName, mode: "preview" | "execute") {
    if (!selectedTask) {
      return;
    }

    setQueueActionPending(`${mode}:${action}`);
    setQueueActionError(null);
    setQueueActionResponse(null);

    try {
      const response = await apiPost<QueueActionGuardedResponse | QueueActionExecutedResponse>(
        `/api/admin/ai/agent/tasks/${selectedTask.id}/actions`,
        { action, mode },
      );
      setQueueActionResponse(response);
      if (response.mode === "executed") {
        setRecentTasks((current) =>
          current.map((task) =>
            task.id === response.updatedTask.id ? response.updatedTask : task,
          ),
        );
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setQueueActionError(error.message);
      } else {
        setQueueActionError("Queue action request failed.");
      }
    } finally {
      setQueueActionPending(null);
    }
  }

  async function handleRuntimeControl(action: "pause" | "resume" | "run_cycle") {
    setRuntimeControlPending(action);
    setRuntimeControlResponse(null);
    setRuntimeControlError(null);

    try {
      const response = await apiPost<AiAgentRuntimeControlResponse>(
        `/api/admin/ai/agent/runtime/${action}`,
        {},
      );
      setRuntimeControlResponse(response);
      setRuntimeState(response.runtimeState);
    } catch (error) {
      if (error instanceof ApiError) {
        const details = error.details as AiAgentRuntimeControlResponse | undefined;
        if (details?.mode === "blocked_execute") {
          setRuntimeControlResponse(details);
          setRuntimeState(details.runtimeState);
        }
        setRuntimeControlError(error.message);
      } else {
        setRuntimeControlError("Runtime control request failed.");
      }
    } finally {
      setRuntimeControlPending(null);
    }
  }

  async function handleInjection(kind: "notification" | "public") {
    setInjectionPending(kind);
    setInjectionError(null);
    setInjectionResponse(null);

    try {
      const response = await apiPost<AiAgentTaskInjectionExecutedResponse>(
        `/api/admin/ai/agent/intake/${kind}/inject`,
        {},
      );
      setInjectionResponse(response);
      if (response.insertedTasks.length > 0) {
        setRecentTasks((current) => [...response.insertedTasks, ...current].slice(0, 12));
        setSelectedTaskId(response.insertedTasks[0]?.id ?? null);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setInjectionError(error.message);
      } else {
        setInjectionError("Injection request failed.");
      }
    } finally {
      setInjectionPending(null);
    }
  }

  async function handleMemoryAction(
    action:
      | "refresh"
      | "latest-write"
      | "persist-latest-write"
      | "compression-batch"
      | "preview-compression"
      | "compress",
  ) {
    if (!selectedMemoryPersonaId) {
      return;
    }

    setMemoryPending(action);
    setMemoryApiResult(null);
    setMemoryVerificationTrace(null);
    setMemoryError(null);

    try {
      if (action === "refresh") {
        const response = await apiFetchJson<{ preview: AiAgentMemoryPersonaPreview }>(
          `/api/admin/ai/agent/memory/personas/${selectedMemoryPersonaId}`,
        );
        mergeMemoryPreview(selectedMemoryPersonaId, response.preview);
        setMemoryApiResult(response);
        return;
      }

      if (action === "latest-write") {
        const response = await apiFetchJson<{
          latestWritePreview: AiAgentMemoryPersonaPreview["latestWritePreview"];
        }>(`/api/admin/ai/agent/memory/personas/${selectedMemoryPersonaId}/latest-write-preview`);
        mergeMemoryPreview(selectedMemoryPersonaId, {
          latestWritePreview: response.latestWritePreview,
        });
        setMemoryApiResult(response);
        return;
      }

      if (action === "persist-latest-write") {
        const response = await apiPost<{ result: AiAgentMemoryWriteResponse }>(
          `/api/admin/ai/agent/memory/personas/${selectedMemoryPersonaId}/persist-latest-write`,
          {},
        );
        if (response.result.mode === "persisted") {
          mergeMemoryPreview(selectedMemoryPersonaId, response.result.preview);
          setMemoryVerificationTrace(response.result.verificationTrace);
          setLatestWriteResult(response.result);
        }
        setMemoryApiResult(response);
        return;
      }

      if (action === "compression-batch") {
        const response = await apiPost<{
          compressionBatchPreview: AiAgentMemoryPersonaPreview["compressionBatchPreview"];
        }>(
          `/api/admin/ai/agent/memory/personas/${selectedMemoryPersonaId}/compression-batch-preview`,
          {},
        );
        mergeMemoryPreview(selectedMemoryPersonaId, {
          compressionBatchPreview: response.compressionBatchPreview,
        });
        setMemoryApiResult(response);
        return;
      }

      if (action === "compress") {
        const response = await apiPost<{ result: AiAgentMemoryCompressResponse }>(
          `/api/admin/ai/agent/memory/personas/${selectedMemoryPersonaId}/compress`,
          {},
        );
        if (response.result.mode === "persisted") {
          mergeMemoryPreview(selectedMemoryPersonaId, response.result.preview);
          setMemoryVerificationTrace(response.result.verificationTrace);
          setCompressionMemoryResult(response.result);
        }
        setMemoryApiResult(response);
        return;
      }

      const response = await apiPost<{
        compressionPreview: AiAgentMemoryPersonaPreview["compressionPreview"];
      }>(`/api/admin/ai/agent/memory/personas/${selectedMemoryPersonaId}/preview-compression`, {});
      mergeMemoryPreview(selectedMemoryPersonaId, {
        compressionPreview: response.compressionPreview,
      });
      setMemoryApiResult(response);
    } catch (error) {
      if (error instanceof ApiError) {
        setMemoryError(error.message);
      } else {
        setMemoryError("Memory request failed.");
      }
    } finally {
      setMemoryPending(null);
    }
  }

  function buildRuntimeIntakeArtifacts(snapshot: AiAgentRuntimeSourceSnapshot | null | undefined) {
    if (!snapshot?.selectorInput) {
      return null;
    }
    const selectorOutput = buildSelectorOutputPreview(snapshot.selectorInput);
    const resolvedPersonas = buildResolvedPersonasPreview(selectorOutput);
    const candidates = buildTaskCandidatePreview({
      selectorInput: snapshot.selectorInput,
      resolvedPersonas,
    });
    const taskWritePreview = buildTaskWritePreview(candidates);
    return {
      selectorInput: snapshot.selectorInput,
      selectorOutput,
      resolvedPersonas,
      candidates,
      taskWritePreview,
      injectionPreview: buildTaskInjectionPreview({
        candidates,
        taskWritePreview,
      }),
    };
  }

  const notificationIntakeArtifacts = buildRuntimeIntakeArtifacts(runtimePreviews?.notification);
  const publicIntakeArtifacts = buildRuntimeIntakeArtifacts(runtimePreviews?.public);
  const notificationInjectionPreview = notificationIntakeArtifacts?.injectionPreview ?? null;
  const publicInjectionPreview = publicIntakeArtifacts?.injectionPreview ?? null;
  const activeIntakePromptArtifacts =
    intakePromptModalKind === "notification" ? notificationIntakeArtifacts : publicIntakeArtifacts;

  function renderTaskDetail(task: AiAgentRecentTaskSnapshot) {
    return (
      <div className="space-y-4 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Task Id</dt>
            <dd className="text-base-content mt-1 font-medium">{task.id}</dd>
          </div>
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Persona</dt>
            <dd className="text-base-content mt-1 font-medium">
              {task.personaUsername ?? task.personaDisplayName ?? task.personaId}
            </dd>
          </div>
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Source Linkage</dt>
            <dd className="text-base-content mt-1 font-medium">
              {task.sourceTable ?? "unknown"} / {task.sourceId ?? "unknown"}
            </dd>
          </div>
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Result</dt>
            <dd className="text-base-content mt-1 font-medium">
              {task.resultType ?? "pending"} {task.resultId ? `(${task.resultId})` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Retries</dt>
            <dd className="text-base-content mt-1 font-medium">
              {task.retryCount}/{task.maxRetries}
            </dd>
          </div>
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Lease</dt>
            <dd className="text-base-content mt-1 font-medium">
              {task.leaseOwner ?? "none"}
              {task.leaseUntil ? ` until ${formatDateTime(task.leaseUntil)}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Dedupe Key</dt>
            <dd className="text-base-content mt-1 font-medium">{task.dedupeKey ?? "none"}</dd>
          </div>
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Cooldown</dt>
            <dd className="text-base-content mt-1 font-medium">
              {task.cooldownUntil ? formatDateTime(task.cooldownUntil) : "none"}
            </dd>
          </div>
        </dl>

        <div>
          <div className="text-base-content/50 text-xs tracking-wide uppercase">Payload JSON</div>
          <pre className="bg-base-200 mt-2 max-h-64 overflow-auto rounded p-3 text-xs whitespace-pre-wrap">
            {JSON.stringify(task.payload, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  function renderRunDetail(run: AiAgentLatestRunSnapshot) {
    const selector = getNestedRecord(run.metadata.selector);
    const workerSummary = getNestedRecord(run.metadata.workerSummary);
    const parser = getNestedRecord(run.metadata.parser);
    const repair = getNestedRecord(run.metadata.repair);
    const parserIssues = getStringList(parser?.issues);

    return (
      <div className="space-y-4 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Run At</dt>
            <dd className="text-base-content mt-1 font-medium">{formatDateTime(run.runAt)}</dd>
          </div>
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Status</dt>
            <dd className="text-base-content mt-1 font-medium">
              {run.skippedReason ? "Skipped" : "Executed"}
            </dd>
          </div>
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Window Start</dt>
            <dd className="text-base-content mt-1 font-medium">
              {formatDateTime(run.snapshotFrom)}
            </dd>
          </div>
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Window End</dt>
            <dd className="text-base-content mt-1 font-medium">{formatDateTime(run.snapshotTo)}</dd>
          </div>
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">
              Injected Comments
            </dt>
            <dd className="text-base-content mt-1 font-medium">{run.commentsInjected}</dd>
          </div>
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Injected Posts</dt>
            <dd className="text-base-content mt-1 font-medium">{run.postsInjected}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Skip Reason</dt>
            <dd className="text-base-content mt-1 font-medium">{run.skippedReason ?? "none"}</dd>
          </div>
        </dl>

        <div className="space-y-3">
          <div className="text-base-content/50 text-xs tracking-wide uppercase">
            Structured Diagnostics
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                Selector Summary
              </dt>
              <dd className="text-base-content mt-1 font-medium">
                {selector
                  ? `${String(selector.candidates ?? "n/a")} candidates / ${String(selector.accepted ?? "n/a")} accepted`
                  : "n/a"}
              </dd>
            </div>
            <div>
              <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                Worker Summary
              </dt>
              <dd className="text-base-content mt-1 font-medium">
                {workerSummary
                  ? `${String(workerSummary.commentsInjected ?? "n/a")} comments / ${String(workerSummary.postsInjected ?? "n/a")} posts`
                  : "n/a"}
              </dd>
            </div>
            <div>
              <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                Parser Status
              </dt>
              <dd className="text-base-content mt-1 font-medium">
                {typeof parser?.status === "string" ? parser.status : "n/a"}
              </dd>
            </div>
            <div>
              <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                Repair Applied
              </dt>
              <dd className="text-base-content mt-1 font-medium">
                {typeof repair?.applied === "boolean"
                  ? repair.applied
                    ? `Yes (${String(repair.count ?? 0)})`
                    : "No"
                  : "n/a"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                Parser Issues
              </dt>
              <dd className="text-base-content mt-1 font-medium">
                {parserIssues.length > 0 ? parserIssues.join(", ") : "none"}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <div className="text-base-content/50 text-xs tracking-wide uppercase">Metadata JSON</div>
          <pre className="bg-base-200 mt-2 max-h-64 overflow-auto rounded p-3 text-xs whitespace-pre-wrap">
            {JSON.stringify(run.metadata, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  function renderMediaJobDetail(job: AiAgentRecentMediaJobSnapshot) {
    const ownerDetail = mediaJobDetail?.job.id === job.id ? mediaJobDetail.owner : null;
    return (
      <div className="text-base-content/75 space-y-4 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Status</dt>
            <dd className="text-base-content mt-1 font-medium">{job.status}</dd>
          </div>
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Created</dt>
            <dd className="text-base-content mt-1 font-medium">{formatDateTime(job.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Persona</dt>
            <dd className="text-base-content mt-1 font-medium">{job.personaUsername ?? "n/a"}</dd>
          </div>
          <div>
            <dt className="text-base-content/50 text-xs tracking-wide uppercase">Owner</dt>
            <dd className="text-base-content mt-1 font-medium">
              {job.commentId
                ? `comment ${job.commentId}`
                : job.postId
                  ? `post ${job.postId}`
                  : "unlinked"}
            </dd>
          </div>
        </dl>
        {job.url ? (
          <div className="border-base-300 bg-base-200 overflow-hidden rounded-xl border">
            <img
              src={job.url}
              alt={`Generated media ${job.id}`}
              className="h-40 w-full object-cover"
            />
          </div>
        ) : null}
        <div className="space-y-2">
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => void handleLoadMediaJobDetail(job.id)}
            disabled={mediaDetailPending}
          >
            {mediaDetailPending && mediaJobDetail?.job.id !== job.id
              ? "Loading owner detail..."
              : mediaDetailPending && mediaJobDetail?.job.id === job.id
                ? "Refreshing owner detail..."
                : "Load owner detail"}
          </button>
          {mediaDetailError ? <p className="text-error text-sm">{mediaDetailError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => void handleMediaJobAction("preview", job.id)}
              disabled={mediaActionPending === `execute:${job.id}`}
            >
              Preview retry
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => void handleMediaJobAction("execute", job.id)}
              disabled={
                mediaActionPending === `preview:${job.id}` ||
                job.status === "DONE" ||
                job.status === "RUNNING"
              }
            >
              {mediaActionPending === `execute:${job.id}` ? "Executing retry..." : "Execute retry"}
            </button>
          </div>
          {mediaActionError ? <p className="text-error text-sm">{mediaActionError}</p> : null}
          {mediaActionResult ? (
            <div className="text-base-content/70 text-xs">
              Reason code:{" "}
              <span className="font-semibold">{mediaActionResult.actionPreview.reasonCode}</span>
            </div>
          ) : null}
          {mediaActionResult ? (
            <JsonPreviewCard
              title="Media Action Result"
              data={mediaActionResult}
              emptyLabel="Preview or execute a media action to inspect the response."
            />
          ) : null}
          {ownerDetail ? (
            <div className="border-base-300 bg-base-100 rounded-xl border p-3">
              <div className="text-base-content/50 text-xs tracking-wide uppercase">
                Owner Detail
              </div>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">Type</dt>
                  <dd className="text-base-content mt-1 font-medium">{ownerDetail.ownerType}</dd>
                </div>
                <div>
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">Status</dt>
                  <dd className="text-base-content mt-1 font-medium">
                    {ownerDetail.status ?? "n/a"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">Title</dt>
                  <dd className="text-base-content mt-1 font-medium">
                    {ownerDetail.title ?? "n/a"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">Excerpt</dt>
                  <dd className="text-base-content mt-1">{ownerDetail.bodyPreview ?? "n/a"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">Path</dt>
                  <dd className="text-base-content mt-1 font-medium break-all">
                    {ownerDetail.path ?? "n/a"}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
        <JsonPreviewCard
          title="Media Job JSON"
          data={job}
          emptyLabel="Select a media job to inspect URL, prompt, and metadata."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-base-content text-3xl font-semibold">AI Agent Panel</h1>
            <p className="text-base-content/70 mt-2 max-w-3xl text-sm">
              Read-only operator surface for queue state, runtime health, and selector-facing intake
              snapshots.
            </p>
          </div>
          <div className="border-warning/30 bg-warning/10 text-warning-content rounded-xl border px-4 py-3 text-sm">
            Write actions stay disabled until shared execute contracts land.
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Queue Total" value={formatCount(initialSnapshot.queue.total)} />
        <StatCard label="Pending" value={formatCount(initialSnapshot.queue.pending)} />
        <StatCard
          label="Selector Batch Size"
          value={formatCount(selectorBatchSize)}
          detail="From ai_agent_config.selector_reference_batch_size"
        />
        <StatCard
          label="Runtime State"
          value={runtimeState.statusLabel}
          detail={runtimeState.detail}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {AI_AGENT_PANEL_SECTIONS.map((section) => {
          const active = section.id === activeSection;
          return (
            <button
              key={section.id}
              type="button"
              className={`btn btn-sm ${active ? "btn-neutral" : "btn-ghost border-base-300 border"}`}
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
            </button>
          );
        })}
      </div>

      {activeSection === "overview" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard title="Runtime State">
            <div className="text-base-content/80 space-y-2 text-sm">
              <div className="font-medium">{runtimeState.statusLabel}</div>
              <p>{runtimeState.detail}</p>
              <dl className="grid gap-3 pt-2 sm:grid-cols-2">
                <div>
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">Paused</dt>
                  <dd className="text-base-content mt-1 text-sm font-medium">
                    {formatRuntimePaused(runtimeState.paused)}
                  </dd>
                </div>
                <div>
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                    Lease Owner
                  </dt>
                  <dd className="text-base-content mt-1 text-sm font-medium">
                    {runtimeState.leaseOwner ?? "Not available"}
                  </dd>
                </div>
                <div>
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                    Lease Until
                  </dt>
                  <dd className="text-base-content mt-1 text-sm font-medium">
                    {formatOptionalDateTime(runtimeState.leaseUntil)}
                  </dd>
                </div>
                <div>
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                    Cooldown Until
                  </dt>
                  <dd className="text-base-content mt-1 text-sm font-medium">
                    {formatOptionalDateTime(runtimeState.cooldownUntil)}
                  </dd>
                </div>
                <div>
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                    Last Started
                  </dt>
                  <dd className="text-base-content mt-1 text-sm font-medium">
                    {formatOptionalDateTime(runtimeState.lastStartedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                    Last Finished
                  </dt>
                  <dd className="text-base-content mt-1 text-sm font-medium">
                    {formatOptionalDateTime(runtimeState.lastFinishedAt)}
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={
                    runtimeControlPending !== null ||
                    (pauseRuntimeGuard.reasonCode !== null &&
                      pauseRuntimeGuard.reasonCode !== "runtime_state_unavailable")
                  }
                  onClick={() => {
                    void handleRuntimeControl("pause");
                  }}
                >
                  {runtimeControlPending === "pause" ? "Pausing..." : "Pause runtime"}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={
                    runtimeControlPending !== null ||
                    (resumeRuntimeGuard.reasonCode !== null &&
                      resumeRuntimeGuard.reasonCode !== "runtime_state_unavailable")
                  }
                  onClick={() => {
                    void handleRuntimeControl("resume");
                  }}
                >
                  {runtimeControlPending === "resume" ? "Resuming..." : "Resume runtime"}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-neutral"
                  disabled={
                    runtimeControlPending !== null ||
                    (runCycleRuntimeGuard.reasonCode !== null &&
                      runCycleRuntimeGuard.reasonCode !== "runtime_state_unavailable")
                  }
                  onClick={() => {
                    void handleRuntimeControl("run_cycle");
                  }}
                >
                  {runtimeControlPending === "run_cycle" ? "Running..." : "Force run cycle"}
                </button>
              </div>
              <div className="text-base-content/70 space-y-2 pt-1 text-xs">
                <p>{pauseRuntimeGuard.summary}</p>
                <p>{resumeRuntimeGuard.summary}</p>
                <p>{runCycleRuntimeGuard.summary}</p>
              </div>
            </div>
          </SectionCard>
          <SectionCard title="Operator Readiness">
            <div className="text-base-content/80 space-y-3 text-sm">
              <div className="font-medium">{readinessSummary.statusLabel}</div>
              <div className="space-y-2">
                {readinessSummary.checks.map((check) => (
                  <div key={check.key} className="border-base-300 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                        {check.key.replaceAll("_", " ")}
                      </div>
                      <div className="text-xs font-medium">{check.status}</div>
                    </div>
                    <div className="mt-2">{check.summary}</div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
          <SectionCard title="Continuous Runtime Checkpoint">
            <div className="text-base-content/80 space-y-3 text-sm">
              <div className="font-medium">{continuousRuntimeCheckpoint.statusLabel}</div>
              <div className="space-y-2">
                {continuousRuntimeCheckpoint.checks.map((check) => (
                  <div key={check.key} className="border-base-300 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                        {check.key.replaceAll("_", " ")}
                      </div>
                      <div className="text-xs font-medium">{check.status}</div>
                    </div>
                    <div className="mt-2">{check.summary}</div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
          <SectionCard title="PM Walkthrough Checklist">
            <div className="text-base-content/80 space-y-3 text-sm">
              <div className="font-medium">{pmWalkthroughChecklist.statusLabel}</div>
              <div className="space-y-2">
                {pmWalkthroughChecklist.items.map((item) => (
                  <div key={item.key} className="border-base-300 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                        {item.label}
                      </div>
                      <div className="text-xs font-medium">{item.status}</div>
                    </div>
                    <div className="mt-2">{item.summary}</div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
          <SectionCard title="PM Acceptance Summary">
            <div className="text-base-content/80 space-y-3 text-sm">
              <div className="font-medium">{pmAcceptanceSummary.statusLabel}</div>
              <p>{pmAcceptanceSummary.recommendation}</p>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="border-base-300 rounded-lg border p-3">
                  <div className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                    Completed Evidence
                  </div>
                  <div className="mt-2 space-y-2">
                    {pmAcceptanceSummary.completedItems.length > 0 ? (
                      pmAcceptanceSummary.completedItems.map((item) => (
                        <div key={item} className="text-sm">
                          {item}
                        </div>
                      ))
                    ) : (
                      <div className="text-base-content/60 text-sm">
                        No completed acceptance evidence yet.
                      </div>
                    )}
                  </div>
                </div>
                <div className="border-base-300 rounded-lg border p-3">
                  <div className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                    Outstanding For PM
                  </div>
                  <div className="mt-2 space-y-2">
                    {pmAcceptanceSummary.outstandingItems.length > 0 ? (
                      pmAcceptanceSummary.outstandingItems.map((item) => (
                        <div key={item} className="text-sm">
                          {item}
                        </div>
                      ))
                    ) : (
                      <div className="text-base-content/60 text-sm">
                        No remaining operator-evidence blockers are currently visible.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
          <SectionCard title="Config">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                  Orchestrator Cooldown
                </dt>
                <dd className="text-base-content mt-1 text-sm font-medium">
                  {initialSnapshot.config.values.orchestratorCooldownMinutes} min
                </dd>
              </div>
              <div>
                <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                  Comment Cap
                </dt>
                <dd className="text-base-content mt-1 text-sm font-medium">
                  {initialSnapshot.config.values.maxCommentsPerCycle}
                </dd>
              </div>
              <div>
                <dt className="text-base-content/50 text-xs tracking-wide uppercase">Post Cap</dt>
                <dd className="text-base-content mt-1 text-sm font-medium">
                  {initialSnapshot.config.values.maxPostsPerCycle}
                </dd>
              </div>
              <div>
                <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                  Daily Token Quota
                </dt>
                <dd className="text-base-content mt-1 text-sm font-medium">
                  {formatCount(initialSnapshot.config.values.llmDailyTokenQuota)}
                </dd>
              </div>
            </dl>
          </SectionCard>
          <SectionCard title="Usage">
            {initialSnapshot.usage ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                    Prompt Tokens
                  </dt>
                  <dd className="text-base-content mt-1 text-sm font-medium">
                    {formatCount(initialSnapshot.usage.textPromptTokens)}
                  </dd>
                </div>
                <div>
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                    Completion Tokens
                  </dt>
                  <dd className="text-base-content mt-1 text-sm font-medium">
                    {formatCount(initialSnapshot.usage.textCompletionTokens)}
                  </dd>
                </div>
                <div>
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">Images</dt>
                  <dd className="text-base-content mt-1 text-sm font-medium">
                    {formatCount(initialSnapshot.usage.imageGenerationCount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">Updated</dt>
                  <dd className="text-base-content mt-1 text-sm font-medium">
                    {formatDateTime(initialSnapshot.usage.updatedAt)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-base-content/70 text-sm">No usage row has been recorded yet.</p>
            )}
          </SectionCard>
          <SectionCard title="Latest Run">
            {initialSnapshot.latestRun ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">Run At</dt>
                  <dd className="text-base-content mt-1 text-sm font-medium">
                    {formatDateTime(initialSnapshot.latestRun.runAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">Window</dt>
                  <dd className="text-base-content mt-1 text-sm font-medium">
                    {formatDateTime(initialSnapshot.latestRun.snapshotFrom)} to{" "}
                    {formatDateTime(initialSnapshot.latestRun.snapshotTo)}
                  </dd>
                </div>
                <div>
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                    Comments Injected
                  </dt>
                  <dd className="text-base-content mt-1 text-sm font-medium">
                    {formatCount(initialSnapshot.latestRun.commentsInjected)}
                  </dd>
                </div>
                <div>
                  <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                    Posts Injected
                  </dt>
                  <dd className="text-base-content mt-1 text-sm font-medium">
                    {formatCount(initialSnapshot.latestRun.postsInjected)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-base-content/70 text-sm">
                No orchestrator run has been recorded yet.
              </p>
            )}
          </SectionCard>
          <SectionCard title="Runtime Control Result">
            {runtimeControlError || runtimeControlResponse ? (
              <div className="space-y-3">
                {runtimeControlError ? (
                  <p className="text-error text-sm">{runtimeControlError}</p>
                ) : null}
                {runtimeControlResponse ? (
                  <pre className="bg-base-200 max-h-64 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                    {JSON.stringify(runtimeControlResponse, null, 2)}
                  </pre>
                ) : null}
              </div>
            ) : (
              <p className="text-base-content/70 text-sm">
                Trigger pause, resume, or force-run to inspect the shared runtime-control response.
              </p>
            )}
          </SectionCard>
        </div>
      ) : null}

      {activeSection === "intake" ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <SectionCard title="Heartbeat Checkpoints">
              {initialSnapshot.checkpoints.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="table-sm table">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Last Captured</th>
                        <th>Safety Overlap (s)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {initialSnapshot.checkpoints.map((checkpoint) => (
                        <tr key={checkpoint.sourceName}>
                          <td>{checkpoint.sourceName}</td>
                          <td>{formatDateTime(checkpoint.lastCapturedAt)}</td>
                          <td>{checkpoint.safetyOverlapSeconds}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-base-content/70 text-sm">
                  No heartbeat checkpoints have been recorded yet.
                </p>
              )}
            </SectionCard>

            <SectionCard title="Notification Intake Snapshot">
              {runtimePreviews?.notification ? (
                <div className="text-base-content/75 space-y-3 text-sm">
                  <p>
                    Status:{" "}
                    <span className="text-base-content font-medium">
                      {runtimePreviews.notification.statusLabel}
                    </span>
                  </p>
                  <p>
                    Sources:{" "}
                    <span className="text-base-content font-medium">
                      {runtimePreviews.notification.sourceNames.join(", ")}
                    </span>
                  </p>
                  <p>
                    Items:{" "}
                    <span className="text-base-content font-medium">
                      {runtimePreviews.notification.items.length}
                    </span>
                  </p>
                  {runtimePreviews.notification.items.length > 0 ? (
                    <div className="space-y-2">
                      {runtimePreviews.notification.items.slice(0, 3).map((item) => (
                        <div key={item.sourceId} className="border-base-300 rounded-lg border p-3">
                          <div className="text-base-content/50 text-xs tracking-wide uppercase">
                            {item.contentType}
                          </div>
                          <div className="text-base-content mt-1 font-medium">{item.summary}</div>
                          <div className="text-base-content/60 mt-1 text-xs">
                            {item.sourceId} · {formatShortDateTime(item.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-base-content/70 text-sm">
                      No notification opportunities are currently visible.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-base-content/70 text-sm">
                  Runtime notification preview is unavailable in this slice.
                </p>
              )}
            </SectionCard>

            <SectionCard title="Public Intake Snapshot">
              {runtimePreviews?.public ? (
                <div className="text-base-content/75 space-y-3 text-sm">
                  <p>
                    Status:{" "}
                    <span className="text-base-content font-medium">
                      {runtimePreviews.public.statusLabel}
                    </span>
                  </p>
                  <p>
                    Sources:{" "}
                    <span className="text-base-content font-medium">
                      {runtimePreviews.public.sourceNames.join(", ")}
                    </span>
                  </p>
                  <p>
                    Items:{" "}
                    <span className="text-base-content font-medium">
                      {runtimePreviews.public.items.length}
                    </span>
                  </p>
                  {runtimePreviews.public.items.length > 0 ? (
                    <div className="space-y-2">
                      {runtimePreviews.public.items.slice(0, 3).map((item) => (
                        <div key={item.sourceId} className="border-base-300 rounded-lg border p-3">
                          <div className="text-base-content/50 text-xs tracking-wide uppercase">
                            {item.contentType}
                          </div>
                          <div className="text-base-content mt-1 font-medium">{item.summary}</div>
                          <div className="text-base-content/60 mt-1 text-xs">
                            {item.sourceId} · {formatShortDateTime(item.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-base-content/70 text-sm">
                      No public opportunities are currently visible.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-base-content/70 text-sm">
                  Runtime public preview is unavailable in this slice.
                </p>
              )}
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="Notification Injection Preview">
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!notificationIntakeArtifacts}
                    onClick={() => setIntakePromptModalKind("notification")}
                  >
                    View Prompt
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-neutral"
                  disabled={injectionPending !== null || !notificationInjectionPreview}
                  onClick={() => {
                    void handleInjection("notification");
                  }}
                >
                  {injectionPending === "notification"
                    ? "Injecting..."
                    : "Inject notification tasks"}
                </button>
                <JsonPreviewCard
                  title="Notification Injection Preview"
                  data={notificationInjectionPreview}
                  emptyLabel="Runtime notification preview is required before injection artifacts can be shaped."
                />
              </div>
            </SectionCard>
            <SectionCard title="Public Injection Preview">
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!publicIntakeArtifacts}
                    onClick={() => setIntakePromptModalKind("public")}
                  >
                    View Prompt
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-neutral"
                  disabled={injectionPending !== null || !publicInjectionPreview}
                  onClick={() => {
                    void handleInjection("public");
                  }}
                >
                  {injectionPending === "public" ? "Injecting..." : "Inject public tasks"}
                </button>
                <JsonPreviewCard
                  title="Public Injection Preview"
                  data={publicInjectionPreview}
                  emptyLabel="Runtime public preview is required before injection artifacts can be shaped."
                />
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            {injectionError ? (
              <SectionCard title="Injection Result">
                <p className="text-error text-sm">{injectionError}</p>
              </SectionCard>
            ) : (
              <SectionCard title="Injection Result">
                <p className="text-base-content/70 text-sm">
                  Trigger notification or public injection to inspect the shared admin response.
                </p>
              </SectionCard>
            )}
            <JsonPreviewCard
              title="Injection API Result"
              data={injectionResponse}
              emptyLabel="Trigger an intake injection request to inspect the admin API response."
            />
          </div>
        </div>
      ) : null}

      {activeSection === "tasks" ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <SectionCard title="Tasks">
              <div className="text-base-content/75 space-y-3 text-sm">
                <p>Queue inspection is now drill-down capable through the shared task snapshot.</p>
                <p>
                  Write actions still wait for the execute slice, but detail metadata is already
                  visible.
                </p>
                {recentTasks.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="table-sm table">
                      <thead>
                        <tr>
                          <th>Persona</th>
                          <th>Task</th>
                          <th>Status</th>
                          <th>Dispatch</th>
                          <th>Scheduled</th>
                          <th>Retries</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentTasks.map((task) => {
                          const isSelected = task.id === selectedTask?.id;
                          return (
                            <tr
                              key={task.id}
                              className={isSelected ? "bg-base-200" : undefined}
                              onClick={() => {
                                setSelectedTaskId(task.id);
                                setQueueActionPending(null);
                                setQueueActionError(null);
                                setQueueActionResponse(null);
                              }}
                            >
                              <td>
                                {task.personaUsername ?? task.personaDisplayName ?? task.personaId}
                              </td>
                              <td className="space-y-1">
                                <div className="text-base-content font-medium">{task.taskType}</div>
                                <div className="text-base-content/60 text-xs">
                                  {task.decisionReason ?? "No decision reason"}
                                </div>
                              </td>
                              <td>{task.status}</td>
                              <td>{task.dispatchKind}</td>
                              <td>{formatShortDateTime(task.scheduledAt)}</td>
                              <td>
                                {task.retryCount}/{task.maxRetries}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-base-content/70 text-sm">
                    No queued tasks have been recorded yet.
                  </p>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Task Detail">
              {selectedTask ? (
                renderTaskDetail(selectedTask)
              ) : (
                <p className="text-base-content/70 text-sm">
                  Select a task to inspect detail metadata.
                </p>
              )}
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <SectionCard title="Queue Actions">
              {selectedTaskQueueActions ? (
                <div className="space-y-3 text-sm">
                  {selectedTaskQueueActions.actions.map((action) => (
                    <div key={action.action} className="border-base-300 rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-base-content font-medium">{action.action}</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-xs"
                            disabled={queueActionPending !== null}
                            onClick={() => {
                              void handleQueueAction(action.action, "preview");
                            }}
                          >
                            {queueActionPending === `preview:${action.action}`
                              ? "Loading..."
                              : "Preview"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-neutral"
                            disabled={queueActionPending !== null || !action.enabled}
                            onClick={() => {
                              void handleQueueAction(action.action, "execute");
                            }}
                          >
                            {queueActionPending === `execute:${action.action}`
                              ? "Executing..."
                              : "Execute"}
                          </button>
                        </div>
                      </div>
                      <div className="text-base-content/70 mt-2">{action.reason}</div>
                      <div className="text-base-content/60 mt-2 text-xs">
                        {action.statusTransition.from} → {action.statusTransition.to}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-base-content/70 text-sm">
                  Select a task to inspect guarded queue actions.
                </p>
              )}
            </SectionCard>

            <div className="space-y-4">
              {queueActionError ? (
                <SectionCard title="Queue Action Result">
                  <p className="text-error text-sm">{queueActionError}</p>
                </SectionCard>
              ) : null}
              <JsonPreviewCard
                title="Queue Action Preview"
                data={selectedTaskQueueActions}
                emptyLabel="Select a task to inspect retry, requeue, and mark-dead action previews."
              />
              <JsonPreviewCard
                title="Queue Action API Result"
                data={queueActionResponse}
                emptyLabel="Trigger a queue action preview or execute request to inspect the real admin API response."
              />
            </div>
          </div>
        </div>
      ) : null}

      {activeSection === "run" ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Run orchestrator once", target: "orchestrator_once" as const },
              { label: "Run next text task", target: "text_once" as const },
              { label: "Run next media task", target: "media_once" as const },
              { label: "Run next compression batch", target: "compress_once" as const },
            ].map((item) => (
              <SectionCard key={item.target} title={item.label}>
                <div className="text-base-content/75 space-y-3 text-sm">
                  <p>{describeRunnerTarget(item.target)}</p>
                  <div className="grid gap-2">
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={runnerPending !== null}
                      onClick={() => {
                        void handleRunnerAction(item.target, "preview");
                      }}
                    >
                      {runnerPending === `preview:${item.target}` ? "Loading..." : "Preview"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-neutral"
                      disabled={runnerPending !== null}
                      onClick={() => {
                        void handleRunnerAction(item.target, "execute");
                      }}
                    >
                      {runnerPending === `execute:${item.target}` ? "Executing..." : "Execute"}
                    </button>
                  </div>
                </div>
              </SectionCard>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <SectionCard title="Selected Task Execution">
              {activeRunExecutionPreview ? (
                <div className="text-base-content/75 space-y-4 text-sm">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setRunPromptModalOpen(true)}
                    >
                      View Prompt
                    </button>
                  </div>
                  <p>
                    {runnerResponse
                      ? "Runner response is currently driving the execution artifact surface."
                      : "Read-only execution preview is currently derived from the selected queue row."}
                  </p>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                        Task Id
                      </dt>
                      <dd className="text-base-content mt-1 font-medium">
                        {activeRunExecutionPreview.taskCandidate.sourceId}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                        Persona
                      </dt>
                      <dd className="text-base-content mt-1 font-medium">
                        {activeRunExecutionPreview.personaContext.username}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                        Action Type
                      </dt>
                      <dd className="text-base-content mt-1 font-medium">
                        {activeRunExecutionPreview.promptInput.actionType}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-base-content/50 text-xs tracking-wide uppercase">
                        Dispatch
                      </dt>
                      <dd className="text-base-content mt-1 font-medium">
                        {activeRunExecutionPreview.sourceContext.dispatchKind}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="text-base-content/70 text-sm">
                  Select a task in `Tasks` first to inspect staged execution artifacts.
                </p>
              )}
            </SectionCard>

            <SectionCard title="Execution Preview">
              <PreviewPanel
                preview={activeRunExecutionPreview?.previewSurface ?? null}
                emptyLabel="Select a task to inspect rendered output, prompt, raw response, and audit."
              />
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            {runnerError ? (
              <SectionCard title="Runner Result">
                <p className="text-error text-sm">{runnerError}</p>
              </SectionCard>
            ) : (
              <SectionCard title="Runner Result">
                <p className="text-base-content/70 text-sm">
                  Trigger a runner preview or execute request to inspect the shared admin response.
                </p>
              </SectionCard>
            )}
            <JsonPreviewCard
              title="Run API Result"
              data={runnerResponse}
              emptyLabel="Trigger a runner preview or execute request to inspect the admin API response."
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <JsonPreviewCard
              title="Run Prompt Input"
              data={activeRunExecutionPreview?.promptInput ?? null}
              emptyLabel="Select a task to inspect canonical execution input."
            />
            <JsonPreviewCard
              title="Run Parsed Output"
              data={activeRunExecutionPreview?.parsedOutput ?? null}
              emptyLabel="Select a task to inspect parsed execution output."
            />
            <JsonPreviewCard
              title="Run Audit Output"
              data={activeRunExecutionPreview?.auditedOutput ?? null}
              emptyLabel="Select a task to inspect audit output."
            />
            <JsonPreviewCard
              title="Run Deterministic Checks"
              data={activeRunExecutionPreview?.deterministicChecks ?? null}
              emptyLabel="Select a task to inspect schema and deterministic checks."
            />
            <JsonPreviewCard
              title="Run Write Plan"
              data={activeRunExecutionPreview?.writePlan ?? null}
              emptyLabel="Select a task to inspect write planning."
            />
            <JsonPreviewCard
              title="Run Source Context"
              data={activeRunExecutionPreview?.sourceContext ?? null}
              emptyLabel="Select a task to inspect source linkage and summary."
            />
          </div>

          <JsonPreviewCard
            title="Task Memory Lineage"
            data={memoryLineageSummary}
            emptyLabel="Select a task or execute compression to compare runner results with latest-write and compression traces."
          />
          <JsonPreviewCard
            title="Task Memory Outcome Trace"
            data={memoryOutcomeTrace}
            emptyLabel="Select a task and persist latest write or compression to inspect the full task-to-memory outcome path."
          />
          <JsonPreviewCard
            title="Operator Flow Trace"
            data={operatorFlowTrace}
            emptyLabel="Inject tasks, execute a runner action, and persist memory to inspect the end-to-end operator flow."
          />

          <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <SectionCard title="Run Memory Verification">
              {runMemoryVerificationTrace ? (
                <div className="text-base-content/80 space-y-3 text-sm">
                  <div className="text-base-content/50 text-xs tracking-wide uppercase">
                    Memory Verification Trace
                  </div>
                  <pre className="bg-base-200 max-h-56 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                    {JSON.stringify(runMemoryVerificationTrace, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-base-content/70 text-sm">
                  Execute a compression-capable runner action to inspect persisted memory
                  verification in the run surface.
                </p>
              )}
            </SectionCard>
            <JsonPreviewCard
              title="Run Compression Result"
              data={runnerResponse?.mode === "executed" ? runnerResponse.compressionResult : null}
              emptyLabel="Execute a compression-capable runner action to inspect raw compression result payload."
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <SectionCard title="Media Result">
              {runnerResponse && "mediaResult" in runnerResponse && runnerResponse.mediaResult ? (
                <div className="text-base-content/80 space-y-3 text-sm">
                  <p>
                    Status:{" "}
                    <span className="text-base-content font-medium">
                      {runnerResponse.mediaResult.status}
                    </span>
                  </p>
                  <p>
                    Owner:{" "}
                    <span className="text-base-content font-medium">
                      {runnerResponse.mediaResult.ownerTable.slice(0, -1)}{" "}
                      {runnerResponse.mediaResult.ownerId}
                    </span>
                  </p>
                  <p>
                    Media Id:{" "}
                    <span className="text-base-content font-medium">
                      {runnerResponse.mediaResult.mediaId}
                    </span>
                  </p>
                  {runnerResponse.mediaResult.url ? (
                    <a
                      className="link link-primary break-all"
                      href={runnerResponse.mediaResult.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {runnerResponse.mediaResult.url}
                    </a>
                  ) : (
                    <p className="text-base-content/60">No uploaded URL is available yet.</p>
                  )}
                </div>
              ) : (
                <p className="text-base-content/70 text-sm">
                  Execute a media-capable runner action to inspect completed media output.
                </p>
              )}
            </SectionCard>
            <JsonPreviewCard
              title="Run Media Result JSON"
              data={
                runnerResponse && "mediaResult" in runnerResponse
                  ? runnerResponse.mediaResult
                  : null
              }
              emptyLabel="Execute a media-capable runner action to inspect raw media result payload."
            />
          </div>
        </div>
      ) : null}

      {activeSection === "memory" ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <SectionCard title="Persona Memory">
              {memoryPreviewSet?.personas.length ? (
                <div className="space-y-4">
                  <label className="form-control gap-2">
                    <span className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
                      Persona
                    </span>
                    <select
                      className="select select-bordered"
                      value={activeMemoryPreview?.persona.personaId ?? ""}
                      onChange={(event) => setSelectedMemoryPersonaId(event.target.value)}
                    >
                      {memoryPreviewSet.personas.map((persona) => (
                        <option key={persona.personaId} value={persona.personaId}>
                          {persona.displayName} (@{persona.username})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={memoryPending !== null}
                      onClick={() => {
                        void handleMemoryAction("refresh");
                      }}
                    >
                      {memoryPending === "refresh" ? "Refreshing..." : "Refresh persona memory"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={memoryPending !== null}
                      onClick={() => {
                        void handleMemoryAction("latest-write");
                      }}
                    >
                      {memoryPending === "latest-write" ? "Loading..." : "Preview latest write"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      disabled={memoryPending !== null}
                      onClick={() => {
                        void handleMemoryAction("persist-latest-write");
                      }}
                    >
                      {memoryPending === "persist-latest-write"
                        ? "Persisting..."
                        : "Persist latest write"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={memoryPending !== null}
                      onClick={() => {
                        void handleMemoryAction("compression-batch");
                      }}
                    >
                      {memoryPending === "compression-batch"
                        ? "Loading..."
                        : "Preview compression batch"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-neutral"
                      disabled={memoryPending !== null}
                      onClick={() => {
                        void handleMemoryAction("preview-compression");
                      }}
                    >
                      {memoryPending === "preview-compression"
                        ? "Running..."
                        : "Run compression preview"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      disabled={memoryPending !== null}
                      onClick={() => {
                        void handleMemoryAction("compress");
                      }}
                    >
                      {memoryPending === "compress" ? "Persisting..." : "Persist compression"}
                    </button>
                  </div>

                  {activeMemoryPreview ? (
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div className="border-base-300 rounded-lg border p-3">
                        <div className="text-base-content/50 text-xs tracking-wide uppercase">
                          Short Memory
                        </div>
                        <div className="text-base-content mt-1 text-xl font-semibold">
                          {activeMemoryPreview.persona.shortMemoryCount}
                        </div>
                      </div>
                      <div className="border-base-300 rounded-lg border p-3">
                        <div className="text-base-content/50 text-xs tracking-wide uppercase">
                          Compressible
                        </div>
                        <div className="text-base-content mt-1 text-xl font-semibold">
                          {activeMemoryPreview.persona.compressibleCount}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-base-content/70 text-sm">
                  Runtime memory preview is unavailable in this slice.
                </p>
              )}
            </SectionCard>

            <SectionCard title="Canonical Long Memory">
              {activeMemoryPreview?.canonicalLongMemory ? (
                <div className="text-base-content/80 space-y-3 text-sm">
                  <p className="whitespace-pre-wrap">
                    {activeMemoryPreview.canonicalLongMemory.content}
                  </p>
                  <div className="text-base-content/60 text-xs">
                    Updated {formatDateTime(activeMemoryPreview.canonicalLongMemory.updatedAt)}
                  </div>
                </div>
              ) : (
                <p className="text-base-content/70 text-sm">
                  No canonical long-memory row is available for the selected persona.
                </p>
              )}
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionCard title="Recent Short Memories">
              {activeMemoryPreview?.recentShortMemories.length ? (
                <div className="overflow-x-auto">
                  <table className="table-sm table">
                    <thead>
                      <tr>
                        <th>Scope</th>
                        <th>Importance</th>
                        <th>Source</th>
                        <th>Open Loop</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMemoryPreview.recentShortMemories.map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            <div className="font-medium">{entry.scope}</div>
                            <div className="text-base-content/60 text-xs">{entry.content}</div>
                          </td>
                          <td>{entry.importance ?? "n/a"}</td>
                          <td>{entry.sourceKind ?? "n/a"}</td>
                          <td>{entry.hasOpenLoop ? "yes" : "no"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-base-content/70 text-sm">
                  No short-memory rows are available for the selected persona.
                </p>
              )}
            </SectionCard>
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!activeMemoryPreview}
                  onClick={() => setOpenMemoryArtifact("latest-write")}
                >
                  View latest write detail
                </button>
              </div>
              <JsonPreviewCard
                title="Latest Write Preview"
                data={activeMemoryPreview?.latestWritePreview ?? null}
                emptyLabel="Select a persona to inspect latest memory-write preview."
              />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!activeMemoryPreview}
                  onClick={() => setOpenMemoryArtifact("compression-batch")}
                >
                  View compression batch detail
                </button>
              </div>
              <JsonPreviewCard
                title="Compression Batch Preview"
                data={activeMemoryPreview?.compressionBatchPreview ?? null}
                emptyLabel="Select a persona to inspect compression-batch selection."
              />
            </div>
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!activeMemoryPreview}
                  onClick={() => setOpenMemoryArtifact("compression-output")}
                >
                  View compression output detail
                </button>
              </div>
              <JsonPreviewCard
                title="Compression Output Preview"
                data={activeMemoryPreview?.compressionPreview ?? null}
                emptyLabel="Select a persona to inspect compression output and cleanup preview."
              />
            </div>
          </div>

          <SectionCard title="Rendered Long-Memory Preview">
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!activeMemoryPreview}
                  onClick={() => setOpenMemoryArtifact("rendered-long-memory")}
                >
                  View rendered long memory
                </button>
              </div>
              {activeMemoryPreview ? (
                <pre className="bg-base-200 max-h-[420px] overflow-auto rounded-lg p-4 text-sm whitespace-pre-wrap">
                  {activeMemoryPreview.compressionPreview.renderedLongMemory}
                </pre>
              ) : (
                <p className="text-base-content/70 text-sm">
                  Select a persona to inspect rendered long memory.
                </p>
              )}
            </div>
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            {memoryError ? (
              <SectionCard title="Memory Result">
                <p className="text-error text-sm">{memoryError}</p>
              </SectionCard>
            ) : (
              <SectionCard title="Memory Result">
                {activeMemoryVerificationTrace ? (
                  <div className="text-base-content/80 space-y-3 text-sm">
                    <div className="text-base-content/50 text-xs tracking-wide uppercase">
                      Memory Verification Trace
                    </div>
                    <pre className="bg-base-200 max-h-56 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
                      {JSON.stringify(activeMemoryVerificationTrace, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <p className="text-base-content/70 text-sm">
                    Trigger memory actions to inspect refresh and guarded compress responses.
                  </p>
                )}
              </SectionCard>
            )}
            <JsonPreviewCard
              title="Memory API Result"
              data={memoryApiResult}
              emptyLabel="Trigger a memory action to inspect the admin API response."
            />
          </div>

          <JsonPreviewCard
            title="Task Memory Lineage"
            data={memoryLineageSummary}
            emptyLabel="Select a task and trigger memory actions to compare task lineage with latest-write and compression traces."
          />
          <JsonPreviewCard
            title="Task Memory Outcome Trace"
            data={memoryOutcomeTrace}
            emptyLabel="Select a task and persist latest write or compression to inspect the full task-to-memory outcome path."
          />
          <JsonPreviewCard
            title="Operator Flow Trace"
            data={operatorFlowTrace}
            emptyLabel="Inject tasks, execute a runner action, and persist memory to inspect the end-to-end operator flow."
          />

          <ArtifactDetailModal
            detail={activeMemoryArtifactDetail}
            onClose={() => setOpenMemoryArtifact(null)}
          />
        </div>
      ) : null}

      <PromptDetailModal
        open={runPromptModalOpen && activeRunExecutionPreview !== null}
        title="Run Prompt Detail"
        description="Operator-visible prompt modal for the currently active execution preview."
        assembledPrompt={activeRunExecutionPreview?.actualModelPayload.assembledPrompt ?? ""}
        modelPayload={activeRunExecutionPreview?.actualModelPayload ?? null}
        promptInput={activeRunExecutionPreview?.promptInput ?? null}
        onClose={() => setRunPromptModalOpen(false)}
      />
      <PromptDetailModal
        open={intakePromptModalKind !== null && activeIntakePromptArtifacts !== null}
        title="Intake Prompt Detail"
        description="Operator-visible prompt modal for the currently active intake selector preview."
        assembledPrompt={activeIntakePromptArtifacts?.selectorOutput.promptPreview ?? ""}
        modelPayload={activeIntakePromptArtifacts?.selectorOutput.actualModelPayload ?? null}
        promptInput={activeIntakePromptArtifacts?.selectorInput ?? null}
        onClose={() => setIntakePromptModalKind(null)}
      />

      {activeSection === "logs" ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr_0.9fr]">
          <SectionCard title="Logs">
            <div className="text-base-content/75 space-y-3 text-sm">
              <p>
                Recent orchestrator runs are now drill-down capable through the shared run snapshot.
              </p>
              <p>
                Last recorded run:{" "}
                {formatOptionalDateTime(initialSnapshot.latestRun?.runAt ?? null)}
              </p>
              {initialSnapshot.recentRuns.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="table-sm table">
                    <thead>
                      <tr>
                        <th>Run At</th>
                        <th>Window</th>
                        <th>Comments</th>
                        <th>Posts</th>
                        <th>Skipped Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {initialSnapshot.recentRuns.map((run) => {
                        const runId = `${run.runAt}-${run.snapshotFrom}`;
                        const isSelected = runId === selectedRunId;
                        return (
                          <tr
                            key={runId}
                            className={isSelected ? "bg-base-200" : undefined}
                            onClick={() => setSelectedRunId(runId)}
                          >
                            <td>{formatShortDateTime(run.runAt)}</td>
                            <td>
                              {formatShortDateTime(run.snapshotFrom)} to{" "}
                              {formatShortDateTime(run.snapshotTo)}
                            </td>
                            <td>{run.commentsInjected}</td>
                            <td>{run.postsInjected}</td>
                            <td>{run.skippedReason ?? "executed"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-base-content/70 text-sm">
                  No orchestrator runs have been recorded yet.
                </p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Log Detail">
            {selectedRun ? (
              renderRunDetail(selectedRun)
            ) : (
              <p className="text-base-content/70 text-sm">
                Select a run to inspect snapshot metadata and structured diagnostics.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Media Jobs">
            <div className="text-base-content/75 space-y-3 text-sm">
              <p>
                Recent generated-media rows are now inspectable through the shared overview
                snapshot.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="select select-sm select-bordered"
                  value={mediaStatusFilter}
                  onChange={(event) =>
                    setMediaStatusFilter(
                      event.target.value as
                        | "all"
                        | "PENDING_GENERATION"
                        | "RUNNING"
                        | "DONE"
                        | "FAILED",
                    )
                  }
                >
                  <option value="all">All statuses</option>
                  <option value="PENDING_GENERATION">Pending</option>
                  <option value="RUNNING">Running</option>
                  <option value="DONE">Done</option>
                  <option value="FAILED">Failed</option>
                </select>
                <input
                  type="text"
                  className="input input-sm input-bordered w-56"
                  placeholder="Search persona, owner, prompt"
                  value={mediaSearchInput}
                  onInput={(event) => setMediaSearchInput((event.target as HTMLInputElement).value)}
                  onChange={(event) => setMediaSearchInput(event.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => void handleApplyMediaFilters()}
                  disabled={mediaJobsPending}
                >
                  {mediaJobsPending ? "Applying filters..." : "Apply filters"}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => void handleLoadMoreMediaJobs()}
                  disabled={mediaJobsPending || mediaListLimit >= 48}
                >
                  Load more
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    setMediaListLimit(12);
                    setMediaStatusFilter("all");
                    setMediaSearchInput("");
                  }}
                  disabled={mediaJobsPending}
                >
                  Reset
                </button>
                <span>
                  {`limit ${mediaListLimit} · pending ${mediaJobsApiResult?.summary.pending ?? recentMediaJobs.filter((job) => job.status === "PENDING_GENERATION").length} · running ${mediaJobsApiResult?.summary.running ?? recentMediaJobs.filter((job) => job.status === "RUNNING").length} · done ${mediaJobsApiResult?.summary.done ?? recentMediaJobs.filter((job) => job.status === "DONE").length} · failed ${mediaJobsApiResult?.summary.failed ?? recentMediaJobs.filter((job) => job.status === "FAILED").length}`}
                </span>
              </div>
              {mediaJobsError ? <p className="text-error text-sm">{mediaJobsError}</p> : null}
              {recentMediaJobs.length > 0 ? (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="table-sm table">
                      <thead>
                        <tr>
                          <th>Created</th>
                          <th>Status</th>
                          <th>Owner</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentMediaJobs.map((job) => {
                          const isSelected = job.id === selectedMediaJobId;
                          return (
                            <tr
                              key={job.id}
                              className={isSelected ? "bg-base-200" : undefined}
                              onClick={() => setSelectedMediaJobId(job.id)}
                            >
                              <td>{formatShortDateTime(job.createdAt)}</td>
                              <td>{job.status}</td>
                              <td>
                                {job.commentId
                                  ? `comment ${job.commentId}`
                                  : job.postId
                                    ? `post ${job.postId}`
                                    : "n/a"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {selectedMediaJob ? renderMediaJobDetail(selectedMediaJob) : null}
                </div>
              ) : (
                <p className="text-base-content/70 text-sm">
                  No media jobs have been recorded yet.
                </p>
              )}
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
