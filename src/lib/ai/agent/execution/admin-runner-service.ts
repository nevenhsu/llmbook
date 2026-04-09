import { createAdminClient } from "@/lib/supabase/admin";
import {
  AiAgentRuntimeControlService,
  buildRuntimeControlGuard,
  type AiAgentRuntimeControlResponse,
} from "@/lib/ai/agent/runtime-control-service";
import {
  AiAgentRuntimeStateService,
  type AiAgentRuntimeStateSnapshot,
} from "@/lib/ai/agent/runtime-state-service";
import {
  buildExecutionPreviewFromTask,
  type AiAgentExecutionPreview,
} from "@/lib/ai/agent/execution/execution-preview";
import {
  AiAgentMediaJobService,
  type AiAgentMediaExecutionPersistedResult,
} from "@/lib/ai/agent/execution/media-job-service";
import { type AiAgentTextExecutionPersistedResult } from "@/lib/ai/agent/execution/persona-task-execution-service";
import {
  AiAgentTextRuntimeGuardError,
  AiAgentTextRuntimeService,
  type AiAgentTextRuntimePreviewResult,
} from "@/lib/ai/agent/execution/text-runtime-service";
import {
  AiAgentMemoryCompressorService,
  type AiAgentMemoryPersistedCompressResponse,
} from "@/lib/ai/agent/memory";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";

type PersonaIdentityRow = {
  id: string;
  username: string | null;
  display_name: string | null;
};

type TaskRow = {
  id: string;
  persona_id: string;
  task_type: string;
  dispatch_kind: string;
  source_table: string | null;
  source_id: string | null;
  dedupe_key: string | null;
  cooldown_until: string | null;
  payload: Record<string, unknown> | null;
  status: AiAgentRecentTaskSnapshot["status"];
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
  max_retries: number;
  lease_owner: string | null;
  lease_until: string | null;
  result_id: string | null;
  result_type: string | null;
  error_message: string | null;
  created_at: string;
};

type AdminRunnerServiceDeps = {
  loadTaskById: (taskId: string) => Promise<AiAgentRecentTaskSnapshot | null>;
  compressNextPersona: () => Promise<AiAgentMemoryPersistedCompressResponse | null>;
  previewTextTask: (taskId: string) => Promise<AiAgentTextRuntimePreviewResult>;
  executeTextTaskById: (taskId: string) => Promise<AiAgentTextExecutionPersistedResult>;
  executeMediaTask: (
    task: AiAgentRecentTaskSnapshot,
  ) => Promise<AiAgentMediaExecutionPersistedResult>;
  loadRuntimeState: () => Promise<AiAgentRuntimeStateSnapshot>;
  requestManualPhaseA: (input: { requestedBy: string }) => Promise<AiAgentRuntimeControlResponse>;
};

export type AiAgentRunnerTarget =
  | "orchestrator_once"
  | "text_once"
  | "media_once"
  | "compress_once";

export type AiAgentRunnerPreviewResponse = {
  mode: "preview";
  target: AiAgentRunnerTarget;
  targetLabel: string;
  available: boolean;
  blocker: string | null;
  selectedTaskId: string | null;
  summary: string;
  executionPreview: AiAgentExecutionPreview | null;
};

export type AiAgentRunnerGuardedExecuteResponse = {
  mode: "guarded_execute";
  target: AiAgentRunnerTarget;
  targetLabel: string;
  blocker: string;
  selectedTaskId: string | null;
  summary: string;
  executionPreview: AiAgentExecutionPreview | null;
};

export type AiAgentRunnerExecutedResponse = {
  mode: "executed";
  target: AiAgentRunnerTarget;
  targetLabel: string;
  selectedTaskId: string | null;
  summary: string;
  executionPreview: AiAgentExecutionPreview | null;
  compressionResult: AiAgentMemoryPersistedCompressResponse | null;
  textResult: AiAgentTextExecutionPersistedResult | null;
  mediaResult: AiAgentMediaExecutionPersistedResult | null;
  orchestratorResult: AiAgentOrchestratorExecutedResult | null;
};

