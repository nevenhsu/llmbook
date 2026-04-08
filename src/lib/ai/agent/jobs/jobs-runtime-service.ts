import {
  AiAgentMediaJobService,
  AiAgentPersonaTaskPersistenceService,
  type AiAgentTextExecutionPersistedResult,
} from "@/lib/ai/agent/execution";
import {
  AiAgentJobPermanentSkipError,
  AiAgentPersonaTaskService,
} from "@/lib/ai/agent/jobs/persona-task-service";
import {
  AiAgentMemoryAdminService,
  type AiAgentMemoryPersistedCompressResponse,
} from "@/lib/ai/agent/memory";
import { AiAgentJobRuntimeStateService } from "@/lib/ai/agent/jobs/job-runtime-state-service";
import { SupabaseJobTaskStore, type AiAgentJobTaskStore } from "@/lib/ai/agent/jobs/job-store";
import type { AiAgentJobTask, AiAgentJobType } from "@/lib/ai/agent/jobs/job-types";

export type AiAgentJobsRuntimeRunInput = {
  workerId: string;
  heartbeatMs: number;
};

export type AiAgentJobsRuntimeIdleResult = {
  mode: "idle";
  recoveredTimedOut: number;
  summary: string;
};

export type AiAgentJobsRuntimeExecutedResult = {
  mode: "executed";
  recoveredTimedOut: number;
  claimedTaskId: string;
  jobType: AiAgentJobType;
  summary: string;
  memoryResult: AiAgentMemoryPersistedCompressResponse | null;
  textResult: AiAgentTextExecutionPersistedResult | null;
};

export type AiAgentJobsRuntimeSkippedResult = {
  mode: "skipped";
  recoveredTimedOut: number;
  claimedTaskId: string;
  jobType: AiAgentJobType;
  summary: string;
};

export type AiAgentJobsRuntimeFailedResult = {
  mode: "failed";
  recoveredTimedOut: number;
  claimedTaskId: string;
  jobType: AiAgentJobType;
  summary: string;
  errorMessage: string;
};

export type AiAgentJobsRuntimeRunResult =
  | AiAgentJobsRuntimeIdleResult
  | AiAgentJobsRuntimeExecutedResult
  | AiAgentJobsRuntimeSkippedResult
  | AiAgentJobsRuntimeFailedResult;

type JobsRuntimeServiceDeps = {
  runtimeState: AiAgentJobRuntimeStateService;
  taskStore: AiAgentJobTaskStore;
  executeMemoryCompress: (personaId: string) => Promise<AiAgentMemoryPersistedCompressResponse>;
  executeImageGeneration: (mediaId: string) => Promise<void>;
  executeTextPersistence: (input: {
    jobTaskId: string;
    personaTaskId: string;
    sourceRuntime: string;
    createdBy?: string | null;
  }) => Promise<AiAgentTextExecutionPersistedResult>;
  beginLeaseHeartbeat: (input: {
    claimedTask: AiAgentJobTask;
    workerId: string;
    heartbeatMs: number;
  }) => () => void;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
};

function createDefaultLeaseHeartbeat(
  taskStore: AiAgentJobTaskStore,
  runtimeState: AiAgentJobRuntimeStateService,
  now: () => Date,
  leaseMs: number,
): JobsRuntimeServiceDeps["beginLeaseHeartbeat"] {
  return ({ claimedTask, workerId, heartbeatMs }) => {
    const interval = setInterval(() => {
      const tickNow = now();
      void runtimeState.heartbeatLease({
        leaseOwner: workerId,
        leaseMs,
      });
      void taskStore.updateHeartbeat({
        taskId: claimedTask.id,
        runtimeKey: runtimeState.runtimeKey,
        workerId,
        now: tickNow,
        leaseMs,
      });
    }, heartbeatMs);

    return () => clearInterval(interval);
  };
}

export class AiAgentJobsRuntimeService {
  private readonly deps: JobsRuntimeServiceDeps;
  private readonly leaseMs: number;

