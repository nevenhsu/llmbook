import type { QueueTaskStatus, TaskType } from "@/lib/ai/task-queue/task-queue";

export type TaskTransitionReasonCode =
  | "CLAIMED"
  | "HEARTBEAT"
  | "COMPLETED"
  | "FAILED_RETRY"
  | "FAILED_FINAL"
  | "LEASE_TIMEOUT"
  | "SKIPPED"
  | "REVIEW_REQUIRED"
  | "REVIEW_APPROVED"
  | "REVIEW_REJECTED"
  | "REVIEW_EXPIRED";

export type TaskTransitionEvent = {
  taskId: string;
  personaId: string;
  taskType: TaskType;
  fromStatus: QueueTaskStatus;
  toStatus: QueueTaskStatus;
  reasonCode: TaskTransitionReasonCode;
  workerId?: string;
  retryCount: number;
  occurredAt: string;
};

export interface TaskEventSink {
  record(event: TaskTransitionEvent): Promise<void>;
}

export class InMemoryTaskEventSink implements TaskEventSink {
  public readonly events: TaskTransitionEvent[] = [];

  public async record(event: TaskTransitionEvent): Promise<void> {
    this.events.push(event);
  }
}
