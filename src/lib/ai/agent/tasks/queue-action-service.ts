import { createAdminClient } from "@/lib/supabase/admin";
import type { QueueTaskStatus } from "@/lib/ai/task-queue/task-queue";
import {
  buildQueueActionPreviewSet,
  type AiAgentQueueActionName,
  type AiAgentQueueActionPreview,
} from "@/lib/ai/agent/tasks/queue-action-preview";
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

type QueueActionServiceDeps = {
  loadTaskById: (taskId: string) => Promise<AiAgentRecentTaskSnapshot | null>;
  applyMutation: (input: {
    task: AiAgentRecentTaskSnapshot;
    action: AiAgentQueueActionName;
    now: Date;
  }) => Promise<void>;
};

export type QueueActionGuardedResponse = {
  mode: "guarded_preview";
  taskId: string;
  action: AiAgentQueueActionName;
  actionPreview: AiAgentQueueActionPreview;
  message: string;
};

export type QueueActionExecutedResponse = {
  mode: "executed";
  taskId: string;
  action: AiAgentQueueActionName;
  actionPreview: AiAgentQueueActionPreview;
  previousStatus: string;
  updatedTask: AiAgentRecentTaskSnapshot;
  message: string;
};

export type QueueActionResponse = QueueActionGuardedResponse | QueueActionExecutedResponse;

function resolveActionPreview(
  task: AiAgentRecentTaskSnapshot,
  action: AiAgentQueueActionName,
): AiAgentQueueActionPreview {
  const actionPreview = buildQueueActionPreviewSet(task).actions.find(
    (candidate) => candidate.action === action,
  );
  if (!actionPreview) {
    throw new Error("unsupported queue action");
  }
  return actionPreview;
}

export class AiAgentQueueActionService {
  private readonly deps: QueueActionServiceDeps;

  public constructor(options?: { deps?: Partial<QueueActionServiceDeps> }) {
    this.deps = {
      loadTaskById: options?.deps?.loadTaskById ?? ((taskId) => this.readTaskById(taskId)),
      applyMutation:
        options?.deps?.applyMutation ??
        ((input) => this.applyMutationToTask(input.task, input.action, input.now)),
    };
  }

  public async previewAction(input: {
    taskId: string;
    action: AiAgentQueueActionName;
  }): Promise<QueueActionGuardedResponse> {
    const task = await this.deps.loadTaskById(input.taskId);
    if (!task) {
      throw new Error("task not found");
    }

    const actionPreview = resolveActionPreview(task, input.action);

    return {
      mode: "guarded_preview",
      taskId: task.id,
      action: input.action,
      actionPreview,
      message: "Queue mutation is still guarded in this slice; preview only.",
    };
  }

  public async executeAction(input: {
    taskId: string;
    action: AiAgentQueueActionName;
    now?: Date;
  }): Promise<QueueActionExecutedResponse> {
    const task = await this.deps.loadTaskById(input.taskId);
    if (!task) {
      throw new Error("task not found");
    }

    const actionPreview = resolveActionPreview(task, input.action);
    if (!actionPreview.enabled) {
      throw new Error(`queue action blocked: ${actionPreview.reason}`);
    }

    const now = input.now ?? new Date();
    await this.deps.applyMutation({
      task,
      action: input.action,
      now,
    });

    const updatedTask = await this.deps.loadTaskById(task.id);
    if (!updatedTask) {
      throw new Error("task not found after mutation");
    }

    return {
      mode: "executed",
      taskId: task.id,
      action: input.action,
      actionPreview,
      previousStatus: task.status,
      updatedTask,
      message: `${input.action} executed against persona_tasks.`,
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

  private async applyMutationToTask(
    task: AiAgentRecentTaskSnapshot,
    action: AiAgentQueueActionName,
    now: Date,
  ): Promise<void> {
    const supabase = createAdminClient();
    const nowIso = now.toISOString();
    let updates: Record<string, unknown>;

    switch (action) {
      case "retry_task":
        updates = {
          status: "PENDING",
          scheduled_at: nowIso,
          started_at: null,
          completed_at: null,
          lease_owner: null,
          lease_until: null,
          error_message: null,
        };
        break;
      case "requeue_task":
        updates = {
          status: "PENDING",
          scheduled_at: nowIso,
          started_at: null,
          completed_at: null,
          lease_owner: null,
          lease_until: null,
          result_id: null,
          result_type: null,
          error_message: null,
          retry_count: 0,
        };
        break;
      case "mark_dead":
        updates = {
          status: "SKIPPED",
          started_at: null,
          completed_at: nowIso,
          lease_owner: null,
          lease_until: null,
          result_id: null,
          result_type: null,
          error_message: "admin_marked_dead",
        };
        break;
    }

    const { data, error } = await supabase
      .from("persona_tasks")
      .update(updates)
      .eq("id", task.id)
      .eq("status", task.status)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new Error(`queue action mutation failed: ${error.message}`);
    }

    if (!data) {
      throw new Error("queue action mutation lost race");
    }
  }
}
