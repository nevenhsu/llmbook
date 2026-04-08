import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { AiAgentMediaJobService } from "@/lib/ai/agent/execution/media-job-service";
import { buildMockAiAgentOverviewSnapshot } from "@/lib/ai/agent/testing/mock-overview-snapshot";

function buildMediaRow(overrides: Partial<any> = {}) {
  return {
    id: overrides.id ?? "media-1",
    persona_id: overrides.persona_id ?? "persona-2",
    post_id: overrides.post_id ?? "post-1",
    comment_id: overrides.comment_id ?? null,
    status: overrides.status ?? "PENDING_GENERATION",
    image_prompt: overrides.image_prompt ?? "prompt",
    url: overrides.url ?? null,
    mime_type: overrides.mime_type ?? null,
    width: overrides.width ?? null,
    height: overrides.height ?? null,
    size_bytes: overrides.size_bytes ?? null,
    retry_count: overrides.retry_count ?? 0,
    max_retries: overrides.max_retries ?? 3,
    next_retry_at: overrides.next_retry_at ?? null,
    last_error: overrides.last_error ?? null,
    created_at: overrides.created_at ?? "2026-03-30T00:00:00.000Z",
  };
}

describe("AiAgentMediaJobService", () => {
  it("queues a pending media row without generating when only enqueueing from a completed text task", async () => {
    const task = {
      ...buildMockAiAgentOverviewSnapshot().recentTasks[1],
      status: "DONE" as const,
      resultId: "post-2",
      resultType: "post",
    };
    const generateArtifact = vi.fn();
    const service = new AiAgentMediaJobService({
      deps: {
        findExistingJob: async () => null,
        createPendingJob: async () =>
          buildMediaRow({
            id: "media-queued-1",
            post_id: "post-2",
          }),
        generateArtifact,
      },
    });

    const result = await service.ensurePendingJobForTask(task);

    expect(result).toEqual({
      taskId: task.id,
      mediaId: "media-queued-1",
      ownerTable: "posts",
      ownerId: "post-2",
      status: "PENDING_GENERATION",
      imagePrompt: "prompt",
      imageAlt:
        "A dark atmospheric illustration of a cosmic horror sea creature rising from shadowy depths with tentacles and impossible geometry.",
      url: null,
      mimeType: null,
      width: null,
      height: null,
      sizeBytes: null,
      retryCount: 0,
      maxRetries: 3,
      nextRetryAt: null,
      lastError: null,
    });
    expect(generateArtifact).not.toHaveBeenCalled();
  });

  it("reuses an existing completed media row instead of regenerating", async () => {
    const task = {
      ...buildMockAiAgentOverviewSnapshot().recentTasks[1],
      status: "DONE" as const,
      resultId: "post-1",
      resultType: "post",
    };
    const generateArtifact = vi.fn();
    const service = new AiAgentMediaJobService({
      deps: {
        findExistingJob: async () =>
          buildMediaRow({
            id: "media-1",
            status: "DONE",
            url: "https://cdn.test/media-1.png",
            mime_type: "image/png",
            width: 1024,
            height: 1024,
            size_bytes: 2048,
            post_id: "post-1",
          }),
        generateArtifact,
      },
    });

    const result = await service.executeForTask(task);

    expect(result.status).toBe("DONE");
    expect(result.url).toBe("https://cdn.test/media-1.png");
    expect(result.retryCount).toBe(0);
    expect(generateArtifact).not.toHaveBeenCalled();
  });

  it("creates, runs, uploads, and completes a pending media job", async () => {
    const task = {
      ...buildMockAiAgentOverviewSnapshot().recentTasks[1],
      status: "DONE" as const,
      resultId: "post-2",
      resultType: "post",
    };
    const service = new AiAgentMediaJobService({
      deps: {
        findExistingJob: async () => null,
        createPendingJob: async () =>
          buildMediaRow({
            id: "media-2",
            post_id: "post-2",
          }),
        markJobRunning: async () =>
          buildMediaRow({
            id: "media-2",
            post_id: "post-2",
            status: "RUNNING",
          }),
        generateArtifact: async () => ({
          buffer: Buffer.from("image"),
          mimeType: "image/png",
          width: 512,
          height: 512,
          sizeBytes: 5,
          extension: "png",
        }),
        uploadArtifact: async () => ({
          url: "https://cdn.test/media-2.png",
        }),
        markJobDone: async () =>
          buildMediaRow({
            id: "media-2",
            post_id: "post-2",
            status: "DONE",
            url: "https://cdn.test/media-2.png",
            mime_type: "image/png",
            width: 512,
            height: 512,
            size_bytes: 5,
          }),
      },
    });

    const result = await service.executeForTask(task);

    expect(result.status).toBe("DONE");
    expect(result.url).toBe("https://cdn.test/media-2.png");
    expect(result.width).toBe(512);
    expect(result.height).toBe(512);
  });

  it("returns the oldest ready pending media row when claiming queue work", async () => {
    const service = new AiAgentMediaJobService({
      deps: {
        claimNextReadyJob: async () =>
          buildMediaRow({
            id: "media-next-1",
            status: "RUNNING",
          }),
      },
    });

    const result = await service.claimNextReadyJob();

    expect(result?.id).toBe("media-next-1");
    expect(result?.status).toBe("RUNNING");
  });

  it("allows rerunning a completed media row and overwriting its artifact metadata", async () => {
    const service = new AiAgentMediaJobService({
      deps: {
        loadJobById: async () =>
          buildMediaRow({
            id: "media-done-1",
            status: "DONE",
            url: "https://cdn.test/old.png",
          }),
        markJobRunning: async () =>
          buildMediaRow({
            id: "media-done-1",
            status: "RUNNING",
            url: null,
          }),
        generateArtifact: async () => ({
          buffer: Buffer.from("image-new"),
          mimeType: "image/png",
          width: 640,
          height: 640,
          sizeBytes: 9,
          extension: "png",
        }),
        uploadArtifact: async () => ({
          url: "https://cdn.test/new.png",
        }),
        markJobDone: async () =>
          buildMediaRow({
            id: "media-done-1",
            status: "DONE",
            url: "https://cdn.test/new.png",
            mime_type: "image/png",
            width: 640,
            height: 640,
            size_bytes: 9,
          }),
      },
    });

    const result = await service.rerunJobById("media-done-1");

    expect(result.status).toBe("DONE");
    expect(result.url).toBe("https://cdn.test/new.png");
    expect(result.width).toBe(640);
  });

  it("records retry metadata when queued generation crashes", async () => {
    const task = {
      ...buildMockAiAgentOverviewSnapshot().recentTasks[1],
      status: "DONE" as const,
      resultId: "post-3",
      resultType: "post",
    };
    const updateFailureState = vi.fn(async () =>
      buildMediaRow({
        id: "media-3",
        post_id: "post-3",
        status: "PENDING_GENERATION",
        retry_count: 1,
        next_retry_at: "2026-03-30T00:05:00.000Z",
        last_error: "boom",
      }),
    );
    const service = new AiAgentMediaJobService({
      deps: {
        findExistingJob: async () => null,
        createPendingJob: async () =>
          buildMediaRow({
            id: "media-3",
            post_id: "post-3",
          }),
        markJobRunning: async () =>
          buildMediaRow({
            id: "media-3",
            post_id: "post-3",
            status: "RUNNING",
          }),
        generateArtifact: async () => {
          throw new Error("boom");
        },
        updateFailureState,
      },
    });

    await expect(service.executeForTask(task)).rejects.toThrow("boom");
    expect(updateFailureState).toHaveBeenCalledWith({
      row: expect.objectContaining({
        id: "media-3",
        status: "RUNNING",
      }),
      errorMessage: "boom",
    });
  });
});
