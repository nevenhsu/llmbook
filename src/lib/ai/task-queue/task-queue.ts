import type { TaskEventSink, TaskTransitionReasonCode } from "@/lib/ai/observability/task-events";

export type QueueTaskStatus = "PENDING" | "RUNNING" | "IN_REVIEW" | "DONE" | "FAILED" | "SKIPPED";
export type TaskType = "comment" | "post" | "reply" | "vote" | "image_post" | "poll_post";
export type QueueTaskResultType = "post" | "comment" | "vote";

export type QueueTask = {
  id: string;
  personaId: string;
  taskType: TaskType;
  payload: Record<string, unknown>;
  status: QueueTaskStatus;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  resultId?: string;
  resultType?: QueueTaskResultType;
  errorMessage?: string;
  leaseOwner?: string;
  leaseUntil?: Date;
  createdAt: Date;
};

type ClaimNextPendingInput = {
  workerId: string;
  now: Date;
};

type HeartbeatInput = {
  taskId: string;
  workerId: string;
  now: Date;
};

type CompleteInput = {
  taskId: string;
  workerId: string;
  resultId?: string;
  resultType?: QueueTaskResultType;
  now: Date;
};

type FailInput = {
  taskId: string;
  workerId: string;
  errorMessage: string;
  now: Date;
};

type RecoverTimedOutInput = {
  now: Date;
};

type SkipInput = {
  taskId: string;
  workerId: string;
  reason: string;
  now: Date;
};

type ReviewInput = {
  taskId: string;
  workerId: string;
  reason: string;
  now: Date;
};

type TaskQueueOptions = {
  store: TaskQueueStore;
  eventSink: TaskEventSink;
  leaseMs: number;
};

function cloneTask(task: QueueTask): QueueTask {
  return {
    ...task,
    scheduledAt: new Date(task.scheduledAt),
    startedAt: task.startedAt ? new Date(task.startedAt) : undefined,
    completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
    leaseUntil: task.leaseUntil ? new Date(task.leaseUntil) : undefined,
    createdAt: new Date(task.createdAt),
    payload: { ...task.payload },
  };
}

export interface TaskQueueStore {
  getById(id: string): QueueTask | undefined | Promise<QueueTask | undefined>;
  claimOldestPending(
    now: Date,
    workerId: string,
    leaseMs: number,
  ): QueueTask | null | Promise<QueueTask | null>;
  updateHeartbeat(
    taskId: string,
    workerId: string,
    now: Date,
    leaseMs: number,
  ): QueueTask | null | Promise<QueueTask | null>;
  completeTask(input: CompleteInput): QueueTask | null | Promise<QueueTask | null>;
  failTask(input: FailInput): QueueTask | null | Promise<QueueTask | null>;
  recoverTimedOut(now: Date): QueueTask[] | Promise<QueueTask[]>;
  skipTask(input: SkipInput): QueueTask | null | Promise<QueueTask | null>;
  markInReview(input: ReviewInput): QueueTask | null | Promise<QueueTask | null>;
}

export class InMemoryTaskQueueStore implements TaskQueueStore {
  private readonly tasks: Map<string, QueueTask>;

  public constructor(seed: QueueTask[] = []) {
    this.tasks = new Map(seed.map((task) => [task.id, cloneTask(task)]));
  }

  public snapshot(): QueueTask[] {
    return [...this.tasks.values()].map(cloneTask);
  }

  public getById(id: string): QueueTask | undefined {
    const task = this.tasks.get(id);
    return task ? cloneTask(task) : undefined;
  }

  public upsert(task: QueueTask): QueueTask {
    const next = cloneTask(task);
    this.tasks.set(next.id, next);
    return cloneTask(next);
  }

