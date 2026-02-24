import type { TaskEventSink, TaskTransitionReasonCode } from "@/lib/ai/observability/task-events";
import { ReviewReasonCode } from "@/lib/ai/reason-codes";

export type ReviewRiskLevel = "HIGH" | "GRAY" | "UNKNOWN";
export type ReviewQueueStatus = "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "EXPIRED";
export type ReviewDecision = "APPROVE" | "REJECT";

export type ReviewQueueTaskStatus =
  | "PENDING"
  | "RUNNING"
  | "DONE"
  | "FAILED"
  | "SKIPPED"
  | "IN_REVIEW";

export type ReviewQueueTask = {
  id: string;
  personaId: string;
  taskType: "comment" | "post" | "reply" | "vote" | "image_post" | "poll_post";
  payload: Record<string, unknown>;
  status: ReviewQueueTaskStatus;
  scheduledAt: Date;
  createdAt: Date;
  retryCount: number;
  maxRetries: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
};

export type ReviewQueueItem = {
  id: string;
  taskId: string;
  personaId: string;
  riskLevel: ReviewRiskLevel;
  status: ReviewQueueStatus;
  enqueueReasonCode: string;
  decision?: ReviewDecision;
  decisionReasonCode?: string;
  reviewerId?: string;
  note?: string;
  expiresAt: Date;
  claimedAt?: Date;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
};

export type ReviewQueueEvent = {
  reviewId: string;
  taskId: string;
  eventType: "ENQUEUED" | "CLAIMED" | "APPROVED" | "REJECTED" | "EXPIRED";
  reasonCode?: string;
  reviewerId?: string;
  note?: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
};

type ReviewQueueOptions = {
  store: ReviewQueueStore;
  taskEventSink?: TaskEventSink;
};

export interface ReviewQueueAtomicStore {
  claimAtomic(input: {
    reviewId: string;
    reviewerId: string;
    now: Date;
  }): Promise<ReviewQueueItem | null> | ReviewQueueItem | null;
  approveAtomic(input: {
    reviewId: string;
    reviewerId: string;
    reasonCode: string;
    note?: string;
    now: Date;
  }): Promise<ReviewQueueItem | null> | ReviewQueueItem | null;
  rejectAtomic(input: {
    reviewId: string;
    reviewerId: string;
    reasonCode: string;
    note?: string;
    now: Date;
  }): Promise<ReviewQueueItem | null> | ReviewQueueItem | null;
  expireDueAtomic(input: { now: Date }): Promise<number> | number;
}

export interface ReviewQueueStore {
  getReviewById(
    reviewId: string,
  ): Promise<ReviewQueueItem | undefined> | ReviewQueueItem | undefined;
  getReviewByTaskId(
    taskId: string,
  ): Promise<ReviewQueueItem | undefined> | ReviewQueueItem | undefined;
  listReviews(input: {
    statuses?: ReviewQueueStatus[];
    limit?: number;
  }): Promise<ReviewQueueItem[]> | ReviewQueueItem[];
  createReview(input: {
    taskId: string;
    personaId: string;
    riskLevel: ReviewRiskLevel;
    enqueueReasonCode: string;
    note?: string;
    now: Date;
    metadata?: Record<string, unknown>;
  }): Promise<ReviewQueueItem> | ReviewQueueItem;
  claimReview(input: {
    reviewId: string;
    reviewerId: string;
    now: Date;
  }): Promise<ReviewQueueItem | null> | ReviewQueueItem | null;
  decideReview(input: {
    reviewId: string;
    reviewerId: string;
    status: "APPROVED" | "REJECTED";
    decision: ReviewDecision;
    reasonCode: string;
    note?: string;
    now: Date;
  }): Promise<ReviewQueueItem | null> | ReviewQueueItem | null;
  expireDue(input: {
    now: Date;
    reasonCode: string;
  }): Promise<ReviewQueueItem[]> | ReviewQueueItem[];
  getTaskById(taskId: string): Promise<ReviewQueueTask | undefined> | ReviewQueueTask | undefined;
  updateTaskForReviewDecision(input: {
    taskId: string;
    status: "PENDING" | "SKIPPED";
    reasonCode?: string;
    now: Date;
  }): Promise<ReviewQueueTask | null> | ReviewQueueTask | null;
  recordEvent(event: ReviewQueueEvent): Promise<void> | void;
}

function cloneTask(task: ReviewQueueTask): ReviewQueueTask {
  return {
    ...task,
    payload: { ...task.payload },
    scheduledAt: new Date(task.scheduledAt),
    createdAt: new Date(task.createdAt),
    startedAt: task.startedAt ? new Date(task.startedAt) : undefined,
    completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
  };
}

