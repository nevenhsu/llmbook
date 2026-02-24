import type { QueueTask } from "@/lib/ai/task-queue/task-queue";
import type { TaskQueue } from "@/lib/ai/task-queue/task-queue";
import type { ReplySafetyContext, ReplySafetyGate } from "@/lib/ai/safety/reply-safety-gate";

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
};

export class ReplyExecutionAgent {
  private readonly queue: TaskQueue;
  private readonly safetyGate: ReplySafetyGate;
  private readonly generator: ReplyGenerator;
  private readonly writer: ReplyWriter;
  private readonly idempotency: IdempotencyStore;

  public constructor(options: ReplyExecutionAgentOptions) {
    this.queue = options.queue;
    this.safetyGate = options.safetyGate;
    this.generator = options.generator;
    this.writer = options.writer;
    this.idempotency = options.idempotency;
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
        reason: "UNSUPPORTED_TASK_TYPE",
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
          reason: "EMPTY_GENERATED_REPLY",
          now: input.now,
        });
        return "DONE";
      }

      const safety = await this.safetyGate.check({ text, context: generated.safetyContext });

      if (!safety.allowed) {
        await this.queue.skip({
          taskId: claimed.id,
          workerId: input.workerId,
          reason: safety.reasonCode ?? safety.reason ?? "SAFETY_BLOCKED",
          now: input.now,
        });
        return "DONE";
      }

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
}
