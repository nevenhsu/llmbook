import { describe, expect, it, vi } from "vitest";
import { AiAgentPersonaTaskPersistenceService } from "@/lib/ai/agent/execution/persona-task-persistence-service";
import type {
  AiAgentPersonaTaskGenerationResult,
  AiAgentPersonaTaskGeneratedOutput,
} from "@/lib/ai/agent/execution/persona-task-generator";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-contract";
import type { TaskSnapshot } from "@/lib/ai/agent/read-models/task-snapshot";

function buildTask(overrides: Partial<TaskSnapshot> = {}): TaskSnapshot {
  return {
    id: overrides.id ?? "task-1",
    personaId: overrides.personaId ?? "persona-1",
    personaUsername: overrides.personaUsername ?? "ai_orchid",
    personaDisplayName: overrides.personaDisplayName ?? "Orchid",
    taskType: overrides.taskType ?? "comment",
    dispatchKind: overrides.dispatchKind ?? "public",
    sourceTable: overrides.sourceTable ?? "comments",
    sourceId: overrides.sourceId ?? "comment-source-1",
    dedupeKey: overrides.dedupeKey ?? "ai_orchid:comment-source-1:comment",
    cooldownUntil: overrides.cooldownUntil ?? null,
    payload: overrides.payload ?? {
      summary: "Reply to the public comment with a sharper version.",
    },
    status: overrides.status ?? "PENDING",
    scheduledAt: overrides.scheduledAt ?? "2026-04-08T00:00:00.000Z",
    startedAt: overrides.startedAt ?? "2026-04-08T00:00:05.000Z",
    completedAt: overrides.completedAt ?? null,
    retryCount: overrides.retryCount ?? 0,
    maxRetries: overrides.maxRetries ?? 3,
    leaseOwner: overrides.leaseOwner ?? "worker-1",
    leaseUntil: overrides.leaseUntil ?? "2026-04-08T00:01:05.000Z",
    resultId: overrides.resultId ?? null,
    resultType: overrides.resultType ?? null,
    errorMessage: overrides.errorMessage ?? null,
    createdAt: overrides.createdAt ?? "2026-04-08T00:00:00.000Z",
  };
}

function buildGenerationResult(
  input: {
    task?: TaskSnapshot;
    parsedOutput?: AiAgentPersonaTaskGeneratedOutput;
  } = {},
): AiAgentPersonaTaskGenerationResult {
  return {
    task: input.task ?? buildTask(),
    mode: "runtime",
    promptContext: {
      flowKind: "comment",
      taskType: "comment",
      taskContext: "Generate a publishable comment.",
    },
    preview: {
      assembledPrompt: "prompt",
      markdown: "generated comment",
      rawResponse: "generated comment",
      renderOk: true,
      renderError: null,
      tokenBudget: {
        estimatedInputTokens: 100,
        maxInputTokens: 1000,
        maxOutputTokens: 300,
        blockStats: [],
        compressedStages: [],
        exceeded: false,
        message: null,
      },
      auditDiagnostics: null,
    } satisfies PreviewResult,
    parsedOutput:
      input.parsedOutput ??
      ({
        kind: "comment",
        body: "generated comment body",
      } satisfies AiAgentPersonaTaskGeneratedOutput),
    flowResult: {
      flowKind: "comment",
      parsed: {
        comment: {
          markdown: "generated comment body",
          needImage: false,
          imagePrompt: null,
          imageAlt: null,
        },
      },
      diagnostics: {
        finalStatus: "passed",
        terminalStage: "comment_body.main",
        attempts: [
          {
            stage: "comment_body.main",
            main: 1,
            schemaRepair: 0,
            repair: 0,
            regenerate: 0,
          },
        ],
        stageResults: [{ stage: "comment_body.main", status: "passed" }],
      },
    },
    modelMetadata: {
      schema_version: 1,
      model_id: "model-1",
      provider_key: "xai",
      model_key: "grok-4-1-fast-reasoning",
    },
    modelSelection: {
      modelId: "model-1",
      providerKey: "xai",
      modelKey: "grok-4-1-fast-reasoning",
    },
  };
}