  public constructor(options?: { deps?: Partial<JobsRuntimeServiceDeps>; leaseMs?: number }) {
    const leaseMs = options?.leaseMs ?? 60_000;
    const runtimeState = options?.deps?.runtimeState ?? new AiAgentJobRuntimeStateService();
    const taskStore = options?.deps?.taskStore ?? new SupabaseJobTaskStore();
    const now = options?.deps?.now ?? (() => new Date());
    const personaTaskService = new AiAgentPersonaTaskService();
    const personaTaskPersistenceService = new AiAgentPersonaTaskPersistenceService();

    this.leaseMs = leaseMs;
    this.deps = {
      runtimeState,
      taskStore,
      executeMemoryCompress:
        options?.deps?.executeMemoryCompress ??
        (async (personaId) => {
          const result = await new AiAgentMemoryAdminService().compressPersona(personaId, {
            persistedBy: "jobs_runtime",
          });
          if (result.mode !== "persisted") {
            throw new Error("memory compression did not persist a long-memory update");
          }
          return result;
        }),
      executeImageGeneration:
        options?.deps?.executeImageGeneration ??
        (async (mediaId) => {
          await new AiAgentMediaJobService().rerunJobById(mediaId);
        }),
      executeTextPersistence:
        options?.deps?.executeTextPersistence ??
        (async (input) => {
          const generated = await personaTaskService.generateFromTask({
            personaTaskId: input.personaTaskId,
            mode: "runtime",
          });
          return personaTaskPersistenceService.persistGeneratedResult({
            generated,
            jobTaskId: input.jobTaskId,
            sourceRuntime: input.sourceRuntime,
            createdBy: input.createdBy ?? null,
          });
        }),
      beginLeaseHeartbeat:
        options?.deps?.beginLeaseHeartbeat ??
        createDefaultLeaseHeartbeat(taskStore, runtimeState, now, leaseMs),
      sleep: options?.deps?.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
      now,
    };
  }

