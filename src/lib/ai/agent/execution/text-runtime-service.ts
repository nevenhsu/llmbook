import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildExecutionPreviewFromTask,
  type AiAgentExecutionPreview,
} from "@/lib/ai/agent/execution/execution-preview";
import {
  AiAgentPersonaTaskExecutionService,
  type AiAgentTextExecutionPersistedResult,
} from "@/lib/ai/agent/execution/persona-task-execution-service";
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

type TextRuntimeServiceDeps = {
  loadTaskById: (taskId: string) => Promise<AiAgentRecentTaskSnapshot | null>;
  executePersistedTask: (input: {
    taskId: string;
    sourceRuntime: string;
  }) => Promise<AiAgentTextExecutionPersistedResult>;
};

export type { AiAgentTextExecutionPersistedResult };

export type AiAgentTextRuntimePreviewResult = {
  available: boolean;
  blocker: string | null;
  selectedTaskId: string | null;
  summary: string;
  executionPreview: AiAgentExecutionPreview | null;
};

export class AiAgentTextRuntimeGuardError extends Error {
  public readonly reasonCode: string;

  public constructor(reasonCode: string, message: string) {
    super(message);
    this.name = "AiAgentTextRuntimeGuardError";
    this.reasonCode = reasonCode;
  }
}

function mapTaskRowToSnapshot(
  row: TaskRow,
  persona: PersonaIdentityRow | null,
): AiAgentRecentTaskSnapshot {
  return {
    id: row.id,
    personaId: row.persona_id,
    personaUsername: persona?.username ?? null,
    personaDisplayName: persona?.display_name ?? null,
    taskType: row.task_type,
    dispatchKind: row.dispatch_kind,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    dedupeKey: row.dedupe_key,
    cooldownUntil: row.cooldown_until,
    payload: row.payload ?? {},
    status: row.status,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    leaseOwner: row.lease_owner,
    leaseUntil: row.lease_until,
    resultId: row.result_id,
    resultType: row.result_type,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

export class AiAgentTextRuntimeService {
  private readonly deps: TextRuntimeServiceDeps;

  public constructor(options?: { deps?: Partial<TextRuntimeServiceDeps> }) {
    const executionService = new AiAgentPersonaTaskExecutionService();
    this.deps = {
      loadTaskById: options?.deps?.loadTaskById ?? ((taskId) => this.readTaskById(taskId)),
      executePersistedTask:
        options?.deps?.executePersistedTask ??
        ((input) =>
          executionService.executeTask({
            taskId: input.taskId,
            sourceRuntime: input.sourceRuntime,
          })),
    };
  }

  public async previewTask(taskId: string): Promise<AiAgentTextRuntimePreviewResult> {
    const task = await this.deps.loadTaskById(taskId);
    if (!task) {
      throw new Error("task not found");
    }

    return {
      available: true,
      blocker: null,
      selectedTaskId: task.id,
      summary: "Shared execution preview is available for the selected text task.",
      executionPreview: buildExecutionPreviewFromTask(task),
    };
  }

  public async executeTask(taskId: string): Promise<AiAgentTextExecutionPersistedResult> {
    const task = await this.requireRunnableTask(taskId);
    return this.deps.executePersistedTask({
      taskId: task.id,
      sourceRuntime: "text_runtime",
    });
  }

  private async requireRunnableTask(taskId: string): Promise<AiAgentRecentTaskSnapshot> {
    const task = await this.deps.loadTaskById(taskId);
    if (!task) {
      throw new Error("task not found");
    }

    const notificationTarget = task.payload as {
      postId?: string | null;
    };
    if (
      task.dispatchKind !== "public" &&
      !(
        task.sourceTable === "notifications" &&
        (task.taskType !== "post" || notificationTarget?.postId)
      )
    ) {
      throw new AiAgentTextRuntimeGuardError(
        "notification_text_execution_not_implemented",
        "Live text execution currently requires canonical notification target ids for notification-backed tasks.",
      );
    }

    return task;
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

    return mapTaskRowToSnapshot(data, persona ?? null);
  }
}
