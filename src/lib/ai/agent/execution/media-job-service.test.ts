import { describe, expect, it, vi } from "vitest";
import { AiAgentMediaJobService } from "@/lib/ai/agent/execution/media-job-service";
import { buildMockAiAgentOverviewSnapshot } from "@/lib/ai/agent/testing/mock-overview-snapshot";

describe("AiAgentMediaJobService", () => {
  it("reuses an existing completed media row instead of regenerating", async () => {
    const task = {
      ...buildMockAiAgentOverviewSnapshot().recentTasks[1],
      status: "DONE" as const,
      resultId: "post-1",
      resultType: "post",
      payload: {
        contentType: "post",
        source: "public-post",
      },
    };
    const generateArtifact = vi.fn();
    const service = new AiAgentMediaJobService({
      deps: {
        findExistingJob: async () => ({
          id: "media-1",
          persona_id: task.personaId,
          post_id: "post-1",
          comment_id: null,
          status: "DONE",
          image_prompt:
            "Eldritch cosmic horror creature emerging from dark depths, tentacles and impossible geometry, bioluminescent accents, massive scale compared to a small human figure in the background, nightmarish but visually striking, dark oceanic palette with unnatural green highlights, concept art style",
          url: "https://cdn.test/media-1.png",
          mime_type: "image/png",
          width: 1024,
          height: 1024,
          size_bytes: 2048,
        }),
        generateArtifact,
      },
    });

    const result = await service.executeForTask(task);

    expect(result).toEqual({
      taskId: task.id,
      mediaId: "media-1",
      ownerTable: "posts",
      ownerId: "post-1",
      status: "DONE",
      imagePrompt:
        "Eldritch cosmic horror creature emerging from dark depths, tentacles and impossible geometry, bioluminescent accents, massive scale compared to a small human figure in the background, nightmarish but visually striking, dark oceanic palette with unnatural green highlights, concept art style",
      imageAlt:
        "A dark atmospheric illustration of a cosmic horror sea creature rising from shadowy depths with tentacles and impossible geometry.",
      url: "https://cdn.test/media-1.png",
      mimeType: "image/png",
      width: 1024,
      height: 1024,
      sizeBytes: 2048,
    });
    expect(generateArtifact).not.toHaveBeenCalled();
  });

  it("creates, generates, uploads, and completes a pending media job", async () => {
    const task = {
      ...buildMockAiAgentOverviewSnapshot().recentTasks[1],
      status: "DONE" as const,
      resultId: "post-2",
      resultType: "post",
      payload: {
        contentType: "post",
        source: "public-post",
      },
    };
    const service = new AiAgentMediaJobService({
      deps: {
        findExistingJob: async () => null,
        createPendingJob: async () => ({
          id: "media-2",
          persona_id: task.personaId,
          post_id: "post-2",
          comment_id: null,
          status: "PENDING_GENERATION",
          image_prompt: "prompt",
          url: null,
          mime_type: null,
          width: null,
          height: null,
          size_bytes: null,
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
        markJobDone: async () => ({
          id: "media-2",
          persona_id: task.personaId,
          post_id: "post-2",
          comment_id: null,
          status: "DONE",
          image_prompt: "prompt",
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

  it("marks the pending row as FAILED when generation crashes", async () => {
    const task = {
      ...buildMockAiAgentOverviewSnapshot().recentTasks[1],
      status: "DONE" as const,
      resultId: "post-3",
      resultType: "post",
      payload: {
        contentType: "post",
        source: "public-post",
      },
    };
    const markJobFailed = vi.fn(async () => undefined);
    const service = new AiAgentMediaJobService({
      deps: {
        findExistingJob: async () => null,
        createPendingJob: async () => ({
          id: "media-3",
          persona_id: task.personaId,
          post_id: "post-3",
          comment_id: null,
          status: "PENDING_GENERATION",
          image_prompt: "prompt",
          url: null,
          mime_type: null,
          width: null,
          height: null,
          size_bytes: null,
        }),
        generateArtifact: async () => {
          throw new Error("boom");
        },
        markJobFailed,
      },
    });

    await expect(service.executeForTask(task)).rejects.toThrow("boom");
    expect(markJobFailed).toHaveBeenCalledWith("media-3");
  });
});
