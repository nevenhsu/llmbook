import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";

export type AiAgentQueueActionName = "retry_task" | "requeue_task" | "mark_dead";

export type AiAgentQueueActionPreview = {
  action: AiAgentQueueActionName;
  enabled: boolean;
  reason: string;
  statusTransition: {
    from: string;
    to: string;
  };
  payload: Record<string, unknown>;
};

export type AiAgentQueueActionPreviewSet = {
  taskId: string;
  taskStatus: string;
  actions: AiAgentQueueActionPreview[];
};

function buildActionPreview(
  task: AiAgentRecentTaskSnapshot,
  action: AiAgentQueueActionName,
): AiAgentQueueActionPreview {
  switch (action) {
    case "retry_task":
      return {
        action,
        enabled: task.status === "FAILED" && task.retryCount < task.maxRetries,
        reason:
          task.status !== "FAILED"
            ? "Retry is only allowed for FAILED rows."
            : task.retryCount >= task.maxRetries
              ? "Retry limit already reached for this task."
              : "Retry would return the failed row to PENDING while preserving prior retry history.",
        statusTransition: {
          from: task.status,
          to: "PENDING",
        },
        payload: {
          task_id: task.id,
          preserve_retry_count: true,
          current_retry_count: task.retryCount,
        },
      };
    case "requeue_task":
      return {
        action,
        enabled: task.status === "FAILED" || task.status === "SKIPPED" || task.status === "DONE",
        reason:
          task.status === "RUNNING"
            ? "Requeue is blocked while a task is actively leased."
            : task.status === "PENDING"
              ? "Task is already pending in the queue."
              : "Requeue would clear result/lease state and return the row to PENDING.",
        statusTransition: {
          from: task.status,
          to: "PENDING",
        },
        payload: {
          task_id: task.id,
          clear_result_metadata: true,
          clear_lease_metadata: true,
          reset_retry_count: true,
        },
      };
    case "mark_dead":
      return {
        action,
        enabled: task.status !== "DONE" && task.status !== "RUNNING" && task.status !== "SKIPPED",
        reason:
          task.status === "DONE"
            ? "Done rows should remain immutable in this operator flow."
            : task.status === "RUNNING"
              ? "Mark dead is blocked while a task is actively leased."
              : task.status === "SKIPPED"
                ? "Task is already in a terminal skipped state."
                : "Mark dead would terminally skip the row and remove it from runnable queue states.",
        statusTransition: {
          from: task.status,
          to: "SKIPPED",
        },
        payload: {
          task_id: task.id,
          preserve_result_metadata: false,
          terminal_reason: "admin_marked_dead",
        },
      };
  }
}

export function buildQueueActionPreviewSet(
  task: AiAgentRecentTaskSnapshot,
): AiAgentQueueActionPreviewSet {
  return {
    taskId: task.id,
    taskStatus: task.status,
    actions: [
      buildActionPreview(task, "retry_task"),
      buildActionPreview(task, "requeue_task"),
      buildActionPreview(task, "mark_dead"),
    ],
  };
}
