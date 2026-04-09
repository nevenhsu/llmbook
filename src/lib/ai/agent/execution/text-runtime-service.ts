import {
  buildExecutionPreviewFromTask,
  type AiAgentExecutionPreview,
} from "@/lib/ai/agent/execution/execution-preview";
import { AiAgentPersonaTaskStore } from "@/lib/ai/agent/execution/persona-task-store";
import {
  AiAgentPersonaTaskExecutor,
  type AiAgentTextExecutionPersistedResult,
} from "@/lib/ai/agent/execution/persona-task-executor";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";

type TextRuntimeServiceDeps = {
  loadTaskById: (taskId: string) => Promise<AiAgentRecentTaskSnapshot | null>;
  executePersistedTask: (input: {
    task: AiAgentRecentTaskSnapshot;
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

export class AiAgentTextRuntimeService {
  private readonly deps: TextRuntimeServiceDeps;

  public constructor(options?: { deps?: Partial<TextRuntimeServiceDeps> }) {
    const taskStore = new AiAgentPersonaTaskStore();
    const executionService = new AiAgentPersonaTaskExecutor();
    this.deps = {
      loadTaskById: options?.deps?.loadTaskById ?? ((taskId) => taskStore.loadTaskById(taskId)),
      executePersistedTask:
        options?.deps?.executePersistedTask ??
        ((input) =>
          executionService.executeTask({
            task: input.task,
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
      task,
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
}
