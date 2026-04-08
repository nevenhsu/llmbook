import { describe, expect, it, vi } from "vitest";
import { AiAgentContentMutationService } from "@/lib/ai/agent/execution/content-mutation-service";

describe("AiAgentContentMutationService", () => {
  it("appends comment history before overwriting the live comment body", async () => {
    const insertHistory = vi.fn(async () => ({ id: "history-1" }));
    const updateComment = vi.fn(async () => undefined);

    const service = new AiAgentContentMutationService({
      deps: {
        loadCommentTarget: async () => ({
          id: "comment-1",
          body: "old comment body",
        }),
        insertHistory,
        deleteHistory: vi.fn(async () => undefined),
        updateComment,
      },
    });

    const result = await service.overwriteContent({
      targetType: "comment",
      targetId: "comment-1",
      nextContent: {
        body: "new comment body",
      },
      jobTaskId: "job-1",
      sourceRuntime: "jobs_runtime",
      sourceKind: "persona_task",
      sourceId: "task-1",
      createdBy: "admin-1",
    });

    expect(insertHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: "comment",
        targetId: "comment-1",
        jobTaskId: "job-1",
        sourceRuntime: "jobs_runtime",
        sourceKind: "persona_task",
        sourceId: "task-1",
        previousSnapshot: {
          schema_version: 1,
          body: "old comment body",
        },
      }),
    );
    expect(updateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        commentId: "comment-1",
        body: "new comment body",
      }),
    );
    expect(result).toMatchObject({
      targetType: "comment",
      targetId: "comment-1",
      historyId: "history-1",
      previousSnapshot: {
        schema_version: 1,
        body: "old comment body",
      },
    });
  });

  it("stores previous post tags in history and replaces post tags on overwrite", async () => {
    const replacePostTags = vi.fn(async () => undefined);
    const resolveTagIds = vi.fn(async () => ["tag-1", "tag-2"]);

    const service = new AiAgentContentMutationService({
      deps: {
        loadPostTarget: async () => ({
          id: "post-1",
          title: "Old title",
          body: "Old body",
          post_tags: [
            { tag: { name: "old-tag", slug: "old-tag" } },
            { tag: { name: "legacy", slug: "legacy" } },
          ],
        }),
        insertHistory: async () => ({ id: "history-2" }),
        deleteHistory: vi.fn(async () => undefined),
        updatePost: vi.fn(async () => undefined),
        resolveTagIds,
        replacePostTags,
      },
    });

    const result = await service.overwriteContent({
      targetType: "post",
      targetId: "post-1",
      nextContent: {
        title: "New title",
        body: "New body",
        tags: ["fresh", "story"],
      },
      jobTaskId: "job-2",
      sourceRuntime: "jobs_runtime",
      sourceKind: "persona_task",
      sourceId: "task-2",
    });

    expect(resolveTagIds).toHaveBeenCalledWith(["fresh", "story"]);
    expect(replacePostTags).toHaveBeenCalledWith({
      postId: "post-1",
      tagIds: ["tag-1", "tag-2"],
    });
    expect(result.previousSnapshot).toEqual({
      schema_version: 1,
      title: "Old title",
      body: "Old body",
      tags: ["old-tag", "legacy"],
    });
  });

  it("deletes the appended history row when the live overwrite fails", async () => {
    const deleteHistory = vi.fn(async () => undefined);

    const service = new AiAgentContentMutationService({
      deps: {
        loadCommentTarget: async () => ({
          id: "comment-9",
          body: "before",
        }),
        insertHistory: async () => ({ id: "history-failed" }),
        deleteHistory,
        updateComment: async () => {
          throw new Error("boom");
        },
      },
    });

    await expect(
      service.overwriteContent({
        targetType: "comment",
        targetId: "comment-9",
        nextContent: {
          body: "after",
        },
        sourceRuntime: "jobs_runtime",
        sourceKind: "persona_task",
      }),
    ).rejects.toThrow("boom");

    expect(deleteHistory).toHaveBeenCalledWith("history-failed");
  });
});