function cloneItem(item: ReviewQueueItem): ReviewQueueItem {
  return {
    ...item,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
    expiresAt: new Date(item.expiresAt),
    claimedAt: item.claimedAt ? new Date(item.claimedAt) : undefined,
    decidedAt: item.decidedAt ? new Date(item.decidedAt) : undefined,
    metadata: item.metadata ? { ...item.metadata } : undefined,
  };
}

export class InMemoryReviewQueueStore implements ReviewQueueStore {
  private readonly tasks = new Map<string, ReviewQueueTask>();
  private readonly reviews = new Map<string, ReviewQueueItem>();
  private readonly events: ReviewQueueEvent[] = [];

  public constructor(seed?: { tasks?: ReviewQueueTask[]; reviews?: ReviewQueueItem[] }) {
    for (const task of seed?.tasks ?? []) {
      this.tasks.set(task.id, cloneTask(task));
    }
    for (const review of seed?.reviews ?? []) {
      this.reviews.set(review.id, cloneItem(review));
    }
  }

  public getTask(taskId: string): ReviewQueueTask | undefined {
    const task = this.tasks.get(taskId);
    return task ? cloneTask(task) : undefined;
  }

  public listEventsForReview(reviewId: string): ReviewQueueEvent[] {
    return this.events
      .filter((event) => event.reviewId === reviewId)
      .map((event) => ({ ...event, createdAt: new Date(event.createdAt) }));
  }

  public getReviewById(reviewId: string): ReviewQueueItem | undefined {
    const review = this.reviews.get(reviewId);
    return review ? cloneItem(review) : undefined;
  }

  public getReviewByTaskId(taskId: string): ReviewQueueItem | undefined {
    for (const review of this.reviews.values()) {
      if (review.taskId === taskId) {
        return cloneItem(review);
      }
    }
    return undefined;
  }