export type AiAgentOrchestratorExecutedResult = {
  runtimeState: AiAgentRuntimeStateSnapshot;
};

export type { AiAgentTextExecutionPersistedResult } from "@/lib/ai/agent/execution/persona-task-persistence-service";

export type AiAgentRunnerResponse =
  | AiAgentRunnerPreviewResponse
  | AiAgentRunnerGuardedExecuteResponse
  | AiAgentRunnerExecutedResponse;

function getRunnerLabel(target: AiAgentRunnerTarget): string {
  switch (target) {
    case "orchestrator_once":
      return "Request Phase A";
    case "text_once":
      return "Run next text task";
    case "media_once":
      return "Run next media task";
    case "compress_once":
      return "Run next compression batch";
  }
}

export class AiAgentAdminRunnerService {
  private readonly deps: AdminRunnerServiceDeps;

  public constructor(options?: { deps?: Partial<AdminRunnerServiceDeps> }) {
    const loadTaskById = options?.deps?.loadTaskById ?? ((taskId) => this.readTaskById(taskId));
    const textRuntimeService = new AiAgentTextRuntimeService({
      deps: {
        loadTaskById,
      },
    });
    this.deps = {
      loadTaskById,
      compressNextPersona:
        options?.deps?.compressNextPersona ??
        (async () => {
          const result = await new AiAgentMemoryCompressorService().runNext();
          return result.mode === "executed" ? result.compressionResult : null;
        }),
      previewTextTask:
        options?.deps?.previewTextTask ?? ((taskId) => textRuntimeService.previewTask(taskId)),
      executeTextTaskById:
        options?.deps?.executeTextTaskById ?? ((taskId) => textRuntimeService.executeTask(taskId)),
      executeMediaTask:
        options?.deps?.executeMediaTask ??
        ((task) => new AiAgentMediaJobService().executeForTask(task)),
      loadRuntimeState:
        options?.deps?.loadRuntimeState ?? (() => new AiAgentRuntimeStateService().loadSnapshot()),
      requestManualPhaseA:
        options?.deps?.requestManualPhaseA ??
        ((input) => new AiAgentRuntimeControlService().execute("run_phase_a", input)),
    };
  }

  public async previewTarget(input: {
    target: AiAgentRunnerTarget;
    taskId?: string | null;
  }): Promise<AiAgentRunnerPreviewResponse> {
    if (input.target === "text_once") {
      if (!input.taskId) {
        return {
          mode: "preview",
          target: input.target,
          targetLabel: getRunnerLabel(input.target),
          available: false,
          blocker: "selected_task_required",
          selectedTaskId: null,
          summary: "Select a queue row before previewing text-task execution.",
          executionPreview: null,
        };
      }

      const textPreview = await this.deps.previewTextTask(input.taskId);

      return {
        mode: "preview",
        target: input.target,
        targetLabel: getRunnerLabel(input.target),
        available: textPreview.available,
        blocker: textPreview.blocker,
        selectedTaskId: textPreview.selectedTaskId,
        summary: textPreview.summary,
        executionPreview: textPreview.executionPreview,
      };
    }

    const task = input.taskId ? await this.deps.loadTaskById(input.taskId) : null;
    if (input.taskId && !task) {
      throw new Error("task not found");
    }

    if (input.target === "media_once") {
      if (!task) {
        return {
          mode: "preview",
          target: input.target,
          targetLabel: getRunnerLabel(input.target),
          available: false,
          blocker: "selected_task_required",
          selectedTaskId: null,
          summary: "Select a completed text queue row before previewing media generation.",
          executionPreview: null,
        };
      }

      const executionPreview = buildExecutionPreviewFromTask(task);
      if (!executionPreview.writePlan.mediaWrite) {
        return {
          mode: "preview",
          target: input.target,
          targetLabel: getRunnerLabel(input.target),
          available: false,
          blocker: "image_request_missing",
          selectedTaskId: task.id,
          summary:
            "The selected task does not request image generation, so no media job would be created.",
          executionPreview,
        };
      }

      if (task.status !== "DONE" || !task.resultId || !task.resultType) {
        return {
          mode: "preview",
          target: input.target,
          targetLabel: getRunnerLabel(input.target),
          available: false,
          blocker: "persisted_owner_required",
          selectedTaskId: task.id,
          summary:
            "Media generation currently requires a completed text task with a persisted post or comment owner.",
          executionPreview,
        };
      }

      return {
        mode: "preview",
        target: input.target,
        targetLabel: getRunnerLabel(input.target),
        available: true,
        blocker: null,
        selectedTaskId: task.id,
        summary:
          "Shared execution preview includes a ready media write-plan for the selected completed task.",
        executionPreview,
      };
    }

    if (input.target === "orchestrator_once") {
      const runtimeState = await this.deps.loadRuntimeState();
      const guard = buildRuntimeControlGuard("run_phase_a", runtimeState);
      return {
        mode: "preview",
        target: input.target,
        targetLabel: getRunnerLabel(input.target),
        available: guard.canExecute,
        blocker: guard.reasonCode,
        selectedTaskId: null,
        summary: guard.canExecute
          ? "Dispatches a manual Phase A request to the runtime app; the web server does not execute Phase A inline."
          : guard.summary,
        executionPreview: null,
      };
    }

    return {
      mode: "preview",
      target: input.target,
      targetLabel: getRunnerLabel(input.target),
      available: false,
      blocker: "runtime_entrypoint_missing",
      selectedTaskId: task?.id ?? null,
      summary: `${getRunnerLabel(input.target)} is still blocked because this repo slice does not yet include that runtime entrypoint.`,
      executionPreview: null,
    };
  }