  public async runNext(input: AiAgentJobsRuntimeRunInput): Promise<AiAgentJobsRuntimeRunResult> {
    await this.deps.runtimeState.touchRuntimeAppHeartbeat();

    const now = this.deps.now();
    const recoveredTimedOut = (
      await this.deps.taskStore.recoverTimedOut({
        runtimeKey: this.deps.runtimeState.runtimeKey,
        now,
      })
    ).length;

    const leaseResult = await this.deps.runtimeState.claimLease({
      leaseOwner: input.workerId,
      leaseMs: this.leaseMs,
    });

    if (leaseResult.mode === "blocked") {
      return {
        mode: "idle",
        recoveredTimedOut,
        summary: leaseResult.summary,
      };
    }

    const claimedTask = await this.deps.taskStore.claimOldestPending({
      runtimeKey: this.deps.runtimeState.runtimeKey,
      workerId: input.workerId,
      now,
      leaseMs: this.leaseMs,
    });

    if (!claimedTask) {
      return {
        mode: "idle",
        recoveredTimedOut,
        summary:
          recoveredTimedOut > 0
            ? `Recovered ${recoveredTimedOut} timed-out jobs; no pending jobs-runtime row is ready right now.`
            : "No pending jobs-runtime row is ready right now.",
      };
    }

    const stopHeartbeat = this.deps.beginLeaseHeartbeat({
      claimedTask,
      workerId: input.workerId,
      heartbeatMs: input.heartbeatMs,
    });

    try {
      if (claimedTask.jobType === "memory_compress") {
        const memoryResult = await this.deps.executeMemoryCompress(claimedTask.subjectId);
        await this.deps.taskStore.completeTask({
          taskId: claimedTask.id,
          runtimeKey: claimedTask.runtimeKey,
          workerId: input.workerId,
          now: this.deps.now(),
        });

        return {
          mode: "executed",
          recoveredTimedOut,
          claimedTaskId: claimedTask.id,
          jobType: claimedTask.jobType,
          summary: `Compressed persona ${claimedTask.subjectId} through jobs-runtime.`,
          memoryResult,
          textResult: null,
        };
      }

      if (claimedTask.jobType === "image_generation") {
        await this.deps.executeImageGeneration(claimedTask.subjectId);
        await this.deps.taskStore.completeTask({
          taskId: claimedTask.id,
          runtimeKey: claimedTask.runtimeKey,
          workerId: input.workerId,
          now: this.deps.now(),
        });

        return {
          mode: "executed",
          recoveredTimedOut,
          claimedTaskId: claimedTask.id,
          jobType: claimedTask.jobType,
          summary: `Regenerated media ${claimedTask.subjectId} through jobs-runtime.`,
          memoryResult: null,
          textResult: null,
        };
      }

      if (claimedTask.jobType === "public_task" || claimedTask.jobType === "notification_task") {
        const textResult = await this.deps.executeTextPersistence({
          jobTaskId: claimedTask.id,
          personaTaskId: claimedTask.subjectId,
          sourceRuntime: "jobs_runtime",
          createdBy: claimedTask.requestedBy,
        });
        await this.deps.taskStore.completeTask({
          taskId: claimedTask.id,
          runtimeKey: claimedTask.runtimeKey,
          workerId: input.workerId,
          now: this.deps.now(),
        });

        return {
          mode: "executed",
          recoveredTimedOut,
          claimedTaskId: claimedTask.id,
          jobType: claimedTask.jobType,
          summary:
            textResult.writeMode === "overwritten"
              ? `Overwrote ${textResult.resultType} ${textResult.persistedId} from persona_task ${textResult.taskId}.`
              : `Persisted new ${textResult.resultType} ${textResult.persistedId} from persona_task ${textResult.taskId}.`,
          memoryResult: null,
          textResult,
        };
      }

      const skipReason = `jobs-runtime ${claimedTask.jobType} cannot be routed by the current worker implementation.`;
      await this.deps.taskStore.skipTask({
        taskId: claimedTask.id,
        runtimeKey: claimedTask.runtimeKey,
        workerId: input.workerId,
        reason: skipReason,
        now: this.deps.now(),
      });

      return {
        mode: "skipped",
        recoveredTimedOut,
        claimedTaskId: claimedTask.id,
        jobType: claimedTask.jobType,
        summary: skipReason,
      };
    } catch (error) {
      if (error instanceof AiAgentJobPermanentSkipError) {
        await this.deps.taskStore.skipTask({
          taskId: claimedTask.id,
          runtimeKey: claimedTask.runtimeKey,
          workerId: input.workerId,
          reason: error.message,
          now: this.deps.now(),
        });

        return {
          mode: "skipped",
          recoveredTimedOut,
          claimedTaskId: claimedTask.id,
          jobType: claimedTask.jobType,
          summary: error.message,
        };
      }

      const errorMessage =
        error instanceof Error ? error.message : "Unknown jobs-runtime execution error";
      await this.deps.taskStore.failTask({
        taskId: claimedTask.id,
        runtimeKey: claimedTask.runtimeKey,
        workerId: input.workerId,
        errorMessage,
        now: this.deps.now(),
      });

      return {
        mode: "failed",
        recoveredTimedOut,
        claimedTaskId: claimedTask.id,
        jobType: claimedTask.jobType,
        summary: "Claimed jobs-runtime task failed during execution.",
        errorMessage,
      };
    } finally {
      stopHeartbeat();
    }
  }

  public async runLoop(
    input: AiAgentJobsRuntimeRunInput & {
      pollMs: number;
      maxIterations?: number;
      signal?: AbortSignal;
    },
  ): Promise<{
    attempts: number;
    executedIterations: number;
    lastResult: AiAgentJobsRuntimeRunResult | null;
  }> {
    let attempts = 0;
    let executedIterations = 0;
    let lastResult: AiAgentJobsRuntimeRunResult | null = null;

    try {
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
    } finally {
      await this.deps.runtimeState.releaseLease({
        leaseOwner: input.workerId,
      });
    }

    return {
      attempts,
      executedIterations,
      lastResult,
    };
  }
}
