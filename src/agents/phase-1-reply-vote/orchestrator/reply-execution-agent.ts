import type { QueueTask } from "@/lib/ai/task-queue/task-queue";
import type { TaskQueue } from "@/lib/ai/task-queue/task-queue";
import type { ReplySafetyContext, ReplySafetyGate } from "@/lib/ai/safety/reply-safety-gate";
import { ExecutionSkipReasonCode, ReviewReasonCode } from "@/lib/ai/reason-codes";
import type { SafetyEventSink } from "@/lib/ai/observability/safety-events";
import type { ReviewQueue } from "@/lib/ai/review-queue/review-queue";

export interface ReplyGenerator {
  generate(task: QueueTask): Promise<{
    text?: string;
    parentCommentId?: string;
    skipReason?: string;
    safetyContext?: ReplySafetyContext;
  }>;
}

export interface ReplyWriter {
  write(input: {
    personaId: string;
    text: string;
    payload: Record<string, unknown>;
  }): Promise<{ resultId: string }>;
}

export interface IdempotencyStore {
  get(key: string): Promise<string | null>;
  set(key: string, resultId: string): Promise<void>;
}

export interface ReplyAtomicPersistence {
  writeIdempotentAndComplete(input: {
    task: QueueTask;
    workerId: string;
    now: Date;
    text: string;
    parentCommentId?: string;
    idempotencyKey: string;
  }): Promise<{ resultId: string } | null>;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly map = new Map<string, string>();

  public async get(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  public async set(key: string, resultId: string): Promise<void> {
    this.map.set(key, resultId);
  }
}

type ReplyExecutionAgentOptions = {
  queue: TaskQueue;
  safetyGate: ReplySafetyGate;
  generator: ReplyGenerator;
  writer: ReplyWriter;
  idempotency: IdempotencyStore;
  safetyEventSink?: SafetyEventSink;
  reviewQueue?: ReviewQueue;
  atomicPersistence?: ReplyAtomicPersistence;
};

export class ReplyExecutionAgent {
  private readonly queue: TaskQueue;
  private readonly safetyGate: ReplySafetyGate;
  private readonly generator: ReplyGenerator;
  private readonly writer: ReplyWriter;
  private readonly idempotency: IdempotencyStore;
  private readonly safetyEventSink?: SafetyEventSink;
  private readonly reviewQueue?: ReviewQueue;
  private readonly atomicPersistence?: ReplyAtomicPersistence;

  public constructor(options: ReplyExecutionAgentOptions) {
    this.queue = options.queue;
    this.safetyGate = options.safetyGate;
    this.generator = options.generator;
    this.writer = options.writer;
    this.idempotency = options.idempotency;
    this.safetyEventSink = options.safetyEventSink;
    this.reviewQueue = options.reviewQueue;
    this.atomicPersistence = options.atomicPersistence;
  }

  public async runOnce(input: { workerId: string; now: Date }): Promise<"IDLE" | "DONE"> {
    const claimed = await this.queue.claimNextPending({
      workerId: input.workerId,
      now: input.now,
    });

    if (!claimed) {
      return "IDLE";
    }

    if (claimed.taskType !== "reply") {
      await this.queue.skip({
        taskId: claimed.id,
        workerId: input.workerId,
        reason: ExecutionSkipReasonCode.unsupportedTaskType,
        now: input.now,
      });
      return "DONE";
    }

    const idempotencyKey = this.resolveIdempotencyKey(claimed);
    const existing = await this.idempotency.get(idempotencyKey);
    if (existing) {
      await this.queue.complete({
        taskId: claimed.id,
        workerId: input.workerId,
        resultId: existing,
        resultType: "comment",
        now: input.now,
      });
      return "DONE";
    }

    try {
      const generated = await this.generator.generate(claimed);
      if (generated.skipReason) {
        await this.queue.skip({
          taskId: claimed.id,
          workerId: input.workerId,
          reason: generated.skipReason,
          now: input.now,
        });
        return "DONE";
      }

      const text = generated.text?.trim();
      if (!text) {
        await this.queue.skip({
          taskId: claimed.id,
          workerId: input.workerId,
          reason: ExecutionSkipReasonCode.emptyGeneratedReply,
          now: input.now,
        });
        return "DONE";
      }

      const safety = await this.safetyGate.check({ text, context: generated.safetyContext });

      if (!safety.allowed) {
        if (safety.reviewRequired && this.reviewQueue) {
          const inReview = await this.queue.reviewRequired({
            taskId: claimed.id,
            workerId: input.workerId,
            reason: safety.reasonCode ?? ReviewReasonCode.reviewRequired,
            now: input.now,
          });

          if (inReview) {
            await this.reviewQueue.enqueue({
              taskId: claimed.id,
              personaId: claimed.personaId,
              riskLevel: safety.riskLevel ?? "UNKNOWN",
              enqueueReasonCode: safety.reasonCode ?? ReviewReasonCode.reviewRequired,
              note: safety.reason,
              now: input.now,
              metadata: {
                source: "execution_safety_gate",
              },
            });
            return "DONE";
          }
        }

        if (safety.reasonCode) {
          try {
            await this.safetyEventSink?.record({
              taskId: claimed.id,
              personaId: claimed.personaId,
              postId:
                typeof claimed.payload.postId === "string" ? claimed.payload.postId : undefined,
              source: "execution",
              reasonCode: safety.reasonCode,
              similarity: this.parseSimilarity(safety.reason),
              metadata: { layer: "execution" },
              occurredAt: input.now.toISOString(),
            });
          } catch {
            // Best-effort observability only.
          }
        }

        await this.queue.skip({
          taskId: claimed.id,
          workerId: input.workerId,
          reason: safety.reasonCode ?? safety.reason ?? ExecutionSkipReasonCode.safetyBlocked,
          now: input.now,
        });
        return "DONE";
      }

      let resultId: string;

      if (this.atomicPersistence) {
        const atomicResult = await this.atomicPersistence.writeIdempotentAndComplete({
          task: claimed,
          workerId: input.workerId,
          now: input.now,
          text,
          parentCommentId:
            (generated.parentCommentId as string | undefined) ??
            (claimed.payload.parentCommentId as string | undefined),
          idempotencyKey,
        });

        if (!atomicResult) {
          return "DONE";
        }

        resultId = atomicResult.resultId;
      } else {
        const created = await this.writer.write({
          personaId: claimed.personaId,
          text,
          payload: {
            ...claimed.payload,
            parentCommentId: generated.parentCommentId ?? claimed.payload.parentCommentId,
          },
        });

        await this.idempotency.set(idempotencyKey, created.resultId);

        await this.queue.complete({
          taskId: claimed.id,
          workerId: input.workerId,
          resultId: created.resultId,
          resultType: "comment",
          now: input.now,
        });
        resultId = created.resultId;
      }

      if (!resultId) {
        throw new Error("reply persistence returned empty resultId");
      }
      return "DONE";
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown execution error";
      await this.queue.fail({
        taskId: claimed.id,
        workerId: input.workerId,
        errorMessage: message,
        now: input.now,
      });
      return "DONE";
    }
  }

  private resolveIdempotencyKey(task: QueueTask): string {
    const explicit = task.payload.idempotencyKey;
    if (typeof explicit === "string" && explicit.length > 0) {
      return explicit;
    }
    return `task:${task.id}`;
  }

  private parseSimilarity(reason?: string): number | undefined {
    if (!reason) {
      return undefined;
    }
    const match = reason.match(/similarity\s+([0-9.]+)/i);
    if (!match || !match[1]) {
      return undefined;
    }
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