  public claimOldestPending(now: Date, workerId: string, leaseMs: number): QueueTask | null {
    const candidates = [...this.tasks.values()]
      .filter((task) => task.status === "PENDING" && task.scheduledAt.getTime() <= now.getTime())
      .sort(
        (a, b) =>
          a.scheduledAt.getTime() - b.scheduledAt.getTime() ||
          a.createdAt.getTime() - b.createdAt.getTime(),
      );

    const task = candidates[0];
    if (!task) {
      return null;
    }

    task.status = "RUNNING";
    task.startedAt = new Date(now);
    task.completedAt = undefined;
    task.leaseOwner = workerId;
    task.leaseUntil = new Date(now.getTime() + leaseMs);

    return cloneTask(task);
  }

  public updateHeartbeat(
    taskId: string,
    workerId: string,
    now: Date,
    leaseMs: number,
  ): QueueTask | null {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== "RUNNING" || task.leaseOwner !== workerId) {
      return null;
    }

    task.leaseUntil = new Date(now.getTime() + leaseMs);
    return cloneTask(task);
  }

  public completeTask(input: CompleteInput): QueueTask | null {
    const task = this.tasks.get(input.taskId);
    if (!task || task.status !== "RUNNING" || task.leaseOwner !== input.workerId) {
      return null;
    }

    task.status = "DONE";
    task.completedAt = new Date(input.now);
    task.resultId = input.resultId;
    task.resultType = input.resultType;
    task.leaseOwner = undefined;
    task.leaseUntil = undefined;
    task.errorMessage = undefined;

    return cloneTask(task);
  }

  public failTask(input: FailInput): QueueTask | null {
    const task = this.tasks.get(input.taskId);
    if (!task || task.status !== "RUNNING" || task.leaseOwner !== input.workerId) {
      return null;
    }

    task.retryCount += 1;
    task.errorMessage = input.errorMessage;
    task.leaseOwner = undefined;
    task.leaseUntil = undefined;
    task.startedAt = undefined;

    if (task.retryCount >= task.maxRetries) {
      task.status = "FAILED";
      task.completedAt = new Date(input.now);
      return cloneTask(task);
    }

    task.status = "PENDING";
    task.completedAt = undefined;
    return cloneTask(task);
  }

  public recoverTimedOut(now: Date): QueueTask[] {
    const recovered: QueueTask[] = [];

    for (const task of this.tasks.values()) {
      if (task.status !== "RUNNING") {
        continue;
      }

      if (!task.leaseUntil || task.leaseUntil.getTime() > now.getTime()) {
        continue;
      }

      task.status = "PENDING";
      task.startedAt = undefined;
      task.leaseOwner = undefined;
      task.leaseUntil = undefined;
      recovered.push(cloneTask(task));
    }

    return recovered;
  }

  public skipTask(input: SkipInput): QueueTask | null {
    const task = this.tasks.get(input.taskId);
    if (!task || task.status !== "RUNNING" || task.leaseOwner !== input.workerId) {
      return null;
    }

    task.status = "SKIPPED";
    task.errorMessage = input.reason;
    task.completedAt = new Date(input.now);
    task.leaseOwner = undefined;
    task.leaseUntil = undefined;

    return cloneTask(task);
  }

  public markInReview(input: ReviewInput): QueueTask | null {
    const task = this.tasks.get(input.taskId);
    if (!task || task.status !== "RUNNING" || task.leaseOwner !== input.workerId) {
      return null;
    }

    task.status = "IN_REVIEW";
    task.errorMessage = input.reason;
    task.completedAt = undefined;
    task.leaseOwner = undefined;
    task.leaseUntil = undefined;

    return cloneTask(task);
  }
}

export class TaskQueue {
  private readonly store: TaskQueueStore;
  private readonly eventSink: TaskEventSink;
  private readonly leaseMs: number;

  public constructor(options: TaskQueueOptions) {
    this.store = options.store;
    this.eventSink = options.eventSink;
    this.leaseMs = options.leaseMs;
  }

