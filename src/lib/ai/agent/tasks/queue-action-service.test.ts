import { describe, expect, it } from "vitest";
import {
  AiAgentQueueActionService,
  type QueueActionExecutedResponse,
  type QueueActionGuardedResponse,
} from "@/lib/ai/agent/tasks/queue-action-service";
import type { TaskSnapshot } from "@/lib/ai/agent/read-models/task-snapshot";
import { buildMockAiAgentOverviewSnapshot } from "@/lib/ai/agent/testing/mock-overview-snapshot";

describe("AiAgentQueueActionService", () => {
  it("returns a guarded preview contract for a supported queue action", async () => {
    const task = buildMockAiAgentOverviewSnapshot().recentTasks[0];
    const service = new AiAgentQueueActionService({
      deps: {
        loadTaskById: async (taskId) => (taskId === task?.id ? (task ?? null) : null),
      },
    });

    const result = await service.previewAction({
      taskId: "task-1",
      action: "requeue_task",
    });

    expect(result).toEqual<QueueActionGuardedResponse>({
      mode: "guarded_preview",
      taskId: "task-1",
      action: "requeue_task",
      actionPreview: {
        action: "requeue_task",
        enabled: false,
        reason: "Task is already pending in the queue.",
        statusTransition: {
          from: "PENDING",
          to: "PENDING",
        },
        payload: {
          task_id: "task-1",
          clear_result_metadata: true,
          clear_lease_metadata: true,
          reset_retry_count: true,
        },
      },
      message: "Queue mutation is still guarded in this slice; preview only.",
    });
  });

  it("executes an enabled queue action and returns the updated task snapshot", async () => {
    const failedTask: TaskSnapshot = {
      ...buildMockAiAgentOverviewSnapshot().recentTasks[0],
      status: "FAILED" as const,
      retryCount: 1,
      errorMessage: "model timeout",
    };
    let mutatedTask: TaskSnapshot = failedTask;
    const service = new AiAgentQueueActionService({
      deps: {
        loadTaskById: async (taskId) => (taskId === mutatedTask.id ? mutatedTask : null),
        applyMutation: async ({ action }) => {
          expect(action).toBe("retry_task");
          mutatedTask = {
            ...mutatedTask,
            status: "PENDING",
            scheduledAt: "2026-03-29T02:00:00.000Z",
            completedAt: null,
            errorMessage: null,
          };
        },
      },
    });

    const result = await service.executeAction({
      taskId: failedTask.id,
      action: "retry_task",
      now: new Date("2026-03-29T02:00:00.000Z"),
    });

    expect(result).toEqual<QueueActionExecutedResponse>({
      mode: "executed",
      taskId: failedTask.id,
      action: "retry_task",
      actionPreview: {
        action: "retry_task",
        enabled: true,
        reason:
          "Retry would return the failed row to PENDING while preserving prior retry history.",
        statusTransition: {
          from: "FAILED",
          to: "PENDING",
        },
        payload: {
          task_id: failedTask.id,
          preserve_retry_count: true,
          current_retry_count: 1,
        },
      },
      previousStatus: "FAILED",
      updatedTask: mutatedTask,
      message: "retry_task executed against persona_tasks.",
    });
  });
});
