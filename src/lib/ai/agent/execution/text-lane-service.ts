import {
  AiAgentTextRuntimeService,
  type AiAgentTextExecutionPersistedResult,
} from "@/lib/ai/agent/execution/text-runtime-service";
import {
  AiAgentMediaJobService,
  type AiAgentMediaExecutionPersistedResult,
} from "@/lib/ai/agent/execution/media-job-service";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import { NoopTaskEventSink, type TaskEventSink } from "@/lib/ai/observability/task-events";
import { SupabaseTaskQueueStore } from "@/lib/ai/task-queue/supabase-task-queue-store";
import { TaskQueue, type QueueTask } from "@/lib/ai/task-queue/task-queue";

export type AiAgentTextLaneRunInput = {
  workerId: string;
  heartbeatMs: number;
};

export type AiAgentTextLaneIdleResult = {
  mode: "idle";
  recoveredTimedOut: number;
  summary: string;
};

export type AiAgentTextLaneExecutedResult = {
  mode: "executed";
  recoveredTimedOut: number;
  claimedTaskId: string;
  summary: string;
  textResult: AiAgentTextExecutionPersistedResult;
};

export type AiAgentTextLaneFailedResult = {
  mode: "failed";
  recoveredTimedOut: number;
  claimedTaskId: string;
  summary: string;
  errorMessage: string;
};

export type AiAgentTextLaneRunResult =
  | AiAgentTextLaneIdleResult
  | AiAgentTextLaneExecutedResult
  | AiAgentTextLaneFailedResult;

type TextLaneServiceDeps = {
  queue: TaskQueue;
  eventSink: TaskEventSink;
  executeTextTask: (taskId: string) => Promise<AiAgentTextExecutionPersistedResult>;
  queueMediaForTask: (
    task: AiAgentRecentTaskSnapshot,
  ) => Promise<AiAgentMediaExecutionPersistedResult | null>;
  beginTaskHeartbeat: (input: {
    claimedTask: QueueTask;
    workerId: string;
    heartbeatMs: number;
  }) => () => void;
  now: () => Date;
};

function createDefaultTaskHeartbeat(
  queue: TaskQueue,
  now: () => Date,
): TextLaneServiceDeps["beginTaskHeartbeat"] {
  return ({ claimedTask, workerId, heartbeatMs }) => {
    const interval = setInterval(() => {
      void queue.heartbeat({
        taskId: claimedTask.id,
        workerId,
        now: now(),
      });
    }, heartbeatMs);

    return () => clearInterval(interval);
  };
}

export class AiAgentTextLaneService {
  private readonly deps: TextLaneServiceDeps;

  public constructor(options?: { deps?: Partial<TextLaneServiceDeps>; leaseMs?: number }) {
    const eventSink = options?.deps?.eventSink ?? new NoopTaskEventSink();
    const queue =
      options?.deps?.queue ??
      new TaskQueue({
        store: new SupabaseTaskQueueStore(),
        eventSink,
        leaseMs: options?.leaseMs ?? 60_000,
      });
    const now = options?.deps?.now ?? (() => new Date());
    const textRuntimeService = new AiAgentTextRuntimeService();
    const mediaJobs = new AiAgentMediaJobService();

    this.deps = {
      queue,
      eventSink,
      executeTextTask:
        options?.deps?.executeTextTask ?? ((taskId) => textRuntimeService.executeTask(taskId)),
      queueMediaForTask:
        options?.deps?.queueMediaForTask ?? ((task) => mediaJobs.ensurePendingJobForTask(task)),
      beginTaskHeartbeat:
        options?.deps?.beginTaskHeartbeat ?? createDefaultTaskHeartbeat(queue, now),
      now,
    };
  }

  public async runNext(input: AiAgentTextLaneRunInput): Promise<AiAgentTextLaneRunResult> {
    const startedAt = this.deps.now();
    const recoveredTimedOut = await this.deps.queue.recoverTimedOut({ now: startedAt });
    const claimedTask = await this.deps.queue.claimNextPending({
      workerId: input.workerId,
      now: startedAt,
    });

    if (!claimedTask) {
      return {
        mode: "idle",
        recoveredTimedOut,
        summary:
          recoveredTimedOut > 0
            ? `Recovered ${recoveredTimedOut} timed-out text tasks; no pending text task is ready right now.`
            : "No pending text task is ready right now.",
      };
    }

    const stopHeartbeat = this.deps.beginTaskHeartbeat({
      claimedTask,
      workerId: input.workerId,
      heartbeatMs: input.heartbeatMs,
    });

    try {
      const textResult = await this.deps.executeTextTask(claimedTask.id);
      const queuedMedia = await this.deps.queueMediaForTask(textResult.updatedTask);

      await this.deps.eventSink.record({
        taskId: claimedTask.id,
        personaId: claimedTask.personaId,
        taskType: claimedTask.taskType,
        fromStatus: "RUNNING",
        toStatus: "DONE",
        reasonCode: "COMPLETED",
        workerId: input.workerId,
        retryCount: textResult.updatedTask.retryCount,
        occurredAt: this.deps.now().toISOString(),
      });

      const summary =
        textResult.writeMode === "overwritten"
          ? `Overwrote ${textResult.resultType} ${textResult.persistedId} and completed queue task ${claimedTask.id}.`
          : `Persisted ${textResult.resultType} ${textResult.persistedId} and completed queue task ${claimedTask.id}.`;

      return {
        mode: "executed",
        recoveredTimedOut,
        claimedTaskId: claimedTask.id,
        summary: queuedMedia
          ? `${summary} Queued media job ${queuedMedia.mediaId} for background generation.`
          : summary,
        textResult,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown text-lane execution error";
      await this.deps.queue.fail({
        taskId: claimedTask.id,
        workerId: input.workerId,
        errorMessage,
        now: this.deps.now(),
      });
      return {
        mode: "failed",
        recoveredTimedOut,
        claimedTaskId: claimedTask.id,
        summary: "Claimed text task failed during queue-driven execution.",
        errorMessage,
      };
    } finally {
      stopHeartbeat();
    }
  }

  public async runLoop(
    input: AiAgentTextLaneRunInput & {
      pollMs: number;
      maxIterations?: number;
      signal?: AbortSignal;
    },
  ): Promise<{
    attempts: number;
    executedIterations: number;
    lastResult: AiAgentTextLaneRunResult | null;
  }> {
    let attempts = 0;
    let executedIterations = 0;
    let lastResult: AiAgentTextLaneRunResult | null = null;

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

      await new Promise((resolve) => setTimeout(resolve, input.pollMs));
    }

    return {
      attempts,
      executedIterations,
      lastResult,
    };
  }
}
