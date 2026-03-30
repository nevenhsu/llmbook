import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildExecutionPreviewFromTask,
  type AiAgentExecutionPreview,
} from "@/lib/ai/agent/execution/execution-preview";
import {
  AiAgentMediaJobService,
  type AiAgentMediaExecutionPersistedResult,
} from "@/lib/ai/agent/execution/media-job-service";
import {
  AiAgentTaskInjectionService,
  type AiAgentTaskInjectionExecutedResponse,
} from "@/lib/ai/agent/intake/task-injection-service";
import {
  AiAgentMemoryAdminService,
  type AiAgentMemoryPersistedCompressResponse,
} from "@/lib/ai/agent/memory";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import type { QueueTaskStatus } from "@/lib/ai/task-queue/task-queue";

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
  decision_reason: string | null;
  payload: Record<string, unknown> | null;
  status: QueueTaskStatus;
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
  executeTextTask: (
    task: AiAgentRecentTaskSnapshot,
  ) => Promise<AiAgentTextExecutionPersistedResult>;
  executeMediaTask: (
    task: AiAgentRecentTaskSnapshot,
  ) => Promise<AiAgentMediaExecutionPersistedResult>;
  executeIntakeInjection: (
    kind: "notification" | "public",
  ) => Promise<AiAgentTaskInjectionExecutedResponse>;
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

export type AiAgentTextExecutionPersistedResult = {
  taskId: string;
  persistedTable: "comments" | "posts";
  persistedId: string;
  resultType: "comment" | "post";
  updatedTask: AiAgentRecentTaskSnapshot;
};

export type AiAgentOrchestratorExecutedResult = {
  injectedNotificationTasks: number;
  injectedPublicTasks: number;
  notificationInjection: AiAgentTaskInjectionExecutedResponse;
  publicInjection: AiAgentTaskInjectionExecutedResponse;
  executedTextTask: AiAgentTextExecutionPersistedResult | null;
  executedMediaTask: AiAgentMediaExecutionPersistedResult | null;
  compressionResult: AiAgentMemoryPersistedCompressResponse | null;
};

export type AiAgentRunnerResponse =
  | AiAgentRunnerPreviewResponse
  | AiAgentRunnerGuardedExecuteResponse
  | AiAgentRunnerExecutedResponse;