describe("AiAgentPersonaTaskPersistenceService", () => {
  it("persists a generated comment result for the runtime insert path", async () => {
    const insertComment = vi.fn(async () => ({ id: "comment-new-1" }));
    const markTaskDone = vi.fn(async () =>
      buildTask({
        status: "DONE",
        resultId: "comment-new-1",
        resultType: "comment",
        completedAt: "2026-04-08T00:02:00.000Z",
      }),
    );

    const service = new AiAgentPersonaTaskPersistenceService({
      deps: {
        resolveCommentOwner: async () => ({
          postId: "post-1",
          parentId: "comment-source-1",
        }),
        insertComment,
        markTaskDone,
      },
    });

    const result = await service.persistGeneratedResult({
      generated: buildGenerationResult(),
      sourceRuntime: "text_runtime",
    });

    expect(insertComment).toHaveBeenCalledWith({
      postId: "post-1",
      parentId: "comment-source-1",
      personaId: "persona-1",
      body: "generated comment body",
    });
    expect(markTaskDone).toHaveBeenCalledWith({
      task: expect.objectContaining({ id: "task-1" }),
      resultId: "comment-new-1",
      resultType: "comment",
    });
    expect(result).toMatchObject({
      taskId: "task-1",
      persistedTable: "comments",
      persistedId: "comment-new-1",
      resultType: "comment",
      writeMode: "inserted",
      historyId: null,
    });
  });

  it("overwrites an existing persisted target through the shared persistence path", async () => {
    const overwriteContent = vi.fn(async () => ({
      targetType: "comment" as const,
      targetId: "comment-1",
      historyId: "history-1",
      previousSnapshot: {
        schema_version: 1 as const,
        body: "old body",
      },
      updatedAt: "2026-04-08T00:03:00.000Z",
    }));
    const markTaskDone = vi.fn(async () =>
      buildTask({
        status: "DONE",
        resultId: "comment-1",
        resultType: "comment",
        completedAt: "2026-04-08T00:03:30.000Z",
      }),
    );

    const service = new AiAgentPersonaTaskPersistenceService({
      deps: {
        overwriteContent,
        markTaskDone,
      },
    });

    const result = await service.persistGeneratedResult({
      generated: buildGenerationResult({
        task: buildTask({
          status: "DONE",
          resultId: "comment-1",
          resultType: "comment",
        }),
      }),
      jobTaskId: "job-1",
      sourceRuntime: "jobs_runtime",
      createdBy: "admin-1",
    });

    expect(overwriteContent).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: "comment",
        targetId: "comment-1",
        nextContent: {
          body: "generated comment body",
        },
        jobTaskId: "job-1",
      }),
    );
    expect(result).toMatchObject({
      taskId: "task-1",
      persistedTable: "comments",
      persistedId: "comment-1",
      resultType: "comment",
      writeMode: "overwritten",
      historyId: "history-1",
      updatedTask: expect.objectContaining({
        id: "task-1",
        status: "DONE",
        resultId: "comment-1",
        resultType: "comment",
      }),
    });
    expect(markTaskDone).toHaveBeenCalledWith({
      task: expect.objectContaining({
        id: "task-1",
        status: "DONE",
        resultId: "comment-1",
        resultType: "comment",
      }),
      resultId: "comment-1",
      resultType: "comment",
    });
  });

  it("marks the task done after overwrite when persisted metadata exists on a non-terminal task", async () => {
    const overwriteContent = vi.fn(async () => ({
      targetType: "comment" as const,
      targetId: "comment-1",
      historyId: "history-2",
      previousSnapshot: {
        schema_version: 1 as const,
        body: "old body",
      },
      updatedAt: "2026-04-08T00:04:00.000Z",
    }));
    const markTaskDone = vi.fn(async () =>
      buildTask({
        status: "DONE",
        resultId: "comment-1",
        resultType: "comment",
        completedAt: "2026-04-08T00:05:00.000Z",
      }),
    );

    const service = new AiAgentPersonaTaskPersistenceService({
      deps: {
        overwriteContent,
        markTaskDone,
      },
    });

    const result = await service.persistGeneratedResult({
      generated: buildGenerationResult({
        task: buildTask({
          status: "RUNNING",
          resultId: "comment-1",
          resultType: "comment",
        }),
      }),
      sourceRuntime: "main_runtime",
    });

    expect(markTaskDone).toHaveBeenCalledWith({
      task: expect.objectContaining({
        id: "task-1",
        status: "RUNNING",
        resultId: "comment-1",
        resultType: "comment",
      }),
      resultId: "comment-1",
      resultType: "comment",
    });
    expect(result).toMatchObject({
      writeMode: "overwritten",
      historyId: "history-2",
      updatedTask: expect.objectContaining({
        status: "DONE",
        resultId: "comment-1",
        resultType: "comment",
      }),
    });
  });

  it("allows jobs-runtime callers to insert when no persisted target exists yet", async () => {
    const insertComment = vi.fn(async () => ({ id: "comment-new-2" }));
    const markTaskDone = vi.fn(async () =>
      buildTask({
        status: "DONE",
        resultId: "comment-new-2",
        resultType: "comment",
        completedAt: "2026-04-08T00:06:00.000Z",
      }),
    );

    const service = new AiAgentPersonaTaskPersistenceService({
      deps: {
        resolveCommentOwner: async () => ({
          postId: "post-1",
          parentId: "comment-source-1",
        }),
        insertComment,
        markTaskDone,
      },
    });

    const result = await service.persistGeneratedResult({
      generated: buildGenerationResult({
        task: buildTask({
          status: "PENDING",
          resultId: null,
          resultType: null,
        }),
      }),
      sourceRuntime: "jobs_runtime",
      jobTaskId: "job-2",
      createdBy: "admin-1",
    });

    expect(insertComment).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      taskId: "task-1",
      persistedTable: "comments",
      persistedId: "comment-new-2",
      resultType: "comment",
      writeMode: "inserted",
      historyId: null,
    });
  });

  it("treats reply generated output as comment persistence semantics", async () => {
    const insertComment = vi.fn(async () => ({ id: "comment-new-3" }));
    const markTaskDone = vi.fn(async () =>
      buildTask({
        status: "DONE",
        resultId: "comment-new-3",
        resultType: "comment",
      }),
    );
    const service = new AiAgentPersonaTaskPersistenceService({
      deps: {
        resolveCommentOwner: async () => ({
          postId: "post-1",
          parentId: "comment-source-1",
        }),
        insertComment,
        markTaskDone,
      },
    });

    const result = await service.persistGeneratedResult({
      generated: buildGenerationResult({
        parsedOutput: {
          kind: "reply",
          body: "thread-native reply body",
        },
      }),
      sourceRuntime: "text_runtime",
    });

    expect(insertComment).toHaveBeenCalledWith({
      postId: "post-1",
      parentId: "comment-source-1",
      personaId: "persona-1",
      body: "thread-native reply body",
    });
    expect(result.resultType).toBe("comment");
    expect(result.persistedTable).toBe("comments");
  });
});
