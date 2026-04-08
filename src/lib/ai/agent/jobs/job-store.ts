import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AiAgentJobStatus,
  AiAgentJobTask,
  AiAgentJobType,
} from "@/lib/ai/agent/jobs/job-types";

type JobTaskRow = {
  id: string;
  runtime_key: string;
  job_type: AiAgentJobType;
  subject_kind: AiAgentJobTask["subjectKind"];
  subject_id: string;
  dedupe_key: string;
  status: AiAgentJobStatus;
  payload: Record<string, unknown> | null;
  requested_by: string | null;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
  max_retries: number;
  lease_owner: string | null;
  lease_until: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function fromRow(row: JobTaskRow): AiAgentJobTask {
  return {
    id: row.id,
    runtimeKey: row.runtime_key,
    jobType: row.job_type,
    subjectKind: row.subject_kind,
    subjectId: row.subject_id,
    dedupeKey: row.dedupe_key,
    status: row.status,
    payload: row.payload ?? {},
    requestedBy: row.requested_by,
    scheduledAt: new Date(row.scheduled_at),
    startedAt: row.started_at ? new Date(row.started_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    leaseOwner: row.lease_owner,
    leaseUntil: row.lease_until ? new Date(row.lease_until) : null,
    errorMessage: row.error_message,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export type AiAgentJobTaskStore = {
  getById(id: string): Promise<AiAgentJobTask | null>;
  claimOldestPending(input: {
    runtimeKey: string;
    workerId: string;
    now: Date;
    leaseMs: number;
  }): Promise<AiAgentJobTask | null>;
  updateHeartbeat(input: {
    taskId: string;
    runtimeKey: string;
    workerId: string;
    now: Date;
    leaseMs: number;
  }): Promise<AiAgentJobTask | null>;
  completeTask(input: {
    taskId: string;
    runtimeKey: string;
    workerId: string;
    now: Date;
  }): Promise<AiAgentJobTask | null>;
  failTask(input: {
    taskId: string;
    runtimeKey: string;
    workerId: string;
    errorMessage: string;
    now: Date;
  }): Promise<AiAgentJobTask | null>;
  skipTask(input: {
    taskId: string;
    runtimeKey: string;
    workerId: string;
    reason: string;
    now: Date;
  }): Promise<AiAgentJobTask | null>;
  recoverTimedOut(input: { runtimeKey: string; now: Date }): Promise<AiAgentJobTask[]>;
};

export class SupabaseJobTaskStore implements AiAgentJobTaskStore {
  public async getById(id: string): Promise<AiAgentJobTask | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("job_tasks")
      .select(
        "id, runtime_key, job_type, subject_kind, subject_id, dedupe_key, status, payload, requested_by, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, error_message, created_at, updated_at",
      )
      .eq("id", id)
      .maybeSingle<JobTaskRow>();

    if (error) {
      throw new Error(`load job_task failed: ${error.message}`);
    }

    return data ? fromRow(data) : null;
  }

  public async claimOldestPending(input: {
    runtimeKey: string;
    workerId: string;
    now: Date;
    leaseMs: number;
  }): Promise<AiAgentJobTask | null> {
    const supabase = createAdminClient();
    const nowIso = input.now.toISOString();
    const { data: pendingRows, error: findError } = await supabase
      .from("job_tasks")
      .select(
        "id, runtime_key, job_type, subject_kind, subject_id, dedupe_key, status, payload, requested_by, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, error_message, created_at, updated_at",
      )
      .eq("runtime_key", input.runtimeKey)
      .eq("status", "PENDING")
      .lte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(25)
      .returns<JobTaskRow[]>();

    if (findError) {
      throw new Error(`claim job_tasks candidate failed: ${findError.message}`);
    }

    const leaseUntilIso = new Date(input.now.getTime() + input.leaseMs).toISOString();
    for (const candidate of pendingRows ?? []) {
      const { data: claimed, error: claimError } = await supabase
        .from("job_tasks")
        .update({
          status: "RUNNING",
          started_at: nowIso,
          completed_at: null,
          lease_owner: input.workerId,
          lease_until: leaseUntilIso,
          error_message: null,
          updated_at: nowIso,
        })
        .eq("id", candidate.id)
        .eq("runtime_key", input.runtimeKey)
        .eq("status", "PENDING")
        .select(
          "id, runtime_key, job_type, subject_kind, subject_id, dedupe_key, status, payload, requested_by, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, error_message, created_at, updated_at",
        )
        .maybeSingle<JobTaskRow>();

      if (claimError) {
        throw new Error(`claim job_task failed: ${claimError.message}`);
      }

      if (claimed) {
        return fromRow(claimed);
      }
    }

    return null;
  }

  public async updateHeartbeat(input: {
    taskId: string;
    runtimeKey: string;
    workerId: string;
    now: Date;
    leaseMs: number;
  }): Promise<AiAgentJobTask | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("job_tasks")
      .update({
        lease_until: new Date(input.now.getTime() + input.leaseMs).toISOString(),
        updated_at: input.now.toISOString(),
      })
      .eq("id", input.taskId)
      .eq("runtime_key", input.runtimeKey)
      .eq("status", "RUNNING")
      .eq("lease_owner", input.workerId)
      .select(
        "id, runtime_key, job_type, subject_kind, subject_id, dedupe_key, status, payload, requested_by, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, error_message, created_at, updated_at",
      )
      .maybeSingle<JobTaskRow>();

    if (error) {
      throw new Error(`heartbeat job_task failed: ${error.message}`);
    }

    return data ? fromRow(data) : null;
  }

  public async completeTask(input: {
    taskId: string;
    runtimeKey: string;
    workerId: string;
    now: Date;
  }): Promise<AiAgentJobTask | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("job_tasks")
      .update({
        status: "DONE",
        completed_at: input.now.toISOString(),
        lease_owner: null,
        lease_until: null,
        error_message: null,
        updated_at: input.now.toISOString(),
      })
      .eq("id", input.taskId)
      .eq("runtime_key", input.runtimeKey)
      .eq("status", "RUNNING")
      .eq("lease_owner", input.workerId)
      .select(
        "id, runtime_key, job_type, subject_kind, subject_id, dedupe_key, status, payload, requested_by, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, error_message, created_at, updated_at",
      )
      .maybeSingle<JobTaskRow>();

    if (error) {
      throw new Error(`complete job_task failed: ${error.message}`);
    }

    return data ? fromRow(data) : null;
  }

  public async failTask(input: {
    taskId: string;
    runtimeKey: string;
    workerId: string;
    errorMessage: string;
    now: Date;
  }): Promise<AiAgentJobTask | null> {
    const current = await this.getById(input.taskId);
    if (
      !current ||
      current.runtimeKey !== input.runtimeKey ||
      current.status !== "RUNNING" ||
      current.leaseOwner !== input.workerId
    ) {
      return null;
    }

    const nextRetryCount = current.retryCount + 1;
    const terminal = nextRetryCount >= current.maxRetries;
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("job_tasks")
      .update({
        status: terminal ? "FAILED" : "PENDING",
        retry_count: nextRetryCount,
        started_at: null,
        completed_at: terminal ? input.now.toISOString() : null,
        lease_owner: null,
        lease_until: null,
        error_message: input.errorMessage,
        updated_at: input.now.toISOString(),
      })
      .eq("id", input.taskId)
      .eq("runtime_key", input.runtimeKey)
      .eq("status", "RUNNING")
      .eq("lease_owner", input.workerId)
      .select(
        "id, runtime_key, job_type, subject_kind, subject_id, dedupe_key, status, payload, requested_by, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, error_message, created_at, updated_at",
      )
      .maybeSingle<JobTaskRow>();

    if (error) {
      throw new Error(`fail job_task failed: ${error.message}`);
    }

    return data ? fromRow(data) : null;
  }

  public async skipTask(input: {
    taskId: string;
    runtimeKey: string;
    workerId: string;
    reason: string;
    now: Date;
  }): Promise<AiAgentJobTask | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("job_tasks")
      .update({
        status: "SKIPPED",
        completed_at: input.now.toISOString(),
        lease_owner: null,
        lease_until: null,
        error_message: input.reason,
        updated_at: input.now.toISOString(),
      })
      .eq("id", input.taskId)
      .eq("runtime_key", input.runtimeKey)
      .eq("status", "RUNNING")
      .eq("lease_owner", input.workerId)
      .select(
        "id, runtime_key, job_type, subject_kind, subject_id, dedupe_key, status, payload, requested_by, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, error_message, created_at, updated_at",
      )
      .maybeSingle<JobTaskRow>();

    if (error) {
      throw new Error(`skip job_task failed: ${error.message}`);
    }

    return data ? fromRow(data) : null;
  }

  public async recoverTimedOut(input: {
    runtimeKey: string;
    now: Date;
  }): Promise<AiAgentJobTask[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("job_tasks")
      .update({
        status: "PENDING",
        started_at: null,
        lease_owner: null,
        lease_until: null,
        updated_at: input.now.toISOString(),
      })
      .eq("runtime_key", input.runtimeKey)
      .eq("status", "RUNNING")
      .lt("lease_until", input.now.toISOString())
      .select(
        "id, runtime_key, job_type, subject_kind, subject_id, dedupe_key, status, payload, requested_by, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, error_message, created_at, updated_at",
      );

    if (error) {
      throw new Error(`recover timed-out job_tasks failed: ${error.message}`);
    }

    return (data ?? []).map((row) => fromRow(row as JobTaskRow));
  }
}
