import { AiAgentPersonaTaskStore } from "@/lib/ai/agent/execution/persona-task-store";
import {
  AiAgentPersonaTaskExecutor,
  type AiAgentTextExecutionPersistedResult,
} from "@/lib/ai/agent/execution/persona-task-executor";
import type { TaskSnapshot } from "@/lib/ai/agent/read-models/task-snapshot";

export type AiAgentTextRuntimeTaskPreview = {
  taskId: string;
  taskType: TaskSnapshot["taskType"];
  sourceTable: TaskSnapshot["sourceTable"];
  sourceId: TaskSnapshot["sourceId"];
  dispatchKind: TaskSnapshot["dispatchKind"];
  status: TaskSnapshot["status"];
  resultId: TaskSnapshot["resultId"];
  resultType: TaskSnapshot["resultType"];
  generatedMedia: {
    needImage: boolean;
    imagePrompt: string | null;
    imageAlt: string | null;
  } | null;
};

type TextRuntimeServiceDeps = {
  loadTaskById: (taskId: string) => Promise<TaskSnapshot | null>;
  executePersistedTask: (input: {
    task: TaskSnapshot;
    sourceRuntime: string;
  }) => Promise<AiAgentTextExecutionPersistedResult>;
};

export type { AiAgentTextExecutionPersistedResult };

export type AiAgentTextRuntimePreviewResult = {
  available: boolean;
  blocker: string | null;
  selectedTaskId: string | null;
  summary: string;
  executionPreview: AiAgentTextRuntimeTaskPreview | null;
};

function readGeneratedMedia(task: TaskSnapshot): AiAgentTextRuntimeTaskPreview["generatedMedia"] {
  const generatedMedia =
    task.payload.generatedMedia &&
    typeof task.payload.generatedMedia === "object" &&
    !Array.isArray(task.payload.generatedMedia)
      ? (task.payload.generatedMedia as {
          needImage?: unknown;
          imagePrompt?: unknown;
          imageAlt?: unknown;
        })
      : null;

  if (!generatedMedia) {
    return null;
  }

  return {
    needImage: generatedMedia.needImage === true,
    imagePrompt: typeof generatedMedia.imagePrompt === "string" ? generatedMedia.imagePrompt : null,
    imageAlt: typeof generatedMedia.imageAlt === "string" ? generatedMedia.imageAlt : null,
  };
}

function buildRuntimeTaskPreview(task: TaskSnapshot): AiAgentTextRuntimeTaskPreview {
  return {
    taskId: task.id,
    taskType: task.taskType,
    sourceTable: task.sourceTable,
    sourceId: task.sourceId,
    dispatchKind: task.dispatchKind,
    status: task.status,
    resultId: task.resultId,
    resultType: task.resultType,
    generatedMedia: readGeneratedMedia(task),
  };
}

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
      summary: "Runtime task preview is available for the selected text task.",
      executionPreview: buildRuntimeTaskPreview(task),
    };
  }

  public async executeTask(taskId: string): Promise<AiAgentTextExecutionPersistedResult> {
    const task = await this.requireRunnableTask(taskId);
    return this.deps.executePersistedTask({
      task,
      sourceRuntime: "text_runtime",
    });
  }

  private async requireRunnableTask(taskId: string): Promise<TaskSnapshot> {
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
