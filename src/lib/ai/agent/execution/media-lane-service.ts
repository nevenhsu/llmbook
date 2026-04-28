import {
  AiAgentMediaJobService,
  type AiAgentMediaExecutionPersistedResult,
} from "@/lib/ai/agent/execution/media-job-service";

export type AiAgentMediaLaneRunInput = {
  workerId: string;
};

export type AiAgentMediaLaneIdleResult = {
  mode: "idle";
  summary: string;
};

export type AiAgentMediaLaneExecutedResult = {
  mode: "executed";
  claimedMediaId: string;
  summary: string;
  result: AiAgentMediaExecutionPersistedResult;
};

export type AiAgentMediaLaneFailedResult = {
  mode: "failed";
  claimedMediaId: string;
  summary: string;
  errorMessage: string;
};

export type AiAgentMediaLaneRunResult =
  | AiAgentMediaLaneIdleResult
  | AiAgentMediaLaneExecutedResult
  | AiAgentMediaLaneFailedResult;

type MediaLaneServiceDeps = {
  claimNextReadyJob: () => Promise<{ id: string } | null>;
  executeQueuedJobById: (mediaId: string) => Promise<{
    id: string;
    persona_id: string | null;
    post_id: string | null;
    comment_id: string | null;
    status: "PENDING_GENERATION" | "RUNNING" | "DONE" | "FAILED";
    image_prompt: string | null;
    url: string | null;
    mime_type: string | null;
    width: number | null;
    height: number | null;
    size_bytes: number | null;
    retry_count: number;
    max_retries: number;
    next_retry_at: string | null;
    last_error: string | null;
  }>;
  sleep: (ms: number) => Promise<void>;
};

export class AiAgentMediaLaneService {
  private readonly deps: MediaLaneServiceDeps;

  public constructor(options?: { deps?: Partial<MediaLaneServiceDeps> }) {
    const mediaService = new AiAgentMediaJobService();
    this.deps = {
      claimNextReadyJob:
        options?.deps?.claimNextReadyJob ?? (() => mediaService.claimNextReadyJob()),
      executeQueuedJobById:
        options?.deps?.executeQueuedJobById ??
        ((mediaId) => mediaService.executeQueuedJobById(mediaId)),
      sleep: options?.deps?.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    };
  }

  public async runNext(input: AiAgentMediaLaneRunInput): Promise<AiAgentMediaLaneRunResult> {
    void input;
    const claimedJob = await this.deps.claimNextReadyJob();
    if (!claimedJob) {
      return {
        mode: "idle",
        summary: "No pending media job is ready right now.",
      };
    }

    try {
      const row = await this.deps.executeQueuedJobById(claimedJob.id);
      return {
        mode: "executed",
        claimedMediaId: claimedJob.id,
        summary:
          row.status === "DONE" && row.url
            ? `Generated media ${row.id} for ${row.comment_id ? "comment" : "post"} ${row.comment_id ?? row.post_id ?? "unknown"}.`
            : `Processed media ${row.id}.`,
        result: {
          taskId: `media-job:${row.id}`,
          mediaId: row.id,
          ownerTable: row.comment_id ? "comments" : "posts",
          ownerId: row.comment_id ?? row.post_id ?? "unknown",
          status: row.status,
          imagePrompt: row.image_prompt ?? "",
          imageAlt: null,
          url: row.url,
          mimeType: row.mime_type,
          width: row.width,
          height: row.height,
          sizeBytes: row.size_bytes,
          retryCount: row.retry_count,
          maxRetries: row.max_retries,
          nextRetryAt: row.next_retry_at,
          lastError: row.last_error,
        },
      };
    } catch (error) {
      return {
        mode: "failed",
        claimedMediaId: claimedJob.id,
        summary: "Claimed media job failed during queue-driven execution.",
        errorMessage: error instanceof Error ? error.message : "Unknown media-lane execution error",
      };
    }
  }

  public async runLoop(
    input: AiAgentMediaLaneRunInput & {
      pollMs: number;
      maxIterations?: number;
      signal?: AbortSignal;
    },
  ): Promise<{
    attempts: number;
    executedIterations: number;
    lastResult: AiAgentMediaLaneRunResult | null;
  }> {
    let attempts = 0;
    let executedIterations = 0;
    let lastResult: AiAgentMediaLaneRunResult | null = null;

    while (!input.signal?.aborted) {
      if (typeof input.maxIterations === "number" && attempts >= input.maxIterations) {
        break;
      }

      attempts += 1;
      lastResult = await this.runNext(input);
      if (lastResult.mode === "executed") {
        executedIterations += 1;
      }

      if (input.signal?.aborted) {
        break;
      }

      await this.deps.sleep(input.pollMs);
    }

    return {
      attempts,
      executedIterations,
      lastResult,
    };
  }
}