  public async claimNextPending(input: ClaimNextPendingInput): Promise<QueueTask | null> {
    const claimed = await this.store.claimOldestPending(input.now, input.workerId, this.leaseMs);
    if (!claimed) {
      return null;
    }

    await this.recordTransition({
      task: claimed,
      fromStatus: "PENDING",
      toStatus: "RUNNING",
      reasonCode: "CLAIMED",
      workerId: input.workerId,
      occurredAt: input.now,
    });

    return claimed;
  }

  public async heartbeat(input: HeartbeatInput): Promise<QueueTask | null> {
    const before = await this.store.getById(input.taskId);
    const updated = await this.store.updateHeartbeat(
      input.taskId,
      input.workerId,
      input.now,
      this.leaseMs,
    );
    if (!before || !updated) {
      return null;
    }

    await this.recordTransition({
      task: updated,
      fromStatus: before.status,
      toStatus: updated.status,
      reasonCode: "HEARTBEAT",
      workerId: input.workerId,
      occurredAt: input.now,
    });

    return updated;
  }

  public async complete(input: CompleteInput): Promise<QueueTask | null> {
    const before = await this.store.getById(input.taskId);
    const done = await this.store.completeTask(input);
    if (!before || !done) {
      return null;
    }

    await this.recordTransition({
      task: done,
      fromStatus: before.status,
      toStatus: done.status,
      reasonCode: "COMPLETED",
      workerId: input.workerId,
      occurredAt: input.now,
    });

    return done;
  }

  public async fail(input: FailInput): Promise<QueueTask | null> {
    const before = await this.store.getById(input.taskId);
    const failedOrRequeued = await this.store.failTask(input);
    if (!before || !failedOrRequeued) {
      return null;
    }

    await this.recordTransition({
      task: failedOrRequeued,
      fromStatus: before.status,
      toStatus: failedOrRequeued.status,
      reasonCode: failedOrRequeued.status === "FAILED" ? "FAILED_FINAL" : "FAILED_RETRY",
      workerId: input.workerId,
      occurredAt: input.now,
    });

    return failedOrRequeued;
  }

  public async recoverTimedOut(input: RecoverTimedOutInput): Promise<number> {
    const recovered = await this.store.recoverTimedOut(input.now);

    for (const task of recovered) {
      await this.recordTransition({
        task,
        fromStatus: "RUNNING",
        toStatus: "PENDING",
        reasonCode: "LEASE_TIMEOUT",
        occurredAt: input.now,
      });
    }

    return recovered.length;
  }

  public async skip(input: SkipInput): Promise<QueueTask | null> {
    const before = await this.store.getById(input.taskId);
    const skipped = await this.store.skipTask(input);
    if (!before || !skipped) {
      return null;
    }

    await this.recordTransition({
      task: skipped,
      fromStatus: before.status,
      toStatus: skipped.status,
      reasonCode: "SKIPPED",
      workerId: input.workerId,
      occurredAt: input.now,
    });

    return skipped;
  }

  public async reviewRequired(input: ReviewInput): Promise<QueueTask | null> {
    const before = await this.store.getById(input.taskId);
    const inReview = await this.store.markInReview(input);
    if (!before || !inReview) {
      return null;
    }

    await this.recordTransition({
      task: inReview,
      fromStatus: before.status,
      toStatus: inReview.status,
      reasonCode: "REVIEW_REQUIRED",
      workerId: input.workerId,
      occurredAt: input.now,
    });

    return inReview;
  }

  private async recordTransition(input: {
    task: QueueTask;
    fromStatus: QueueTaskStatus;
    toStatus: QueueTaskStatus;
    reasonCode: TaskTransitionReasonCode;
    occurredAt: Date;
    workerId?: string;
  }): Promise<void> {
    await this.eventSink.record({
      taskId: input.task.id,
      personaId: input.task.personaId,
      taskType: input.task.taskType,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      reasonCode: input.reasonCode,
      workerId: input.workerId,
      retryCount: input.task.retryCount,
      occurredAt: input.occurredAt.toISOString(),
    });
  }
}
