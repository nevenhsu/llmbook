import { describe, expect, it } from "vitest";
import {
  AiAgentAdminRunnerService,
  type AiAgentRunnerExecutedResponse,
  type AiAgentRunnerGuardedExecuteResponse,
  type AiAgentRunnerPreviewResponse,
} from "@/lib/ai/agent/execution/admin-runner-service";
import { buildMockAiAgentOverviewSnapshot } from "@/lib/ai/agent/testing/mock-overview-snapshot";

describe("AiAgentAdminRunnerService", () => {
  it("returns shared execution preview artifacts for text_once preview", async () => {
    const task = buildMockAiAgentOverviewSnapshot().recentTasks[0];
    const service = new AiAgentAdminRunnerService({
      deps: {
        loadTaskById: async (taskId) => (taskId === task?.id ? (task ?? null) : null),
      },
    });

    const result = await service.previewTarget({
      target: "text_once",
      taskId: task.id,
    });

    expect(result).toMatchObject({
      mode: "preview",
      target: "text_once",
      targetLabel: "Run next text task",
      available: true,
      blocker: null,
      selectedTaskId: task.id,
      summary: "Shared execution preview is available for the selected text task.",
    } satisfies Partial<AiAgentRunnerPreviewResponse>);
    expect(result.executionPreview?.taskCandidate.sourceId).toBe(task.sourceId);
  });

  it("guards media_once when the selected task does not have a persisted owner yet", async () => {
    const task = {
      ...buildMockAiAgentOverviewSnapshot().recentTasks[1],
      taskType: "post",
    };
    const service = new AiAgentAdminRunnerService({
      deps: {
        loadTaskById: async (taskId) => (taskId === task.id ? task : null),
      },
    });

    const result = await service.executeTarget({
      target: "media_once",
      taskId: task.id,
    });

    expect(result).toEqual<AiAgentRunnerGuardedExecuteResponse>({
      mode: "guarded_execute",
      target: "media_once",
      targetLabel: "Run next media task",
      blocker: "persisted_owner_required",
      selectedTaskId: task.id,
      summary:
        "Media generation currently requires a completed text task with a persisted post or comment owner.",
      executionPreview: expect.any(Object),
    });
  });

  it("executes compress_once through the shared memory service", async () => {
    const service = new AiAgentAdminRunnerService({
      deps: {
        compressNextPersona: async () => ({
          mode: "persisted",
          personaId: "persona-1",
          summary: "Persisted canonical long memory.",
          compressionPreview: {
            compressionResult: {},
            compressionAuditResult: {},
            renderedLongMemory: "# Canonical Memory",
            cleanupPreview: {
              deleteIds: ["m1"],
              protectedIds: [],
            },
          },
          persistedLongMemoryId: "long-memory-1",
          deletedShortMemoryIds: ["m1"],
          protectedShortMemoryIds: [],
          verificationTrace: {
            persistedLongMemoryId: "long-memory-1",
            persistedLongMemory: {
              id: "long-memory-1",
              personaId: "persona-1",
              username: "ai_orchid",
              displayName: "Orchid",
              memoryType: "long_memory",
              scope: "persona",
              threadId: null,
              boardId: null,
              content: "# Canonical Memory",
              metadata: {},
              expiresAt: null,
              importance: null,
              createdAt: "2026-03-29T12:00:00.000Z",
              updatedAt: "2026-03-29T12:00:00.000Z",
              sourceKind: "compression",
              continuityKind: "stable_persona",
              hasOpenLoop: false,
              promotionCandidate: false,
            },
            cleanup: {
              deletedShortMemoryIds: ["m1"],
              protectedShortMemoryIds: [],
            },
          },
          preview: {} as any,
        }),
      },
    });

    const result = await service.executeTarget({
      target: "compress_once",
    });

    expect(result).toEqual<AiAgentRunnerExecutedResponse>({
      mode: "executed",
      target: "compress_once",
      targetLabel: "Run next compression batch",
      selectedTaskId: null,
      summary: "Persisted compression for persona-1 and removed 1 short-memory rows.",
      executionPreview: null,
      compressionResult: {
        mode: "persisted",
        personaId: "persona-1",
        summary: "Persisted canonical long memory.",
        compressionPreview: {
          compressionResult: {},
          compressionAuditResult: {},
          renderedLongMemory: "# Canonical Memory",
          cleanupPreview: {
            deleteIds: ["m1"],
            protectedIds: [],
          },
        },
        persistedLongMemoryId: "long-memory-1",
        deletedShortMemoryIds: ["m1"],
        protectedShortMemoryIds: [],
        verificationTrace: {
          persistedLongMemoryId: "long-memory-1",
          persistedLongMemory: {
            id: "long-memory-1",
            personaId: "persona-1",
            username: "ai_orchid",
            displayName: "Orchid",
            memoryType: "long_memory",
            scope: "persona",
            threadId: null,
            boardId: null,
            content: "# Canonical Memory",
            metadata: {},
            expiresAt: null,
            importance: null,
            createdAt: "2026-03-29T12:00:00.000Z",
            updatedAt: "2026-03-29T12:00:00.000Z",
            sourceKind: "compression",
            continuityKind: "stable_persona",
            hasOpenLoop: false,
            promotionCandidate: false,
          },
          cleanup: {
            deletedShortMemoryIds: ["m1"],
            protectedShortMemoryIds: [],
          },
        },
        preview: {} as any,
      },
      textResult: null,
      mediaResult: null,
      orchestratorResult: null,
    });
  });

  it("executes text_once through the shared text persistence path", async () => {
    const task = buildMockAiAgentOverviewSnapshot().recentTasks[0];
    const service = new AiAgentAdminRunnerService({
      deps: {
        loadTaskById: async (taskId) => (taskId === task.id ? task : null),
        executeTextTask: async () => ({
          taskId: task.id,
          persistedTable: "comments",
          persistedId: "comment-new-1",
          resultType: "comment",
          updatedTask: {
            ...task,
            status: "DONE",
            resultId: "comment-new-1",
            resultType: "comment",
            completedAt: "2026-03-30T00:00:00.000Z",
          },
        }),
      },
    });

    const result = await service.executeTarget({
      target: "text_once",
      taskId: task.id,
    });

    expect(result).toEqual<AiAgentRunnerExecutedResponse>({
      mode: "executed",
      target: "text_once",
      targetLabel: "Run next text task",
      selectedTaskId: task.id,
      summary: `Persisted comment comment-new-1 and completed queue task ${task.id}.`,
      executionPreview: expect.any(Object),
      compressionResult: null,
      textResult: {
        taskId: task.id,
        persistedTable: "comments",
        persistedId: "comment-new-1",
        resultType: "comment",
        updatedTask: {
          ...task,
          status: "DONE",
          resultId: "comment-new-1",
          resultType: "comment",
          completedAt: "2026-03-30T00:00:00.000Z",
        },
      },
      mediaResult: null,
      orchestratorResult: null,
    });
  });

  it("executes orchestrator_once by chaining injection, public text execution, media dispatch, and compression", async () => {
    const publicTask = {
      ...buildMockAiAgentOverviewSnapshot().recentTasks[1],
      id: "task-public-1",
      dispatchKind: "public" as const,
      sourceTable: "posts" as const,
      sourceId: "post-source-1",
      taskType: "post",
      payload: {
        contentType: "post",
        source: "public-post",
      },
    };
    const service = new AiAgentAdminRunnerService({
      deps: {
        executeIntakeInjection: async (kind) => ({
          mode: "executed",
          kind,
          message: `Inserted ${kind} tasks`,
          injectionPreview: {} as any,
          insertedTasks: kind === "public" ? [publicTask] : [],
        }),
        executeTextTask: async () => ({
          taskId: publicTask.id,
          persistedTable: "posts",
          persistedId: "post-new-2",
          resultType: "post",
          updatedTask: {
            ...publicTask,
            status: "DONE",
            resultId: "post-new-2",
            resultType: "post",
            completedAt: "2026-03-30T01:00:00.000Z",
          },
        }),
        executeMediaTask: async () => ({
          taskId: publicTask.id,
          mediaId: "media-orch-1",
          ownerTable: "posts" as const,
          ownerId: "post-new-2",
          status: "DONE",
          imagePrompt: "An impossible deep-sea deity",
          imageAlt: "Deep-sea deity",
          url: "https://cdn.test/media-orch-1.png",
          mimeType: "image/png",
          width: 1024,
          height: 1024,
          sizeBytes: 2048,
          retryCount: 0,
          maxRetries: 3,
          nextRetryAt: null,
          lastError: null,
        }),
        compressNextPersona: async () => null,
      },
    });

    const result = await service.executeTarget({
      target: "orchestrator_once",
    });

    expect(result).toEqual<AiAgentRunnerExecutedResponse>({
      mode: "executed",
      target: "orchestrator_once",
      targetLabel: "Run orchestrator once",
      selectedTaskId: "task-public-1",
      summary:
        "Injected 0 notification tasks, 1 public tasks, executed 1 text task, queued 1 media job, and skipped compression.",
      executionPreview: expect.any(Object),
      compressionResult: null,
      textResult: {
        taskId: "task-public-1",
        persistedTable: "posts",
        persistedId: "post-new-2",
        resultType: "post",
        updatedTask: {
          ...publicTask,
          status: "DONE",
          resultId: "post-new-2",
          resultType: "post",
          completedAt: "2026-03-30T01:00:00.000Z",
        },
      },
      mediaResult: {
        taskId: "task-public-1",
        mediaId: "media-orch-1",
        ownerTable: "posts",
        ownerId: "post-new-2",
        status: "DONE",
        imagePrompt: "An impossible deep-sea deity",
        imageAlt: "Deep-sea deity",
        url: "https://cdn.test/media-orch-1.png",
        mimeType: "image/png",
        width: 1024,
        height: 1024,
        sizeBytes: 2048,
        retryCount: 0,
        maxRetries: 3,
        nextRetryAt: null,
        lastError: null,
      },
      orchestratorResult: {
        injectedNotificationTasks: 0,
        injectedPublicTasks: 1,
        notificationInjection: {
          mode: "executed",
          kind: "notification",
          message: "Inserted notification tasks",
          injectionPreview: {} as any,
          insertedTasks: [],
        },
        publicInjection: {
          mode: "executed",
          kind: "public",
          message: "Inserted public tasks",
          injectionPreview: {} as any,
          insertedTasks: [publicTask],
        },
        executedTextTask: {
          taskId: "task-public-1",
          persistedTable: "posts",
          persistedId: "post-new-2",
          resultType: "post",
          updatedTask: {
            ...publicTask,
            status: "DONE",
            resultId: "post-new-2",
            resultType: "post",
            completedAt: "2026-03-30T01:00:00.000Z",
          },
        },
        executedMediaTask: {
          taskId: "task-public-1",
          mediaId: "media-orch-1",
          ownerTable: "posts",
          ownerId: "post-new-2",
          status: "DONE",
          imagePrompt: "An impossible deep-sea deity",
          imageAlt: "Deep-sea deity",
          url: "https://cdn.test/media-orch-1.png",
          mimeType: "image/png",
          width: 1024,
          height: 1024,
          sizeBytes: 2048,
          retryCount: 0,
          maxRetries: 3,
          nextRetryAt: null,
          lastError: null,
        },
        compressionResult: null,
      },
    });
  });

  it("allows notification-backed text execution when the task payload carries canonical target ids", async () => {
    const task = {
      ...buildMockAiAgentOverviewSnapshot().recentTasks[1],
      taskType: "reply",
      payload: {
        contentType: "reply",
        source: "notification",
        notificationTarget: {
          postId: "post-1",
          commentId: "comment-1",
          parentCommentId: null,
          context: "comment",
          notificationType: "mention",
        },
      },
    };
    const service = new AiAgentAdminRunnerService({
      deps: {
        loadTaskById: async (taskId) => (taskId === task.id ? task : null),
        executeTextTask: async () => ({
          taskId: task.id,
          persistedTable: "comments",
          persistedId: "comment-new-3",
          resultType: "comment",
          updatedTask: {
            ...task,
            status: "DONE",
            resultId: "comment-new-3",
            resultType: "comment",
            completedAt: "2026-03-30T02:00:00.000Z",
          },
        }),
      },
    });

    const result = await service.executeTarget({
      target: "text_once",
      taskId: task.id,
    });

    expect(result).toEqual<AiAgentRunnerExecutedResponse>({
      mode: "executed",
      target: "text_once",
      targetLabel: "Run next text task",
      selectedTaskId: task.id,
      summary: `Persisted comment comment-new-3 and completed queue task ${task.id}.`,
      executionPreview: expect.any(Object),
      compressionResult: null,
      textResult: {
        taskId: task.id,
        persistedTable: "comments",
        persistedId: "comment-new-3",
        resultType: "comment",
        updatedTask: {
          ...task,
          status: "DONE",
          resultId: "comment-new-3",
          resultType: "comment",
          completedAt: "2026-03-30T02:00:00.000Z",
        },
      },
      mediaResult: null,
      orchestratorResult: null,
    });
  });

  it("allows notification-backed post execution when the task payload carries a source post id", async () => {
    const task = {
      ...buildMockAiAgentOverviewSnapshot().recentTasks[1],
      taskType: "post",
      payload: {
        contentType: "mention",
        source: "notification",
        notificationTarget: {
          postId: "post-1",
          commentId: null,
          parentCommentId: null,
          context: "post",
          notificationType: "mention",
        },
      },
    };
    const service = new AiAgentAdminRunnerService({
      deps: {
        loadTaskById: async (taskId) => (taskId === task.id ? task : null),
        executeTextTask: async () => ({
          taskId: task.id,
          persistedTable: "posts",
          persistedId: "post-new-3",
          resultType: "post",
          updatedTask: {
            ...task,
            status: "DONE",
            resultId: "post-new-3",
            resultType: "post",
            completedAt: "2026-03-30T03:00:00.000Z",
          },
        }),
      },
    });

    const result = await service.executeTarget({
      target: "text_once",
      taskId: task.id,
    });

    expect(result).toEqual<AiAgentRunnerExecutedResponse>({
      mode: "executed",
      target: "text_once",
      targetLabel: "Run next text task",
      selectedTaskId: task.id,
      summary: `Persisted post post-new-3 and completed queue task ${task.id}.`,
      executionPreview: expect.any(Object),
      compressionResult: null,
      textResult: {
        taskId: task.id,
        persistedTable: "posts",
        persistedId: "post-new-3",
        resultType: "post",
        updatedTask: {
          ...task,
          status: "DONE",
          resultId: "post-new-3",
          resultType: "post",
          completedAt: "2026-03-30T03:00:00.000Z",
        },
      },
      mediaResult: null,
      orchestratorResult: null,
    });
  });

  it("previews and executes media_once for a completed image-backed post task", async () => {
    const task = {
      ...buildMockAiAgentOverviewSnapshot().recentTasks[1],
      status: "DONE" as const,
      resultId: "post-persisted-1",
      resultType: "post",
      completedAt: "2026-03-30T04:00:00.000Z",
    };
    const service = new AiAgentAdminRunnerService({
      deps: {
        loadTaskById: async (taskId) => (taskId === task.id ? task : null),
        executeMediaTask: async () => ({
          taskId: task.id,
          mediaId: "media-1",
          ownerTable: "posts" as const,
          ownerId: "post-persisted-1",
          status: "DONE",
          imagePrompt: "A dramatic cosmic scene",
          imageAlt: "Cosmic scene",
          url: "https://cdn.test/media-1.png",
          mimeType: "image/png",
          width: 1024,
          height: 1024,
          sizeBytes: 4096,
          retryCount: 0,
          maxRetries: 3,
          nextRetryAt: null,
          lastError: null,
        }),
      },
    });

    const preview = await service.previewTarget({
      target: "media_once",
      taskId: task.id,
    });

    expect(preview).toMatchObject({
      mode: "preview",
      target: "media_once",
      targetLabel: "Run next media task",
      available: true,
      blocker: null,
      selectedTaskId: task.id,
      summary:
        "Shared execution preview includes a ready media write-plan for the selected completed task.",
    } satisfies Partial<AiAgentRunnerPreviewResponse>);
    expect(preview.executionPreview?.writePlan.mediaWrite).toBeTruthy();

    const result = await service.executeTarget({
      target: "media_once",
      taskId: task.id,
    });

    expect(result).toEqual<AiAgentRunnerExecutedResponse>({
      mode: "executed",
      target: "media_once",
      targetLabel: "Run next media task",
      selectedTaskId: task.id,
      summary: "Generated media media-1 for post post-persisted-1.",
      executionPreview: expect.any(Object),
      compressionResult: null,
      textResult: null,
      mediaResult: {
        taskId: task.id,
        mediaId: "media-1",
        ownerTable: "posts",
        ownerId: "post-persisted-1",
        status: "DONE",
        imagePrompt: "A dramatic cosmic scene",
        imageAlt: "Cosmic scene",
        url: "https://cdn.test/media-1.png",
        mimeType: "image/png",
        width: 1024,
        height: 1024,
        sizeBytes: 4096,
        retryCount: 0,
        maxRetries: 3,
        nextRetryAt: null,
        lastError: null,
      },
      orchestratorResult: null,
    });
  });
});
