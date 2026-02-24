import { createAdminClient } from "@/lib/supabase/admin";
import type {
  QueueTask,
  QueueTaskResultType,
  TaskQueueStore,
} from "@/lib/ai/task-queue/task-queue";

type PersonaTaskRow = {
  id: string;
  persona_id: string;
  task_type: QueueTask["taskType"];
  payload: Record<string, unknown> | null;
  status: QueueTask["status"];
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
  max_retries: number;
  result_id: string | null;
  result_type: QueueTaskResultType | null;
  error_message: string | null;
  lease_owner: string | null;
  lease_until: string | null;
  created_at: string;
};

function fromRow(row: PersonaTaskRow): QueueTask {
  return {
    id: row.id,
    personaId: row.persona_id,
    taskType: row.task_type,
    payload: row.payload ?? {},
    status: row.status,
    scheduledAt: new Date(row.scheduled_at),
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    resultId: row.result_id ?? undefined,
    resultType: row.result_type ?? undefined,
    errorMessage: row.error_message ?? undefined,
    leaseOwner: row.lease_owner ?? undefined,
    leaseUntil: row.lease_until ? new Date(row.lease_until) : undefined,
    createdAt: new Date(row.created_at),
  };
}

export class SupabaseTaskQueueStore implements TaskQueueStore {
  public async getById(id: string): Promise<QueueTask | undefined> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("persona_tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle<PersonaTaskRow>();

    if (error) {
      throw new Error(`getById failed: ${error.message}`);
    }

    return data ? fromRow(data) : undefined;
  }

  public async claimOldestPending(
    now: Date,
    workerId: string,
    leaseMs: number,
  ): Promise<QueueTask | null> {
    const supabase = createAdminClient();
    const { data: candidate, error: findError } = await supabase
      .from("persona_tasks")
      .select("*")
      .eq("status", "PENDING")
      .lte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<PersonaTaskRow>();

    if (findError) {
      throw new Error(`claim find candidate failed: ${findError.message}`);
    }

    if (!candidate) {
      return null;
    }

    const leaseUntil = new Date(now.getTime() + leaseMs).toISOString();
    const { data: updated, error: claimError } = await supabase
      .from("persona_tasks")
      .update({
        status: "RUNNING",
        started_at: now.toISOString(),
        lease_owner: workerId,
        lease_until: leaseUntil,
        last_heartbeat_at: now.toISOString(),
        completed_at: null,
      })
      .eq("id", candidate.id)
      .eq("status", "PENDING")
      .select("*")
      .maybeSingle<PersonaTaskRow>();

    if (claimError) {
      throw new Error(`claim update failed: ${claimError.message}`);
    }

    if (!updated) {
      return null;
    }

    return fromRow(updated);
  }

  public async updateHeartbeat(
    taskId: string,
    workerId: string,
    now: Date,
    leaseMs: number,
  ): Promise<QueueTask | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("persona_tasks")
      .update({
        lease_until: new Date(now.getTime() + leaseMs).toISOString(),
        last_heartbeat_at: now.toISOString(),
      })
      .eq("id", taskId)
      .eq("status", "RUNNING")
      .eq("lease_owner", workerId)
      .select("*")
      .maybeSingle<PersonaTaskRow>();

    if (error) {
      throw new Error(`heartbeat failed: ${error.message}`);
    }

    return data ? fromRow(data) : null;
  }

  public async completeTask(input: {
    taskId: string;
    workerId: string;
    resultId?: string;
    resultType?: QueueTaskResultType;
    now: Date;
  }): Promise<QueueTask | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("persona_tasks")
      .update({
        status: "DONE",
        completed_at: input.now.toISOString(),
        result_id: input.resultId ?? null,
        result_type: input.resultType ?? null,
        error_message: null,
        lease_owner: null,
        lease_until: null,
      })
      .eq("id", input.taskId)
      .eq("status", "RUNNING")
      .eq("lease_owner", input.workerId)
      .select("*")
      .maybeSingle<PersonaTaskRow>();

    if (error) {
      throw new Error(`complete failed: ${error.message}`);
    }

    return data ? fromRow(data) : null;
  }

  public async failTask(input: {
    taskId: string;
    workerId: string;
    errorMessage: string;
    now: Date;
  }): Promise<QueueTask | null> {
    const before = await this.getById(input.taskId);
    if (!before || before.status !== "RUNNING" || before.leaseOwner !== input.workerId) {
      return null;
    }

    const retryCount = before.retryCount + 1;
    const willFail = retryCount >= before.maxRetries;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("persona_tasks")
      .update({
        status: willFail ? "FAILED" : "PENDING",
        retry_count: retryCount,
        error_message: input.errorMessage,
        started_at: null,
        completed_at: willFail ? input.now.toISOString() : null,
        lease_owner: null,
        lease_until: null,
      })
      .eq("id", input.taskId)
      .eq("status", "RUNNING")
      .eq("lease_owner", input.workerId)
      .select("*")
      .maybeSingle<PersonaTaskRow>();

    if (error) {
      throw new Error(`fail failed: ${error.message}`);
    }

    return data ? fromRow(data) : null;
  }

  public async recoverTimedOut(now: Date): Promise<QueueTask[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("persona_tasks")
      .update({
        status: "PENDING",
        started_at: null,
        lease_owner: null,
        lease_until: null,
      })
      .eq("status", "RUNNING")
      .lt("lease_until", now.toISOString())
      .select("*");

    if (error) {
      throw new Error(`recoverTimedOut failed: ${error.message}`);
    }

    return (data ?? []).map((row) => fromRow(row as PersonaTaskRow));
  }

  public async skipTask(input: {
    taskId: string;
    workerId: string;
    reason: string;
    now: Date;
  }): Promise<QueueTask | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("persona_tasks")
      .update({
        status: "SKIPPED",
        completed_at: input.now.toISOString(),
        error_message: input.reason,
        lease_owner: null,
        lease_until: null,
      })
      .eq("id", input.taskId)
      .eq("status", "RUNNING")
      .eq("lease_owner", input.workerId)
      .select("*")
      .maybeSingle<PersonaTaskRow>();

    if (error) {
      throw new Error(`skip failed: ${error.message}`);
    }

    return data ? fromRow(data) : null;
  }

  public async markInReview(input: {
    taskId: string;
    workerId: string;
    reason: string;
    now: Date;
  }): Promise<QueueTask | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("persona_tasks")
      .update({
        status: "IN_REVIEW",
        error_message: input.reason,
        lease_owner: null,
        lease_until: null,
      })
      .eq("id", input.taskId)
      .eq("status", "RUNNING")
      .eq("lease_owner", input.workerId)
      .select("*")
      .maybeSingle<PersonaTaskRow>();

    if (error) {
      throw new Error(`markInReview failed: ${error.message}`);
    }

    return data ? fromRow(data) : null;
  }
}
