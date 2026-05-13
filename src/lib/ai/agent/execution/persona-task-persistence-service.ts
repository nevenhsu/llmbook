import { createAdminClient } from "@/lib/supabase/admin";
import {
  AiAgentContentMutationService,
  type AiAgentContentMutationResult,
} from "@/lib/ai/agent/execution/content-mutation-service";
import {
  AiAgentPersonaTaskStore,
  type AiAgentPersonaTaskRow,
} from "@/lib/ai/agent/execution/persona-task-store";
import {
  AiAgentJobPermanentSkipError,
  type AiAgentPersonaTaskGenerationResult,
} from "@/lib/ai/agent/execution/persona-task-generator";
import type { TaskSnapshot } from "@/lib/ai/agent/read-models/task-snapshot";

type PostSourceRow = {
  id: string;
  board_id: string;
};

type CommentSourceRow = {
  id: string;
  post_id: string;
};

type InsertedRow = {
  id: string;
};

type PersistWritePlan =
  | {
      mode: "insert";
      resultType: "comment" | "post";
      persistedTable: "comments" | "posts";
    }
  | {
      mode: "overwrite";
      resultType: "comment" | "post";
      persistedTable: "comments" | "posts";
      targetId: string;
    };

export type AiAgentTextExecutionPersistedResult = {
  taskId: string;
  persistedTable: "comments" | "posts";
  persistedId: string;
  resultType: "comment" | "post";
  writeMode: "inserted" | "overwritten";
  historyId: string | null;
  updatedTask: TaskSnapshot;
};

type PersonaTaskPersistenceServiceDeps = {
  resolveCommentOwner: (task: TaskSnapshot) => Promise<{ postId: string; parentId: string | null }>;
  resolvePostBoard: (task: TaskSnapshot) => Promise<{ boardId: string }>;
  insertComment: (input: {
    postId: string;
    parentId: string | null;
    personaId: string;
    body: string;
  }) => Promise<InsertedRow>;
  insertPost: (input: {
    personaId: string;
    boardId: string;
    title: string;
    body: string;
  }) => Promise<InsertedRow>;
  markTaskDone: (input: {
    task: TaskSnapshot;
    resultId: string;
    resultType: "comment" | "post";
  }) => Promise<TaskSnapshot>;
  overwriteContent: (
    input:
      | {
          targetType: "post";
          targetId: string;
          nextContent: { title: string; body: string; tags: string[] };
          jobTaskId?: string | null;
          sourceRuntime: string;
          sourceKind: string;
          sourceId?: string | null;
          modelMetadata: Record<string, unknown>;
          createdBy?: string | null;
        }
      | {
          targetType: "comment";
          targetId: string;
          nextContent: { body: string };
          jobTaskId?: string | null;
          sourceRuntime: string;
          sourceKind: string;
          sourceId?: string | null;
          modelMetadata: Record<string, unknown>;
          createdBy?: string | null;
        },
  ) => Promise<AiAgentContentMutationResult>;
};

function normalizeNotificationPayload(task: TaskSnapshot): {
  postId: string | null;
  commentId: string | null;
  parentCommentId: string | null;
} {
  return {
    postId: typeof task.payload.postId === "string" ? task.payload.postId : null,
    commentId: typeof task.payload.commentId === "string" ? task.payload.commentId : null,
    parentCommentId:
      typeof task.payload.parentCommentId === "string" ? task.payload.parentCommentId : null,
  };
}

export class AiAgentPersonaTaskPersistenceService {
  private readonly deps: PersonaTaskPersistenceServiceDeps;

