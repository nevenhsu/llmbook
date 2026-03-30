import { describe, expect, it, vi } from "vitest";
import { AiAgentMediaAdminService } from "@/lib/ai/agent/execution/media-admin-service";

describe("AiAgentMediaAdminService", () => {
  it("returns recent jobs with a status summary", async () => {
    const service = new AiAgentMediaAdminService({
      deps: {
        loadJobs: async () => [
          {
            id: "media-1",
            personaId: "persona-1",
            personaUsername: "ai_orchid",
            personaDisplayName: "Orchid",
            postId: "post-1",
            commentId: null,
            status: "DONE",
            imagePrompt: "orchid poster",
            url: "https://cdn.test/one.png",
            mimeType: "image/png",
            width: 1024,
            height: 1024,
            sizeBytes: 1234,
            createdAt: "2026-03-30T01:00:00.000Z",
          },
          {
            id: "media-2",
            personaId: "persona-2",
            personaUsername: "ai_lotus",
            personaDisplayName: "Lotus",
            postId: null,
            commentId: "comment-1",
            status: "FAILED",
            imagePrompt: "lotus reply image",
            url: null,
            mimeType: null,
            width: null,
            height: null,
            sizeBytes: null,
            createdAt: "2026-03-30T00:00:00.000Z",
          },
        ],
      },
    });

    const result = await service.listRecentJobs({ limit: 12 });

    expect(result.jobs).toHaveLength(2);
    expect(result.summary).toEqual({
      pending: 0,
      running: 0,
      done: 1,
      failed: 1,
      total: 2,
    });
    expect(result.fetchedAt).toMatch(/T/);
  });

  it("returns job detail through the shared detail contract", async () => {
    const service = new AiAgentMediaAdminService({
      deps: {
        loadJobs: async () => [],
        loadJobDetail: async () => ({
          job: {
            id: "media-1",
            personaId: "persona-1",
            personaUsername: "ai_orchid",
            personaDisplayName: "Orchid",
            postId: "post-1",
            commentId: null,
            status: "DONE",
            imagePrompt: "orchid poster",
            url: "https://cdn.test/one.png",
            mimeType: "image/png",
            width: 1024,
            height: 1024,
            sizeBytes: 1234,
            createdAt: "2026-03-30T01:00:00.000Z",
          },
          owner: {
            ownerType: "post",
            ownerId: "post-1",
            postId: "post-1",
            boardSlug: "art",
            title: "Generated orchid poster",
            bodyPreview: "A generated orchid poster.",
            status: "PUBLISHED",
            path: "/r/art/posts/post-1",
          },
          fetchedAt: "2026-03-30T01:05:00.000Z",
        }),
      },
    });

    const result = await service.getJobDetail("media-1");

    expect(result.job.id).toBe("media-1");
    expect(result.owner.ownerType).toBe("post");
    expect(result.owner.path).toBe("/r/art/posts/post-1");
  });

  it("passes filters into the shared list loader", async () => {
    const loadJobs = vi.fn(async () => []);
    const service = new AiAgentMediaAdminService({
      deps: {
        loadJobs,
        loadJobDetail: async () => {
          throw new Error("unused");
        },
      },
    });

    await service.listRecentJobs({
      limit: 20,
      status: "FAILED",
      query: "orchid",
    });

    expect(loadJobs).toHaveBeenCalledWith({
      limit: 20,
      status: "FAILED",
      query: "orchid",
    });
  });
});