  public listReviews(input: { statuses?: ReviewQueueStatus[]; limit?: number }): ReviewQueueItem[] {
    const statuses = input.statuses;
    const filtered = [...this.reviews.values()]
      .filter((review) => !statuses?.length || statuses.includes(review.status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return filtered.slice(0, input.limit ?? filtered.length).map(cloneItem);
  }

  public createReview(input: {
    taskId: string;
    personaId: string;
    riskLevel: ReviewRiskLevel;
    enqueueReasonCode: string;
    note?: string;
    now: Date;
    metadata?: Record<string, unknown>;
  }): ReviewQueueItem {
    const existing = this.getReviewByTaskId(input.taskId);
    if (existing) {
      return existing;
    }

    const review: ReviewQueueItem = {
      id: `review-${this.reviews.size + 1}`,
      taskId: input.taskId,
      personaId: input.personaId,
      riskLevel: input.riskLevel,
      status: "PENDING",
      enqueueReasonCode: input.enqueueReasonCode,
      note: input.note,
      createdAt: new Date(input.now),
      updatedAt: new Date(input.now),
      expiresAt: new Date(input.now.getTime() + 3 * 24 * 60 * 60 * 1000),
      metadata: input.metadata ? { ...input.metadata } : undefined,
    };

    this.reviews.set(review.id, review);
    return cloneItem(review);
  }

  public claimReview(input: {
    reviewId: string;
    reviewerId: string;
    now: Date;
  }): ReviewQueueItem | null {
    const review = this.reviews.get(input.reviewId);
    if (!review) {
      return null;
    }

    if (review.status === "IN_REVIEW" && review.reviewerId === input.reviewerId) {
      return cloneItem(review);
    }

    if (review.status !== "PENDING") {
      return null;
    }

    review.status = "IN_REVIEW";
    review.reviewerId = input.reviewerId;
    review.claimedAt = new Date(input.now);
    review.updatedAt = new Date(input.now);

    return cloneItem(review);
  }

  public decideReview(input: {
    reviewId: string;
    reviewerId: string;
    status: "APPROVED" | "REJECTED";
    decision: ReviewDecision;
    reasonCode: string;
    note?: string;
    now: Date;
  }): ReviewQueueItem | null {
    const review = this.reviews.get(input.reviewId);
    if (!review) {
      return null;
    }

    if (review.status !== "IN_REVIEW" && review.status !== "PENDING") {
      return null;
    }

    review.status = input.status;
    review.decision = input.decision;
    review.decisionReasonCode = input.reasonCode;
    review.reviewerId = input.reviewerId;
    review.note = input.note;
    review.decidedAt = new Date(input.now);
    review.updatedAt = new Date(input.now);

    return cloneItem(review);
  }

  public expireDue(input: { now: Date; reasonCode: string }): ReviewQueueItem[] {
    const expired: ReviewQueueItem[] = [];

    for (const review of this.reviews.values()) {
      if (review.status !== "PENDING" && review.status !== "IN_REVIEW") {
        continue;
      }
      if (review.expiresAt.getTime() > input.now.getTime()) {
        continue;
      }

      review.status = "EXPIRED";
      review.decision = undefined;
      review.decisionReasonCode = input.reasonCode;
      review.decidedAt = new Date(input.now);
      review.updatedAt = new Date(input.now);
      expired.push(cloneItem(review));
    }

    return expired;
  }

  public getTaskById(taskId: string): ReviewQueueTask | undefined {
    return this.getTask(taskId);
  }

  public updateTaskForReviewDecision(input: {
    taskId: string;
    status: "PENDING" | "SKIPPED";
    reasonCode?: string;
    now: Date;
  }): ReviewQueueTask | null {
    const task = this.tasks.get(input.taskId);
    if (!task) {
      return null;
    }

    task.status = input.status;
    if (input.status === "PENDING") {
      task.errorMessage = undefined;
      task.startedAt = undefined;
      task.completedAt = undefined;
      task.scheduledAt = new Date(input.now);
    } else {
      task.errorMessage = input.reasonCode;
      task.completedAt = new Date(input.now);
    }

    return cloneTask(task);
  }

  public recordEvent(event: ReviewQueueEvent): void {
    this.events.push({
      ...event,
      metadata: event.metadata ? { ...event.metadata } : undefined,
      createdAt: new Date(event.createdAt),
    });
  }
}

export class ReviewQueue {
  private readonly store: ReviewQueueStore;
  private readonly taskEventSink?: TaskEventSink;

  public constructor(options: ReviewQueueOptions) {
    this.store = options.store;
    this.taskEventSink = options.taskEventSink;
  }

  private getAtomicStore(): (ReviewQueueStore & ReviewQueueAtomicStore) | null {
    const store = this.store as ReviewQueueStore & Partial<ReviewQueueAtomicStore>;
    const supportsAtomic =
      typeof store.claimAtomic === "function" &&
      typeof store.approveAtomic === "function" &&
      typeof store.rejectAtomic === "function" &&
      typeof store.expireDueAtomic === "function";
    return supportsAtomic ? (store as ReviewQueueStore & ReviewQueueAtomicStore) : null;
  }

  public async list(input: {
    statuses?: ReviewQueueStatus[];
    limit?: number;
  }): Promise<ReviewQueueItem[]> {
    return this.store.listReviews(input);
  }

  public async enqueue(input: {
    taskId: string;
    personaId: string;
    riskLevel: ReviewRiskLevel;
    enqueueReasonCode: string;
    note?: string;
    now: Date;
    metadata?: Record<string, unknown>;
  }): Promise<ReviewQueueItem> {
    const created = await this.store.createReview(input);
    await this.store.recordEvent({
      reviewId: created.id,
      taskId: created.taskId,
      eventType: "ENQUEUED",
      reasonCode: created.enqueueReasonCode,
      createdAt: input.now,
      note: input.note,
      metadata: input.metadata,
    });
    return created;
  }

  public async claim(input: {
    reviewId: string;
    reviewerId: string;
    now: Date;
  }): Promise<ReviewQueueItem | null> {
    const atomicStore = this.getAtomicStore();
    if (atomicStore) {
      return atomicStore.claimAtomic(input);
    }

    const claimed = await this.store.claimReview(input);
    if (!claimed) {
      return null;
    }

    await this.store.recordEvent({
      reviewId: claimed.id,
      taskId: claimed.taskId,
      eventType: "CLAIMED",
      reviewerId: input.reviewerId,
      createdAt: input.now,
    });

    return claimed;
  }

  public async approve(input: {
    reviewId: string;
    reviewerId: string;
    reasonCode: string;
    note?: string;
    now: Date;
  }): Promise<ReviewQueueItem | null> {
    const atomicStore = this.getAtomicStore();
    if (atomicStore) {
      return atomicStore.approveAtomic(input);
    }

    const before = await this.store.getReviewById(input.reviewId);
    if (!before) {
      return null;
    }

    const approved = await this.store.decideReview({
      reviewId: input.reviewId,
      reviewerId: input.reviewerId,
      status: "APPROVED",
      decision: "APPROVE",
      reasonCode: input.reasonCode,
      note: input.note,
      now: input.now,
    });

    if (!approved) {
      return null;
    }

    await this.store.updateTaskForReviewDecision({
      taskId: approved.taskId,
      status: "PENDING",
      now: input.now,
    });

    await this.store.recordEvent({
      reviewId: approved.id,
      taskId: approved.taskId,
      eventType: "APPROVED",
      reasonCode: input.reasonCode,
      reviewerId: input.reviewerId,
      note: input.note,
      createdAt: input.now,
    });

    await this.recordTaskTransition({
      taskId: approved.taskId,
      personaId: approved.personaId,
      fromStatus: before.status === "PENDING" ? "PENDING" : "IN_REVIEW",
      toStatus: "PENDING",
      reasonCode: "REVIEW_APPROVED",
      retryCount: 0,
      workerId: `reviewer:${input.reviewerId}`,
      now: input.now,
    });

    return approved;
  }

  public async reject(input: {
    reviewId: string;
    reviewerId: string;
    reasonCode: string;
    note?: string;
    now: Date;
  }): Promise<ReviewQueueItem | null> {
    const atomicStore = this.getAtomicStore();
    if (atomicStore) {
      return atomicStore.rejectAtomic(input);
    }

    const before = await this.store.getReviewById(input.reviewId);
    if (!before) {
      return null;
    }

    const rejected = await this.store.decideReview({
      reviewId: input.reviewId,
      reviewerId: input.reviewerId,
      status: "REJECTED",
      decision: "REJECT",
      reasonCode: input.reasonCode,
      note: input.note,
      now: input.now,
    });

    if (!rejected) {
      return null;
    }

    await this.store.updateTaskForReviewDecision({
      taskId: rejected.taskId,
      status: "SKIPPED",
      reasonCode: input.reasonCode,
      now: input.now,
    });

    await this.store.recordEvent({
      reviewId: rejected.id,
      taskId: rejected.taskId,
      eventType: "REJECTED",
      reasonCode: input.reasonCode,
      reviewerId: input.reviewerId,
      note: input.note,
      createdAt: input.now,
    });

    await this.recordTaskTransition({
      taskId: rejected.taskId,
      personaId: rejected.personaId,
      fromStatus: before.status === "PENDING" ? "PENDING" : "IN_REVIEW",
      toStatus: "SKIPPED",
      reasonCode: "REVIEW_REJECTED",
      retryCount: 0,
      workerId: `reviewer:${input.reviewerId}`,
      now: input.now,
    });

    return rejected;
  }

  public async expireDue(input: { now: Date }): Promise<ReviewQueueItem[]> {
    const atomicStore = this.getAtomicStore();
    if (atomicStore) {
      const count = await atomicStore.expireDueAtomic(input);
      if (count === 0) {
        return [];
      }
      return this.store.listReviews({
        statuses: ["EXPIRED"],
        limit: count,
      });
    }

    const expired = await this.store.expireDue({
      now: input.now,
      reasonCode: ReviewReasonCode.timeoutExpired,
    });

    for (const item of expired) {
      await this.store.updateTaskForReviewDecision({
        taskId: item.taskId,
        status: "SKIPPED",
        reasonCode: ReviewReasonCode.timeoutExpired,
        now: input.now,
      });

      await this.store.recordEvent({
        reviewId: item.id,
        taskId: item.taskId,
        eventType: "EXPIRED",
        reasonCode: ReviewReasonCode.timeoutExpired,
        createdAt: input.now,
      });

      await this.recordTaskTransition({
        taskId: item.taskId,
        personaId: item.personaId,
        fromStatus: "IN_REVIEW",
        toStatus: "SKIPPED",
        reasonCode: "REVIEW_EXPIRED",
        retryCount: 0,
        now: input.now,
      });
    }

    return expired;
  }

  private async recordTaskTransition(input: {
    taskId: string;
    personaId: string;
    fromStatus: "PENDING" | "IN_REVIEW";
    toStatus: "PENDING" | "SKIPPED";
    reasonCode: TaskTransitionReasonCode;
    workerId?: string;
    retryCount: number;
    now: Date;
  }): Promise<void> {
    await this.taskEventSink?.record({
      taskId: input.taskId,
      personaId: input.personaId,
      taskType: "reply",
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      reasonCode: input.reasonCode,
      workerId: input.workerId,
      retryCount: input.retryCount,
      occurredAt: input.now.toISOString(),
    });
  }
}
