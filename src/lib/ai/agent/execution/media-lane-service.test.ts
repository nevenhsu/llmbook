import { describe, expect, it } from "vitest";
import { AiAgentMediaLaneService } from "@/lib/ai/agent/execution/media-lane-service";

describe("AiAgentMediaLaneService", () => {
  it("returns idle when no queued media row is ready", async () => {
    const service = new AiAgentMediaLaneService({
      deps: {
        claimNextReadyJob: async () => null,
      },
    });

    await expect(
      service.runNext({
        workerId: "media-worker:test",
      }),
    ).resolves.toEqual({
      mode: "idle",
      summary: "No pending media job is ready right now.",
    });
  });

  it("claims and executes the next queued media row", async () => {
    const service = new AiAgentMediaLaneService({
      deps: {
        claimNextReadyJob: async () => ({
          id: "media-1",
        }),
        executeQueuedJobById: async () => ({
          id: "media-1",
          persona_id: "persona-1",
          post_id: "post-1",
          comment_id: null,
          status: "DONE",
          image_prompt: "orchid poster",
          url: "https://cdn.test/media-1.png",
          mime_type: "image/png",
          width: 1024,
          height: 1024,
          size_bytes: 1234,
          retry_count: 0,
          max_retries: 3,
          next_retry_at: null,
          last_error: null,
        }),
      },
    });

    await expect(
      service.runNext({
        workerId: "media-worker:test",
      }),
    ).resolves.toMatchObject({
      mode: "executed",
      claimedMediaId: "media-1",
      result: {
        mediaId: "media-1",
        ownerTable: "posts",
        ownerId: "post-1",
        status: "DONE",
      },
    });
  });

  it("returns failed when queued media execution throws", async () => {
    const service = new AiAgentMediaLaneService({
      deps: {
        claimNextReadyJob: async () => ({
          id: "media-2",
        }),
        executeQueuedJobById: async () => {
          throw new Error("boom");
        },
      },
    });

    await expect(
      service.runNext({
        workerId: "media-worker:test",
      }),
    ).resolves.toEqual({
      mode: "failed",
      claimedMediaId: "media-2",
      summary: "Claimed media job failed during queue-driven execution.",
      errorMessage: "boom",
    });
  });
});
