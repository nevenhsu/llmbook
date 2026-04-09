import { privateEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AiAgentJobSubjectKind,
  AiAgentJobTask,
  AiAgentJobType,
} from "@/lib/ai/agent/jobs/job-types";

type PersonaTaskRow = {
  id: string;
  status: string;
  task_type: string;
};

type PersonaRow = {
  id: string;
};

type JobTaskRow = {
  id: string;
  runtime_key: string;
  job_type: AiAgentJobType;
  subject_kind: AiAgentJobSubjectKind;
  subject_id: string;
  dedupe_key: string;
  status: AiAgentJobTask["status"];
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

type EnqueueDeps = {
  runtimeKey: string;
  now: () => Date;
  findActiveByDedupeKey: (input: {
    runtimeKey: string;
    dedupeKey: string;
  }) => Promise<AiAgentJobTask | null>;
  insertPendingTask: (input: {
    runtimeKey: string;
    jobType: AiAgentJobType;
    subjectKind: AiAgentJobSubjectKind;
    subjectId: string;
    dedupeKey: string;
    payload: Record<string, unknown>;
    requestedBy: string;
    maxRetries?: number;
  }) => Promise<AiAgentJobTask>;
  loadJobTask: (jobId: string) => Promise<AiAgentJobTask | null>;
  retryTask: (input: {
    jobId: string;
    runtimeKey: string;
    requestedBy: string;
  }) => Promise<AiAgentJobTask | null>;
  loadPersonaTask: (
    subjectId: string,
  ) => Promise<{ id: string; status: string; taskType: string } | null>;
  loadPersona: (subjectId: string) => Promise<{ id: string } | null>;
};

export type AiAgentJobEnqueueResult =
  | { mode: "deduped"; task: AiAgentJobTask }
  | { mode: "enqueued"; task: AiAgentJobTask };
export type AiAgentJobRetryResult =
  | { mode: "deduped"; task: AiAgentJobTask }
  | { mode: "retried"; task: AiAgentJobTask };

function buildJobInput(input: { jobType: AiAgentJobType; subjectId: string }): {
  subjectKind: AiAgentJobSubjectKind;
  dedupeKey: string;
  payload: Record<string, unknown>;
} {
  switch (input.jobType) {
    case "public_task":
    case "notification_task":
      return {
        subjectKind: "persona_task",
        dedupeKey: `${input.jobType}:${input.subjectId}`,
        payload: { persona_task_id: input.subjectId },
      };
    case "memory_compress":
      return {
        subjectKind: "persona",
        dedupeKey: `${input.jobType}:${input.subjectId}`,
        payload: { persona_id: input.subjectId },
      };
  }
}

export class AiAgentJobEnqueueService {
  private readonly deps: EnqueueDeps;

  public constructor(options?: { deps?: Partial<EnqueueDeps>; runtimeKey?: string }) {
    const runtimeKey =
      options?.runtimeKey ?? options?.deps?.runtimeKey ?? privateEnv.aiAgentRuntimeStateKey;
    this.deps = {
      runtimeKey,
      now: options?.deps?.now ?? (() => new Date()),
      findActiveByDedupeKey:
        options?.deps?.findActiveByDedupeKey ??
        (async ({ runtimeKey: targetRuntimeKey, dedupeKey }) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("job_tasks")
            .select(
              "id, runtime_key, job_type, subject_kind, subject_id, dedupe_key, status, payload, requested_by, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, error_message, created_at, updated_at",
            )
            .eq("runtime_key", targetRuntimeKey)
            .eq("dedupe_key", dedupeKey)
            .in("status", ["PENDING", "RUNNING"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle<JobTaskRow>();

          if (error) {
            throw new Error(`load active job_task failed: ${error.message}`);
          }

          return data ? fromRow(data) : null;
        }),
      insertPendingTask:
        options?.deps?.insertPendingTask ??
        (async (input) => {
          const supabase = createAdminClient();
          const nowIso = this.deps.now().toISOString();
          const insertRow: Record<string, unknown> = {
            runtime_key: input.runtimeKey,
            job_type: input.jobType,
            subject_kind: input.subjectKind,
            subject_id: input.subjectId,
            dedupe_key: input.dedupeKey,
            status: "PENDING",
            payload: input.payload,
            requested_by: input.requestedBy,
            scheduled_at: nowIso,
          };
          if (typeof input.maxRetries === "number") {
            insertRow.max_retries = input.maxRetries;
          }
          const { data, error } = await supabase
            .from("job_tasks")
            .insert(insertRow)
            .select(
              "id, runtime_key, job_type, subject_kind, subject_id, dedupe_key, status, payload, requested_by, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, error_message, created_at, updated_at",
            )
            .single<JobTaskRow>();

          if (error) {
            throw new Error(`insert job_task failed: ${error.message}`);
          }

          return fromRow(data);
        }),
      loadJobTask:
        options?.deps?.loadJobTask ??
        (async (jobId) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("job_tasks")
            .select(
              "id, runtime_key, job_type, subject_kind, subject_id, dedupe_key, status, payload, requested_by, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, error_message, created_at, updated_at",
            )
            .eq("id", jobId)
            .maybeSingle<JobTaskRow>();
          if (error) {
            throw new Error(`load job_task failed: ${error.message}`);
          }
          return data ? fromRow(data) : null;
        }),
      retryTask:
        options?.deps?.retryTask ??
        (async ({ jobId, runtimeKey, requestedBy }) => {
          const supabase = createAdminClient();
          const nowIso = this.deps.now().toISOString();
          const { data, error } = await supabase
            .from("job_tasks")
            .update({
              status: "PENDING",
              requested_by: requestedBy,
              scheduled_at: nowIso,
              started_at: null,
              completed_at: null,
              retry_count: 0,
              lease_owner: null,
              lease_until: null,
              error_message: null,
              updated_at: nowIso,
            })
            .eq("id", jobId)
            .eq("runtime_key", runtimeKey)
            .in("status", ["FAILED", "SKIPPED"])
            .select(
              "id, runtime_key, job_type, subject_kind, subject_id, dedupe_key, status, payload, requested_by, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, error_message, created_at, updated_at",
            )
            .maybeSingle<JobTaskRow>();
          if (error) {
            throw new Error(`retry job_task failed: ${error.message}`);
          }
          return data ? fromRow(data) : null;
        }),
      loadPersonaTask:
        options?.deps?.loadPersonaTask ??
        (async (subjectId) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("persona_tasks")
            .select("id, status, task_type")
            .eq("id", subjectId)
            .maybeSingle<PersonaTaskRow>();
          if (error) {
            throw new Error(`load persona_task failed: ${error.message}`);
          }
          return data
            ? {
                id: data.id,
                status: data.status,
                taskType: data.task_type,
              }
            : null;
        }),
      loadPersona:
        options?.deps?.loadPersona ??
        (async (subjectId) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("personas")
            .select("id")
            .eq("id", subjectId)
            .maybeSingle<PersonaRow>();
          if (error) {
            throw new Error(`load persona failed: ${error.message}`);
          }
          return data ? { id: data.id } : null;
        }),
    };
  }

  public async enqueue(input: {
    jobType: AiAgentJobType;
    subjectId: string;
    requestedBy: string;
  }): Promise<AiAgentJobEnqueueResult> {
    const jobInput = buildJobInput(input);
    const existing = await this.deps.findActiveByDedupeKey({
      runtimeKey: this.deps.runtimeKey,
      dedupeKey: jobInput.dedupeKey,
    });
    if (existing) {
      return {
        mode: "deduped",
        task: existing,
      };
    }

    await this.validateSubject(input.jobType, input.subjectId);

    return {
      mode: "enqueued",
      task: await this.deps.insertPendingTask({
        runtimeKey: this.deps.runtimeKey,
        jobType: input.jobType,
        subjectKind: jobInput.subjectKind,
        subjectId: input.subjectId,
        dedupeKey: jobInput.dedupeKey,
        payload: jobInput.payload,
        requestedBy: input.requestedBy,
      }),
    };
  }

  public async clone(input: {
    jobId: string;
    requestedBy: string;
  }): Promise<AiAgentJobEnqueueResult> {
    const sourceJob = await this.requireCurrentRuntimeTask(input.jobId);
    if (!["DONE", "FAILED", "SKIPPED"].includes(sourceJob.status)) {
      throw new Error("only terminal job_tasks can be cloned");
    }

    const existing = await this.deps.findActiveByDedupeKey({
      runtimeKey: this.deps.runtimeKey,
      dedupeKey: sourceJob.dedupeKey,
    });
    if (existing) {
      return {
        mode: "deduped",
        task: existing,
      };
    }

    return {
      mode: "enqueued",
      task: await this.deps.insertPendingTask({
        runtimeKey: this.deps.runtimeKey,
        jobType: sourceJob.jobType,
        subjectKind: sourceJob.subjectKind,
        subjectId: sourceJob.subjectId,
        dedupeKey: sourceJob.dedupeKey,
        payload: sourceJob.payload,
        requestedBy: input.requestedBy,
        maxRetries: sourceJob.maxRetries,
      }),
    };
  }

  public async retry(input: {
    jobId: string;
    requestedBy: string;
  }): Promise<AiAgentJobRetryResult> {
    const sourceJob = await this.requireCurrentRuntimeTask(input.jobId);
    if (!["DONE", "FAILED", "SKIPPED"].includes(sourceJob.status) || !sourceJob.errorMessage) {
      throw new Error("only terminal job_tasks with an error can be retried");
    }

    const existing = await this.deps.findActiveByDedupeKey({
      runtimeKey: this.deps.runtimeKey,
      dedupeKey: sourceJob.dedupeKey,
    });
    if (existing) {
      return {
        mode: "deduped",
        task: existing,
      };
    }

    const retried = await this.deps.retryTask({
      jobId: sourceJob.id,
      runtimeKey: this.deps.runtimeKey,
      requestedBy: input.requestedBy,
    });
    if (!retried) {
      throw new Error("retry job_task failed: row was not eligible");
    }

    return {
      mode: "retried",
      task: retried,
    };
  }

  private async requireCurrentRuntimeTask(jobId: string): Promise<AiAgentJobTask> {
    const task = await this.deps.loadJobTask(jobId);
    if (!task) {
      throw new Error("job_task not found");
    }
    if (task.runtimeKey !== this.deps.runtimeKey) {
      throw new Error("job_task does not belong to the active runtime_key");
    }
    return task;
  }

  private async validateSubject(jobType: AiAgentJobType, subjectId: string): Promise<void> {
    switch (jobType) {
      case "public_task":
      case "notification_task": {
        const task = await this.deps.loadPersonaTask(subjectId);
        if (!task) {
          throw new Error("persona_task not found");
        }
        if (task.status !== "DONE") {
          throw new Error("only completed persona_tasks can be queued");
        }
        return;
      }
      case "memory_compress": {
        const persona = await this.deps.loadPersona(subjectId);
        if (!persona) {
          throw new Error("persona not found");
        }
      }
    }
  }
}