  public async executeTarget(input: {
    target: AiAgentRunnerTarget;
    taskId?: string | null;
    requestedBy?: string | null;
  }): Promise<AiAgentRunnerGuardedExecuteResponse | AiAgentRunnerExecutedResponse> {
    if (input.target === "orchestrator_once") {
      const result = await this.deps.requestManualPhaseA({
        requestedBy: input.requestedBy ?? "admin:orchestrator_once",
      });

      if (result.mode === "blocked_execute") {
        return {
          mode: "guarded_execute",
          target: input.target,
          targetLabel: getRunnerLabel(input.target),
          blocker: result.reasonCode,
          selectedTaskId: null,
          summary: result.summary,
          executionPreview: null,
        };
      }

      return {
        mode: "executed",
        target: input.target,
        targetLabel: getRunnerLabel(input.target),
        selectedTaskId: null,
        summary: result.summary,
        executionPreview: null,
        compressionResult: null,
        textResult: null,
        mediaResult: null,
        orchestratorResult: {
          runtimeState: result.runtimeState,
        },
      };
    }

    if (input.target === "text_once") {
      const preview = await this.previewTarget(input);
      if (!preview.selectedTaskId || !preview.executionPreview) {
        return {
          mode: "guarded_execute",
          target: input.target,
          targetLabel: preview.targetLabel,
          blocker: preview.blocker ?? "selected_task_required",
          selectedTaskId: preview.selectedTaskId,
          summary: "Select a queue row before executing text-task persistence.",
          executionPreview: preview.executionPreview,
        };
      }

      let textResult: AiAgentTextExecutionPersistedResult;
      try {
        textResult = await this.deps.executeTextTaskById(preview.selectedTaskId);
      } catch (error) {
        if (error instanceof AiAgentTextRuntimeGuardError) {
          return {
            mode: "guarded_execute",
            target: input.target,
            targetLabel: preview.targetLabel,
            blocker: error.reasonCode,
            selectedTaskId: preview.selectedTaskId,
            summary: error.message,
            executionPreview: preview.executionPreview,
          };
        }
        throw error;
      }
      return {
        mode: "executed",
        target: input.target,
        targetLabel: preview.targetLabel,
        selectedTaskId: preview.selectedTaskId,
        summary:
          textResult.writeMode === "overwritten"
            ? `Overwrote ${textResult.resultType} ${textResult.persistedId} and completed queue task ${preview.selectedTaskId}.`
            : `Persisted ${textResult.resultType} ${textResult.persistedId} and completed queue task ${preview.selectedTaskId}.`,
        executionPreview: buildExecutionPreviewFromTask(textResult.updatedTask),
        compressionResult: null,
        textResult,
        mediaResult: null,
        orchestratorResult: null,
      };
    }

    if (input.target === "media_once") {
      const preview = await this.previewTarget(input);
      if (!preview.available || !preview.selectedTaskId || !preview.executionPreview) {
        return {
          mode: "guarded_execute",
          target: input.target,
          targetLabel: preview.targetLabel,
          blocker: preview.blocker ?? "selected_task_required",
          selectedTaskId: preview.selectedTaskId,
          summary: preview.summary,
          executionPreview: preview.executionPreview,
        };
      }

      const task = await this.deps.loadTaskById(preview.selectedTaskId);
      if (!task) {
        throw new Error("task not found");
      }

      const mediaResult = await this.deps.executeMediaTask(task);
      return {
        mode: "executed",
        target: input.target,
        targetLabel: preview.targetLabel,
        selectedTaskId: task.id,
        summary:
          mediaResult.status === "DONE" && mediaResult.url
            ? `Generated media ${mediaResult.mediaId} for ${mediaResult.ownerTable.slice(0, -1)} ${mediaResult.ownerId}.`
            : `Created media job ${mediaResult.mediaId} for ${mediaResult.ownerTable.slice(0, -1)} ${mediaResult.ownerId}.`,
        executionPreview: preview.executionPreview,
        compressionResult: null,
        textResult: null,
        mediaResult,
        orchestratorResult: null,
      };
    }

    if (input.target === "compress_once") {
      const result = await this.deps.compressNextPersona();
      return {
        mode: "executed",
        target: input.target,
        targetLabel: getRunnerLabel(input.target),
        selectedTaskId: null,
        summary: result
          ? `Persisted compression for ${result.personaId} and removed ${result.deletedShortMemoryIds.length} short-memory rows.`
          : "No persona currently needs a compression pass right now.",
        executionPreview: null,
        compressionResult: result,
        textResult: null,
        mediaResult: null,
        orchestratorResult: null,
      };
    }

    const preview = await this.previewTarget(input);

    return {
      mode: "guarded_execute",
      target: input.target,
      targetLabel: preview.targetLabel,
      blocker: "runtime entrypoint is not implemented in this repo slice",
      selectedTaskId: preview.selectedTaskId,
      summary: `${preview.targetLabel} is still guarded; preview artifacts are available, but live runner execution is not wired yet.`,
      executionPreview: preview.executionPreview,
    };
  }

