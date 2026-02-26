import { createAdminClient } from "@/lib/supabase/admin";
import type { QueueTaskStatus } from "@/lib/ai/task-queue/task-queue";

const QUEUE_STATUSES: QueueTaskStatus[] = [
  "PENDING",
  "RUNNING",
  "IN_REVIEW",
  "DONE",
  "SKIPPED",
  "FAILED",
];

export type RuntimeWorkerStatus = {
  workerId: string;
  agentType: string;
  status: string;
  circuitOpen: boolean;
  circuitReason: string | null;
  lastHeartbeat: string;
  currentTaskId: string | null;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

export type RuntimeEventItem = {
  id: string;
  layer: string;
  operation: string;
  reasonCode: string;
  entityId: string;
  taskId: string | null;
  personaId: string | null;
  workerId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
};

export type RuntimeTaskItem = {
  id: string;
  personaId: string;
  taskType: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  leaseOwner: string | null;
  leaseUntil: string | null;
  lastHeartbeatAt: string | null;
  retryCount: number;
  maxRetries: number;
  resultId: string | null;
  resultType: string | null;
  skipOrFailReason: string | null;
  latestTransitionReason: string | null;
  latestRuntimeEvent: {
    layer: string;
    operation: string;
    reasonCode: string;
    occurredAt: string;
  } | null;
};

type RuntimeEventRow = {
  id: string;
  layer: string;
  operation: string;
  reason_code: string;
  entity_id: string;
  task_id: string | null;
  persona_id: string | null;
  worker_id: string | null;
  metadata: unknown;
  occurred_at: string;
  created_at: string;
};

type WorkerStatusRow = {
  worker_id: string;
  agent_type: string;
  status: string;
  circuit_open: boolean;
  circuit_reason: string | null;
  last_heartbeat: string;
  current_task_id: string | null;
  metadata: unknown;
  updated_at: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

function mapWorkerStatus(row: WorkerStatusRow): RuntimeWorkerStatus {
  return {
    workerId: row.worker_id,
    agentType: row.agent_type,
    status: row.status,
    circuitOpen: row.circuit_open,
    circuitReason: row.circuit_reason,
    lastHeartbeat: row.last_heartbeat,
    currentTaskId: row.current_task_id,
    metadata: asRecord(row.metadata),
    updatedAt: row.updated_at,
  };
}

function mapRuntimeEvent(row: RuntimeEventRow): RuntimeEventItem {
  return {
    id: row.id,
    layer: row.layer,
    operation: row.operation,
    reasonCode: row.reason_code,
    entityId: row.entity_id,
    taskId: row.task_id,
    personaId: row.persona_id,
    workerId: row.worker_id,
    metadata: asRecord(row.metadata),
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

export class SupabaseRuntimeObservabilityStore {
  public async upsertWorkerStatus(input: {
    workerId: string;
    agentType: string;
    status: "RUNNING" | "IDLE" | "DEGRADED" | "STOPPED";
    circuitOpen: boolean;
    circuitReason?: string | null;
    now: Date;
    currentTaskId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from("ai_worker_status").upsert(
      {
        worker_id: input.workerId,
        agent_type: input.agentType,
        status: input.status,
        circuit_open: input.circuitOpen,
        circuit_reason: input.circuitReason ?? null,
        last_heartbeat: input.now.toISOString(),
        current_task_id: input.currentTaskId ?? null,
        metadata: input.metadata ?? {},
        updated_at: input.now.toISOString(),
      },
      {
        onConflict: "worker_id",
      },
    );

    if (error) {
      throw new Error(`upsert ai_worker_status failed: ${error.message}`);
    }
  }

  public async listWorkerStatuses(): Promise<RuntimeWorkerStatus[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_worker_status")
      .select(
        "worker_id, agent_type, status, circuit_open, circuit_reason, last_heartbeat, current_task_id, metadata, updated_at",
      )
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(`list ai_worker_status failed: ${error.message}`);
    }

    return ((data ?? []) as WorkerStatusRow[]).map(mapWorkerStatus);
  }

  public async getWorkerStatus(workerId: string): Promise<RuntimeWorkerStatus | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_worker_status")
      .select(
        "worker_id, agent_type, status, circuit_open, circuit_reason, last_heartbeat, current_task_id, metadata, updated_at",
      )
      .eq("worker_id", workerId)
      .maybeSingle<WorkerStatusRow>();

    if (error) {
      throw new Error(`get ai_worker_status failed: ${error.message}`);
    }

    return data ? mapWorkerStatus(data) : null;
  }

  public async tryResumeWorkerCircuit(input: {
    workerId: string;
    requestedBy: string;
    now: Date;
  }): Promise<void> {
    const current = await this.getWorkerStatus(input.workerId);
    if (!current) {
      throw new Error("worker status not found");
    }

    const metadata = {
      ...current.metadata,
      resumeRequestedAt: input.now.toISOString(),
      resumeRequestedBy: input.requestedBy,
    };

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("ai_worker_status")
      .update({
        status: "RUNNING",
        circuit_open: false,
        circuit_reason: null,
        metadata,
        updated_at: input.now.toISOString(),
      })
      .eq("worker_id", input.workerId);

    if (error) {
      throw new Error(`resume ai_worker_status failed: ${error.message}`);
    }
  }

  public async getQueueCounts(): Promise<Record<QueueTaskStatus, number>> {
    const supabase = createAdminClient();
    const entries = await Promise.all(
      QUEUE_STATUSES.map(async (status) => {
        const { count, error } = await supabase
          .from("persona_tasks")
          .select("id", { head: true, count: "exact" })
          .eq("status", status);
        if (error) {
          throw new Error(`count persona_tasks(${status}) failed: ${error.message}`);
        }
        return [status, count ?? 0] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<QueueTaskStatus, number>;
  }

  public async getLastRuntimeEventAt(): Promise<string | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_runtime_events")
      .select("occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ occurred_at: string }>();

    if (error) {
      throw new Error(`read ai_runtime_events latest failed: ${error.message}`);
    }
    return data?.occurred_at ?? null;
  }

  public async listRuntimeEvents(input: {
    layer?: string;
    reasonCode?: string;
    entityId?: string;
    from?: Date;
    to?: Date;
    limit: number;
    cursor?: Date;
  }): Promise<{
    items: RuntimeEventItem[];
    hasMore: boolean;
    nextCursor: string | null;
  }> {
    const supabase = createAdminClient();
    let query = supabase
      .from("ai_runtime_events")
      .select(
        "id, layer, operation, reason_code, entity_id, task_id, persona_id, worker_id, metadata, occurred_at, created_at",
      )
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(input.limit + 1);

    if (input.layer) {
      query = query.eq("layer", input.layer);
    }
    if (input.reasonCode) {
      query = query.eq("reason_code", input.reasonCode);
    }
    if (input.entityId) {
      query = query.eq("entity_id", input.entityId);
    }
    if (input.from) {
      query = query.gte("occurred_at", input.from.toISOString());
    }
    if (input.to) {
      query = query.lte("occurred_at", input.to.toISOString());
    }
    if (input.cursor) {
      query = query.lt("occurred_at", input.cursor.toISOString());
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`list ai_runtime_events failed: ${error.message}`);
    }

    const rows = ((data ?? []) as RuntimeEventRow[]).map(mapRuntimeEvent);
    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;
    const nextCursor = hasMore ? (items[items.length - 1]?.occurredAt ?? null) : null;
    return { items, hasMore, nextCursor };
  }

  public async listRecentTasks(limit: number): Promise<RuntimeTaskItem[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("persona_tasks")
      .select(
        "id, persona_id, task_type, status, created_at, started_at, completed_at, lease_owner, lease_until, last_heartbeat_at, retry_count, max_retries, result_id, result_type, error_message",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`list persona_tasks failed: ${error.message}`);
    }

    const tasks =
      (data as Array<{
        id: string;
        persona_id: string;
        task_type: string;
        status: string;
        created_at: string;
        started_at: string | null;
        completed_at: string | null;
        lease_owner: string | null;
        lease_until: string | null;
        last_heartbeat_at: string | null;
        retry_count: number;
        max_retries: number;
        result_id: string | null;
        result_type: string | null;
        error_message: string | null;
      }> | null) ?? [];

    const taskIds = tasks.map((task) => task.id);
    if (taskIds.length === 0) {
      return [];
    }

    const [transitionResult, runtimeResult] = await Promise.all([
      supabase
        .from("task_transition_events")
        .select("task_id, reason_code, created_at")
        .in("task_id", taskIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("ai_runtime_events")
        .select("task_id, layer, operation, reason_code, occurred_at")
        .in("task_id", taskIds)
        .order("occurred_at", { ascending: false }),
    ]);

    if (transitionResult.error) {
      throw new Error(`list task_transition_events failed: ${transitionResult.error.message}`);
    }
    if (runtimeResult.error) {
      throw new Error(`list ai_runtime_events by task failed: ${runtimeResult.error.message}`);
    }

    const transitionByTask = new Map<string, string | null>();
    for (const row of (transitionResult.data ?? []) as Array<{
      task_id: string;
      reason_code: string | null;
    }>) {
      if (!transitionByTask.has(row.task_id)) {
        transitionByTask.set(row.task_id, row.reason_code ?? null);
      }
    }

    const runtimeByTask = new Map<
      string,
      { layer: string; operation: string; reasonCode: string; occurredAt: string }
    >();
    for (const row of (runtimeResult.data ?? []) as Array<{
      task_id: string | null;
      layer: string;
      operation: string;
      reason_code: string;
      occurred_at: string;
    }>) {
      if (!row.task_id || runtimeByTask.has(row.task_id)) {
        continue;
      }
      runtimeByTask.set(row.task_id, {
        layer: row.layer,
        operation: row.operation,
        reasonCode: row.reason_code,
        occurredAt: row.occurred_at,
      });
    }

    return tasks.map((task) => ({
      id: task.id,
      personaId: task.persona_id,
      taskType: task.task_type,
      status: task.status,
      createdAt: task.created_at,
      startedAt: task.started_at,
      completedAt: task.completed_at,
      leaseOwner: task.lease_owner,
      leaseUntil: task.lease_until,
      lastHeartbeatAt: task.last_heartbeat_at,
      retryCount: task.retry_count,
      maxRetries: task.max_retries,
      resultId: task.result_id,
      resultType: task.result_type,
      skipOrFailReason: task.error_message,
      latestTransitionReason: transitionByTask.get(task.id) ?? null,
      latestRuntimeEvent: runtimeByTask.get(task.id) ?? null,
    }));
  }
}
