export type AiAgentJobType =
  | "public_task"
  | "notification_task"
  | "image_generation"
  | "memory_compress";

export type AiAgentJobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED";

export type AiAgentJobSubjectKind = "persona_task" | "media" | "persona";

export type AiAgentJobTask = {
  id: string;
  runtimeKey: string;
  jobType: AiAgentJobType;
  subjectKind: AiAgentJobSubjectKind;
  subjectId: string;
  dedupeKey: string;
  status: AiAgentJobStatus;
  payload: Record<string, unknown>;
  requestedBy: string | null;
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  retryCount: number;
  maxRetries: number;
  leaseOwner: string | null;
  leaseUntil: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AiAgentJobRuntimeStatusLabel = "Paused" | "Running" | "Idle";

export type AiAgentJobRuntimeStateSnapshot = {
  runtimeKey: string;
  paused: boolean;
  leaseOwner: string | null;
  leaseUntil: string | null;
  runtimeAppSeenAt: string | null;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  updatedAt: string | null;
  statusLabel: AiAgentJobRuntimeStatusLabel;
  detail: string;
};