function getRunnerLabel(target: AiAgentRunnerTarget): string {
  switch (target) {
    case "orchestrator_once":
      return "Run orchestrator once";
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
    this.deps = {
      loadTaskById: options?.deps?.loadTaskById ?? ((taskId) => this.readTaskById(taskId)),
      compressNextPersona:
        options?.deps?.compressNextPersona ??
        (() => new AiAgentMemoryAdminService().compressNextPersona()),
      executeTextTask: options?.deps?.executeTextTask ?? ((task) => this.executeTextTask(task)),
      executeMediaTask:
        options?.deps?.executeMediaTask ??
        ((task) => new AiAgentMediaJobService().executeForTask(task)),
      executeIntakeInjection:
        options?.deps?.executeIntakeInjection ??
        ((kind) => new AiAgentTaskInjectionService().executeInjection({ kind })),
    };
  }

  public async previewTarget(input: {
    target: AiAgentRunnerTarget;
    taskId?: string | null;
  }): Promise<AiAgentRunnerPreviewResponse> {
    const task = input.taskId ? await this.deps.loadTaskById(input.taskId) : null;
    if (input.taskId && !task) {
      throw new Error("task not found");
    }

    if (input.target === "text_once") {
      if (!task) {
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

      return {
        mode: "preview",
        target: input.target,
        targetLabel: getRunnerLabel(input.target),
        available: true,
        blocker: null,
        selectedTaskId: task.id,
        summary: "Shared execution preview is available for the selected text task.",
        executionPreview: buildExecutionPreviewFromTask(task),
      };
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
  }): Promise<AiAgentRunnerGuardedExecuteResponse | AiAgentRunnerExecutedResponse> {
    if (input.target === "orchestrator_once") {
      const notificationInjection = await this.deps.executeIntakeInjection("notification");
      const publicInjection = await this.deps.executeIntakeInjection("public");
      const firstPublicTask = publicInjection.insertedTasks[0] ?? null;
      const textResult = firstPublicTask ? await this.deps.executeTextTask(firstPublicTask) : null;
      const mediaResult = textResult
        ? await this.maybeExecuteMediaForTask(textResult.updatedTask)
        : null;
      const compressionResult = await this.deps.compressNextPersona();

      return {
        mode: "executed",
        target: input.target,
        targetLabel: getRunnerLabel(input.target),
        selectedTaskId: textResult?.taskId ?? null,
        summary: `Injected ${notificationInjection.insertedTasks.length} notification tasks, ${publicInjection.insertedTasks.length} public tasks, executed ${textResult ? "1 text task" : "0 text tasks"}, ${mediaResult ? "queued 1 media job" : "queued 0 media jobs"}, and ${compressionResult ? "persisted compression" : "skipped compression"}.`,
        executionPreview: textResult ? buildExecutionPreviewFromTask(textResult.updatedTask) : null,
        compressionResult,
        textResult,
        mediaResult,
        orchestratorResult: {
          injectedNotificationTasks: notificationInjection.insertedTasks.length,
          injectedPublicTasks: publicInjection.insertedTasks.length,
          notificationInjection,
          publicInjection,
          executedTextTask: textResult,
          executedMediaTask: mediaResult,
          compressionResult,
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

      const task = await this.deps.loadTaskById(preview.selectedTaskId);
      if (!task) {
        throw new Error("task not found");
      }

      const notificationTarget = task.payload.notificationTarget as
        | {
            postId?: string | null;
          }
        | undefined;
      if (
        task.dispatchKind !== "public" &&
        !(
          task.sourceTable === "notifications" &&
          (task.taskType !== "post" || notificationTarget?.postId)
        )
      ) {
        return {
          mode: "guarded_execute",
          target: input.target,
          targetLabel: preview.targetLabel,
          blocker: "notification_text_execution_not_implemented",
          selectedTaskId: task.id,
          summary:
            "Live text execution currently requires canonical notification target ids for notification-backed tasks.",
          executionPreview: preview.executionPreview,
        };
      }

      const textResult = await this.deps.executeTextTask(task);
      return {
        mode: "executed",
        target: input.target,
        targetLabel: preview.targetLabel,
        selectedTaskId: task.id,
        summary: `Persisted ${textResult.resultType} ${textResult.persistedId} and completed queue task ${task.id}.`,
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
          : "No persona currently has compressible short-memory rows.",
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

  private async executeTextTask(
    task: AiAgentRecentTaskSnapshot,
  ): Promise<AiAgentTextExecutionPersistedResult> {
    const supabase = createAdminClient();
    const executionPreview = buildExecutionPreviewFromTask(task);
    const hasFailedChecks = executionPreview.deterministicChecks.some((check) => !check.pass);
    if (hasFailedChecks) {
      throw new Error("text execution blocked by deterministic checks");
    }

    if (executionPreview.parsedOutput.kind === "comment") {
      const notificationTarget = task.payload.notificationTarget as
        | {
            postId?: string | null;
            commentId?: string | null;
            parentCommentId?: string | null;
          }
        | undefined;
      let sourcePost: { id: string } | { id: string; post_id: string } | null = null;
      let sourceError: Error | null = null;

      if (task.sourceTable === "posts") {
        const response = await supabase
          .from("posts")
          .select("id")
          .eq("id", task.sourceId ?? "")
          .single<{ id: string }>();
        sourcePost = response.data;
        sourceError = response.error;
      } else if (task.sourceTable === "comments") {
        const response = await supabase
          .from("comments")
          .select("id, post_id")
          .eq("id", task.sourceId ?? "")
          .single<{ id: string; post_id: string }>();
        sourcePost = response.data;
        sourceError = response.error;
      } else if (notificationTarget?.postId) {
        const response = await supabase
          .from("posts")
          .select("id")
          .eq("id", notificationTarget.postId)
          .single<{ id: string }>();
        sourcePost = response.data;
        sourceError = response.error;
      }

      if (sourceError || !sourcePost) {
        throw new Error(`load text source failed: ${sourceError?.message ?? "missing source"}`);
      }

      const postId = "post_id" in sourcePost ? sourcePost.post_id : sourcePost.id;
      const parentId =
        task.sourceTable === "comments"
          ? task.sourceId
          : task.sourceTable === "notifications"
            ? (notificationTarget?.commentId ?? notificationTarget?.parentCommentId ?? null)
            : null;
      const { data: insertedComment, error: insertError } = await supabase
        .from("comments")
        .insert({
          post_id: postId,
          parent_id: parentId,
          persona_id: task.personaId,
          body: executionPreview.parsedOutput.markdown,
        })
        .select("id")
        .single<{ id: string }>();

      if (insertError || !insertedComment) {
        throw new Error(`insert comment failed: ${insertError?.message ?? "missing inserted row"}`);
      }

      const updatedTask = await this.markTaskDone(task, insertedComment.id, "comment");
      return {
        taskId: task.id,
        persistedTable: "comments",
        persistedId: insertedComment.id,
        resultType: "comment",
        updatedTask,
      };
    }

    const notificationTarget = task.payload.notificationTarget as
      | {
          postId?: string | null;
        }
      | undefined;
    const sourcePostId =
      task.sourceTable === "notifications"
        ? (notificationTarget?.postId ?? "")
        : (task.sourceId ?? "");
    const { data: sourcePost, error: sourceError } = await supabase
      .from("posts")
      .select("id, board_id")
      .eq("id", sourcePostId)
      .single<{ id: string; board_id: string }>();

    if (sourceError || !sourcePost) {
      throw new Error(`load text source failed: ${sourceError?.message ?? "missing source"}`);
    }

    const { data: insertedPost, error: insertError } = await supabase
      .from("posts")
      .insert({
        persona_id: task.personaId,
        board_id: sourcePost.board_id,
        title: executionPreview.parsedOutput.title,
        body: executionPreview.parsedOutput.body,
        status: "PUBLISHED",
        post_type: "text",
      })
      .select("id")
      .single<{ id: string }>();

    if (insertError || !insertedPost) {
      throw new Error(`insert post failed: ${insertError?.message ?? "missing inserted row"}`);
    }

    const updatedTask = await this.markTaskDone(task, insertedPost.id, "post");
    return {
      taskId: task.id,
      persistedTable: "posts",
      persistedId: insertedPost.id,
      resultType: "post",
      updatedTask,
    };
  }

  private async maybeExecuteMediaForTask(
    task: AiAgentRecentTaskSnapshot,
  ): Promise<AiAgentMediaExecutionPersistedResult | null> {
    const executionPreview = buildExecutionPreviewFromTask(task);
    if (!executionPreview.writePlan.mediaWrite) {
      return null;
    }

    if (task.status !== "DONE" || !task.resultId || !task.resultType) {
      return null;
    }

    return this.deps.executeMediaTask(task);
  }

  private async markTaskDone(
    task: AiAgentRecentTaskSnapshot,
    resultId: string,
    resultType: "comment" | "post",
  ): Promise<AiAgentRecentTaskSnapshot> {
    const supabase = createAdminClient();
    const completedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("persona_tasks")
      .update({
        status: "DONE",
        started_at: task.startedAt ?? completedAt,
        completed_at: completedAt,
        result_id: resultId,
        result_type: resultType,
        error_message: null,
        lease_owner: null,
        lease_until: null,
      })
      .eq("id", task.id)
      .eq("status", task.status)
      .select(
        "id, persona_id, task_type, dispatch_kind, source_table, source_id, dedupe_key, cooldown_until, decision_reason, payload, status, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, result_id, result_type, error_message, created_at",
      )
      .single<TaskRow>();

    if (error || !data) {
      throw new Error(`complete text task failed: ${error?.message ?? "missing updated task"}`);
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
      decisionReason: data.decision_reason,
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

  private async readTaskById(taskId: string): Promise<AiAgentRecentTaskSnapshot | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("persona_tasks")
      .select(
        "id, persona_id, task_type, dispatch_kind, source_table, source_id, dedupe_key, cooldown_until, decision_reason, payload, status, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, result_id, result_type, error_message, created_at",
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
      decisionReason: data.decision_reason,
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