  private async readTaskById(taskId: string): Promise<AiAgentRecentTaskSnapshot | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("persona_tasks")
      .select(
        "id, persona_id, task_type, dispatch_kind, source_table, source_id, dedupe_key, cooldown_until, payload, status, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, result_id, result_type, error_message, created_at",
      )
      .eq("id", taskId)
      .maybeSingle<TaskRow>();

    if (error) {
      throw new Error(`load persona_task failed: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const { data: persona, error: personaError } = await supabase
      .from("personas")
      .select("id, username, display_name")
      .eq("id", data.persona_id)
      .maybeSingle<PersonaIdentityRow>();

    if (personaError) {
      throw new Error(`load task persona identity failed: ${personaError.message}`);
    }

    return {
      id: data.id,
      personaId: data.persona_id,
      personaUsername: persona?.username ?? null,
      personaDisplayName: persona?.display_name ?? null,
      taskType: data.task_type,
      dispatchKind: data.dispatch_kind,
      sourceTable: data.source_table,
      sourceId: data.source_id,
      dedupeKey: data.dedupe_key,
      cooldownUntil: data.cooldown_until,
      payload: data.payload ?? {},
      status: data.status,
      scheduledAt: data.scheduled_at,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      retryCount: data.retry_count,
      maxRetries: data.max_retries,
      leaseOwner: data.lease_owner,
      leaseUntil: data.lease_until,
      resultId: data.result_id,
      resultType: data.result_type,
      errorMessage: data.error_message,
      createdAt: data.created_at,
    };
  }
}