  public constructor(options?: { deps?: Partial<PersonaTaskPersistenceServiceDeps> }) {
    const taskStore = new AiAgentPersonaTaskStore();
    this.deps = {
      resolveCommentOwner:
        options?.deps?.resolveCommentOwner ??
        (async (task) => {
          const supabase = createAdminClient();
          const notification = normalizeNotificationPayload(task);

          if (task.sourceTable === "posts") {
            const { data, error } = await supabase
              .from("posts")
              .select("id")
              .eq("id", task.sourceId ?? "")
              .single<InsertedRow>();
            if (error || !data) {
              throw new Error(`load text source failed: ${error?.message ?? "missing source"}`);
            }
            return {
              postId: data.id,
              parentId: null,
            };
          }

          if (task.sourceTable === "comments") {
            const { data, error } = await supabase
              .from("comments")
              .select("id, post_id")
              .eq("id", task.sourceId ?? "")
              .single<CommentSourceRow>();
            if (error || !data) {
              throw new Error(`load text source failed: ${error?.message ?? "missing source"}`);
            }
            return {
              postId: data.post_id,
              parentId: data.id,
            };
          }

          if (notification.postId) {
            const { data, error } = await supabase
              .from("posts")
              .select("id")
              .eq("id", notification.postId)
              .single<InsertedRow>();
            if (error || !data) {
              throw new Error(`load text source failed: ${error?.message ?? "missing source"}`);
            }
            return {
              postId: data.id,
              parentId: notification.commentId ?? notification.parentCommentId ?? null,
            };
          }

          throw new Error("load text source failed: missing source");
        }),
      resolvePostBoard:
        options?.deps?.resolvePostBoard ??
        (async (task) => {
          const supabase = createAdminClient();
          const notification = normalizeNotificationPayload(task);
          const sourcePostId =
            task.sourceTable === "notifications"
              ? (notification.postId ?? "")
              : (task.sourceId ?? "");
          const { data, error } = await supabase
            .from("posts")
            .select("id, board_id")
            .eq("id", sourcePostId)
            .single<PostSourceRow>();

          if (error || !data) {
            throw new Error(`load text source failed: ${error?.message ?? "missing source"}`);
          }

          return {
            boardId: data.board_id,
          };
        }),
      insertComment:
        options?.deps?.insertComment ??
        (async (input) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("comments")
            .insert({
              post_id: input.postId,
              parent_id: input.parentId,
              persona_id: input.personaId,
              body: input.body,
            })
            .select("id")
            .single<InsertedRow>();

          if (error || !data) {
            throw new Error(`insert comment failed: ${error?.message ?? "missing inserted row"}`);
          }

          return data;
        }),
      insertPost:
        options?.deps?.insertPost ??
        (async (input) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("posts")
            .insert({
              persona_id: input.personaId,
              board_id: input.boardId,
              title: input.title,
              body: input.body,
              status: "PUBLISHED",
              post_type: "text",
            })
            .select("id")
            .single<InsertedRow>();

          if (error || !data) {
            throw new Error(`insert post failed: ${error?.message ?? "missing inserted row"}`);
          }

          return data;
        }),
      markTaskDone:
        options?.deps?.markTaskDone ??
        (async (input) => {
          const supabase = createAdminClient();
          const completedAt = new Date().toISOString();
          const { data, error } = await supabase
            .from("persona_tasks")
            .update({
              status: "DONE",
              started_at: input.task.startedAt ?? completedAt,
              completed_at: completedAt,
              result_id: input.resultId,
              result_type: input.resultType,
              error_message: null,
              lease_owner: null,
              lease_until: null,
            })
            .eq("id", input.task.id)
            .eq("status", input.task.status)
            .select(
              "id, persona_id, task_type, dispatch_kind, source_table, source_id, dedupe_key, cooldown_until, payload, status, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, result_id, result_type, error_message, created_at",
            )
            .single<AiAgentPersonaTaskRow>();

          if (error || !data) {
            throw new Error(
              `complete text task failed: ${error?.message ?? "missing updated task"}`,
            );
          }

          return taskStore.hydrateTaskRow(data);
        }),
      overwriteContent:
        options?.deps?.overwriteContent ??
        ((input) => new AiAgentContentMutationService().overwriteContent(input)),
    };
  }

  public async persistGeneratedResult(input: {
    generated: AiAgentPersonaTaskGenerationResult;
    jobTaskId?: string | null;
    sourceRuntime?: string;
    createdBy?: string | null;
  }): Promise<AiAgentTextExecutionPersistedResult> {
    const { generated } = input;
    const writePlan = this.resolveWritePlan(generated);

    if (writePlan.mode === "overwrite") {
      if (writePlan.resultType === "post") {
        if (generated.parsedOutput.kind !== "post") {
          throw new Error("overwrite parsed output and persisted result type are inconsistent");
        }

        const mutation = await this.deps.overwriteContent({
          targetType: "post",
          targetId: writePlan.targetId,
          nextContent: {
            title: generated.parsedOutput.title,
            body: generated.parsedOutput.body,
            tags: generated.parsedOutput.tags,
          },
          jobTaskId: input.jobTaskId ?? null,
          sourceRuntime: input.sourceRuntime ?? "text_runtime",
          sourceKind: "persona_task",
          sourceId: generated.task.id,
          modelMetadata: generated.modelMetadata,
          createdBy: input.createdBy ?? null,
        });
        const updatedTask = await this.deps.markTaskDone({
          task: generated.task,
          resultId: writePlan.targetId,
          resultType: "post",
        });

        return {
          taskId: generated.task.id,
          persistedTable: "posts",
          persistedId: writePlan.targetId,
          resultType: "post",
          writeMode: "overwritten",
          historyId: mutation.historyId,
          updatedTask,
        };
      }

      if (generated.parsedOutput.kind !== "comment" && generated.parsedOutput.kind !== "reply") {
        throw new Error("overwrite parsed output and persisted result type are inconsistent");
      }

      const mutation = await this.deps.overwriteContent({
        targetType: "comment",
        targetId: writePlan.targetId,
        nextContent: {
          body: generated.parsedOutput.body,
        },
        jobTaskId: input.jobTaskId ?? null,
        sourceRuntime: input.sourceRuntime ?? "text_runtime",
        sourceKind: "persona_task",
        sourceId: generated.task.id,
        modelMetadata: generated.modelMetadata,
        createdBy: input.createdBy ?? null,
      });
      const updatedTask = await this.deps.markTaskDone({
        task: generated.task,
        resultId: writePlan.targetId,
        resultType: "comment",
      });

      return {
        taskId: generated.task.id,
        persistedTable: "comments",
        persistedId: writePlan.targetId,
        resultType: "comment",
        writeMode: "overwritten",
        historyId: mutation.historyId,
        updatedTask,
      };
    }

    if (generated.parsedOutput.kind === "comment" || generated.parsedOutput.kind === "reply") {
      const owner = await this.deps.resolveCommentOwner(generated.task);
      const insertedComment = await this.deps.insertComment({
        postId: owner.postId,
        parentId: owner.parentId,
        personaId: generated.task.personaId,
        body: generated.parsedOutput.body,
      });
      const updatedTask = await this.deps.markTaskDone({
        task: generated.task,
        resultId: insertedComment.id,
        resultType: "comment",
      });

      return {
        taskId: generated.task.id,
        persistedTable: "comments",
        persistedId: insertedComment.id,
        resultType: "comment",
        writeMode: "inserted",
        historyId: null,
        updatedTask,
      };
    }

    const owner = await this.deps.resolvePostBoard(generated.task);
    const insertedPost = await this.deps.insertPost({
      personaId: generated.task.personaId,
      boardId: owner.boardId,
      title: generated.parsedOutput.title,
      body: generated.parsedOutput.body,
    });
    const updatedTask = await this.deps.markTaskDone({
      task: generated.task,
      resultId: insertedPost.id,
      resultType: "post",
    });

    return {
      taskId: generated.task.id,
      persistedTable: "posts",
      persistedId: insertedPost.id,
      resultType: "post",
      writeMode: "inserted",
      historyId: null,
      updatedTask,
    };
  }

  private resolveWritePlan(generated: AiAgentPersonaTaskGenerationResult): PersistWritePlan {
    const existingResultId = generated.task.resultId;
    const existingResultType = generated.task.resultType;

    if ((existingResultId && !existingResultType) || (!existingResultId && existingResultType)) {
      throw new AiAgentJobPermanentSkipError(
        "persona_task persisted result metadata is incomplete; cannot decide insert vs overwrite",
      );
    }

    if (!existingResultId || !existingResultType) {
      return generated.parsedOutput.kind === "comment" || generated.parsedOutput.kind === "reply"
        ? {
            mode: "insert",
            resultType: "comment",
            persistedTable: "comments",
          }
        : {
            mode: "insert",
            resultType: "post",
            persistedTable: "posts",
          };
    }

    if (existingResultType === "post") {
      return {
        mode: "overwrite",
        resultType: "post",
        persistedTable: "posts",
        targetId: existingResultId,
      };
    }

    return {
      mode: "overwrite",
      resultType: "comment",
      persistedTable: "comments",
      targetId: existingResultId,
    };
  }
}
