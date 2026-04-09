import type {
  AiAgentJobRuntimeStateSnapshot,
  AiAgentJobStatus,
  AiAgentJobType,
} from "@/lib/ai/agent/jobs/job-types";
import type { AiAgentRuntimeStateSnapshot } from "@/lib/ai/agent/runtime-state-service";
import type { QueueTaskStatus } from "@/lib/ai/task-queue/task-queue";

export type AiAgentOperatorPersonaCell = {
  id: string;
  username: string | null;
  displayName: string | null;
};

export type AiAgentOperatorTaskTarget = {
  href: string | null;
  label: string | null;
};

export type AiAgentOperatorPagedResponse<T> = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  fetchedAt: string;
  rows: T[];
};

export type AiAgentOperatorTaskTableRow = {
  id: string;
  persona: AiAgentOperatorPersonaCell;
  taskType: string;
  dispatchKind: string;
  status: QueueTaskStatus;
  target: AiAgentOperatorTaskTarget;
  scheduledAt: string;
  completedAt: string | null;
  createdAt: string;
  canRedo: boolean;
};

export type AiAgentOperatorTaskTableResponse =
  AiAgentOperatorPagedResponse<AiAgentOperatorTaskTableRow> & {
    kind: "public" | "notification";
    summary: {
      active: number;
      terminal: number;
      total: number;
    };
  };

export type AiAgentOperatorJobTarget =
  | { kind: "task"; label: string | null; href: string | null }
  | { kind: "image"; label: string | null; href: string | null; imageUrl: string | null }
  | {
      kind: "memory";
      label: string | null;
      href: string | null;
      persona: AiAgentOperatorPersonaCell | null;
    };

export type AiAgentOperatorJobRow = {
  id: string;
  jobType: AiAgentJobType;
  subjectId: string;
  status: AiAgentJobStatus;
  target: AiAgentOperatorJobTarget;
  finishedAt: string | null;
  createdAt: string;
  canRedo: boolean;
};

export type AiAgentOperatorJobListResponse = AiAgentOperatorPagedResponse<AiAgentOperatorJobRow> & {
  runtimeState: AiAgentJobRuntimeStateSnapshot;
  summary: {
    active: number;
    terminal: number;
    total: number;
  };
};

export type AiAgentOperatorImageRow = {
  id: string;
  persona: AiAgentOperatorPersonaCell | null;
  status: "PENDING_GENERATION" | "RUNNING" | "DONE" | "FAILED";
  imageUrl: string | null;
  imagePrompt: string | null;
  createdAt: string;
  canRedo: boolean;
};

export type AiAgentOperatorImageTableResponse =
  AiAgentOperatorPagedResponse<AiAgentOperatorImageRow> & {
    summary: {
      active: number;
      terminal: number;
      total: number;
    };
  };

export type AiAgentOperatorMemoryRow = {
  persona: AiAgentOperatorPersonaCell;
  longMemoryPresent: boolean;
  shortMemoryCount: number;
  latestMemoryUpdatedAt: string | null;
  lastCompressedAt: string | null;
  priorityScore: number | null;
};

export type AiAgentOperatorMemoryTableResponse =
  AiAgentOperatorPagedResponse<AiAgentOperatorMemoryRow> & {
    summary: {
      total: number;
    };
  };

export type AiAgentOperatorRuntimeTabResponse = {
  mainRuntime: AiAgentRuntimeStateSnapshot;
  jobsRuntime: AiAgentJobRuntimeStateSnapshot;
  summary: {
    queueTasksAll: number;
    publicTasks: number;
    notificationTasks: number;
    imageQueue: number;
    jobsQueue: number;
  };
  fetchedAt: string;
};
