import { describe, expect, it, vi } from "vitest";
import {
  AiAgentTextRuntimeGuardError,
  AiAgentTextRuntimeService,
} from "@/lib/ai/agent/execution/text-runtime-service";
import type { AiAgentTextExecutionPersistedResult } from "@/lib/ai/agent/execution/persona-task-executor";
import { buildMockAiAgentOverviewSnapshot } from "@/lib/ai/agent/testing/mock-overview-snapshot";

describe("AiAgentTextRuntimeService", () => {
  it("returns shared execution preview artifacts for a runnable text task", async () => {
    const task = buildMockAiAgentOverviewSnapshot().recentTasks[0];
    const service = new AiAgentTextRuntimeService({
      deps: {
        loadTaskById: async (taskId) => (taskId === task.id ? task : null),
      },
    });

    const result = await service.previewTask(task.id);

    expect(result).toMatchObject({
      available: true,
      blocker: null,
      selectedTaskId: task.id,
      summary: "Runtime task preview is available for the selected text task.",
    });
    expect(result.executionPreview?.sourceId).toBe(task.sourceId);
  });

  it("executes a runnable task through shared generation and persistence", async () => {
    const task = buildMockAiAgentOverviewSnapshot().recentTasks[0];
    const persisted = {
      taskId: task.id,
      persistedTable: "comments",
      persistedId: "comment-new-1",
      resultType: "comment",
      writeMode: "inserted",
      historyId: null,
      updatedTask: {
        ...task,
        status: "DONE",
        resultId: "comment-new-1",
        resultType: "comment",
        completedAt: "2026-03-30T00:00:00.000Z",
      },
    } satisfies AiAgentTextExecutionPersistedResult;
    const executePersistedTask = vi.fn(async () => persisted);
    const service = new AiAgentTextRuntimeService({
      deps: {
        loadTaskById: async (taskId) => (taskId === task.id ? task : null),
        executePersistedTask,
      },
    });

    const result = await service.executeTask(task.id);

    expect(executePersistedTask).toHaveBeenCalledWith({
      task,
      sourceRuntime: "text_runtime",
    });
    expect(result).toEqual(persisted);
  });

  it("throws a guard error when notification text execution lacks canonical target ids", async () => {
    const task = {
      ...buildMockAiAgentOverviewSnapshot().recentTasks[0],
      dispatchKind: "notification",
      sourceTable: "notifications",
      taskType: "post",
      payload: {},
    };
    const service = new AiAgentTextRuntimeService({
      deps: {
        loadTaskById: async (taskId) => (taskId === task.id ? task : null),
      },
    });

    await expect(service.executeTask(task.id)).rejects.toThrow(AiAgentTextRuntimeGuardError);
    await expect(service.executeTask(task.id)).rejects.toThrow(
      "Live text execution currently requires canonical notification target ids for notification-backed tasks.",
    );
  });
});
