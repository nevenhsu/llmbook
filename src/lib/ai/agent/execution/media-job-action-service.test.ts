import { describe, expect, it, vi } from "vitest";
import { AiAgentMediaJobActionService } from "@/lib/ai/agent/execution/media-job-action-service";

const baseDetail = {
  job: {
    id: "media-1",
    personaId: "persona-1",
    personaUsername: "ai_orchid",
    personaDisplayName: "Orchid",
    postId: "post-1",
    commentId: null,
    status: "FAILED" as const,
    imagePrompt: "orchid poster",
    url: null,
    mimeType: null,
    width: null,
    height: null,
    sizeBytes: null,
    retryCount: 1,
    maxRetries: 3,
    nextRetryAt: "2026-03-30T00:05:00.000Z",
    lastError: "boom",
    createdAt: "2026-03-30T00:00:00.000Z",
  },
  owner: {
    ownerType: "post" as const,
    ownerId: "post-1",
    postId: "post-1",
    boardSlug: "board",
    title: "Generated post",
    bodyPreview: "Preview",
    status: "PUBLISHED",
    path: "/r/board/posts/post-1",
  },
  fetchedAt: "2026-03-30T00:01:00.000Z",
};

describe("AiAgentMediaJobActionService", () => {
  it("returns a blocked preview for completed rows", async () => {
    const service = new AiAgentMediaJobActionService({
      deps: {
        getJobDetail: async () => ({
          ...baseDetail,
          job: { ...baseDetail.job, status: "DONE", url: "https://cdn.test/done.png" },
        }),
      },
    });

    const result = await service.previewAction("media-1");

    expect(result.actionPreview.enabled).toBe(false);
    expect(result.actionPreview.reasonCode).toBe("DONE_ROW");
    expect(result.actionPreview.reason).toContain("completed media rows");
  });

  it("reruns failed rows and returns updated detail", async () => {
    const rerunJobById = vi.fn(async () => undefined);
    const getJobDetail = vi
      .fn()
      .mockResolvedValueOnce(baseDetail)
      .mockResolvedValueOnce({
        ...baseDetail,
        job: { ...baseDetail.job, status: "DONE", url: "https://cdn.test/done.png" },
      });

    const service = new AiAgentMediaJobActionService({
      deps: {
        getJobDetail,
        rerunJobById,
      },
    });

    const result = await service.executeAction("media-1");

    expect(rerunJobById).toHaveBeenCalledWith("media-1");
    expect(result.updatedDetail.job.status).toBe("DONE");
    expect(result.actionPreview.reasonCode).toBe("RETRY_READY");
    expect(result.message).toBe("retry_generation executed against media.");
  });

  it("returns a specific blocker when owner linkage is missing", async () => {
    const service = new AiAgentMediaJobActionService({
      deps: {
        getJobDetail: async () => ({
          ...baseDetail,
          owner: {
            ...baseDetail.owner,
            ownerType: "unknown",
            ownerId: null,
            path: null,
          },
        }),
      },
    });

    const result = await service.previewAction("media-1");

    expect(result.actionPreview.enabled).toBe(false);
    expect(result.actionPreview.reasonCode).toBe("MISSING_OWNER_LINKAGE");
  });
});
