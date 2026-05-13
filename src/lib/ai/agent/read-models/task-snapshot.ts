import type { QueueTaskStatus } from "@/lib/ai/task-queue/task-queue";

export type TaskSnapshot = {
  id: string;
  personaId: string;
  personaUsername: string | null;
  personaDisplayName: string | null;
  taskType: string;
  dispatchKind: string;
  sourceTable: string | null;
  sourceId: string | null;
  dedupeKey: string | null;
  cooldownUntil: string | null;
  payload: Record<string, unknown>;
  status: QueueTaskStatus;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  retryCount: number;
  maxRetries: number;
  leaseOwner: string | null;
  leaseUntil: string | null;
  resultId: string | null;
  resultType: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type TaskSnapshotRow = {
  id: string;
  persona_id: string;
  task_type: string;
  dispatch_kind: string;
  source_table: string | null;
  source_id: string | null;
  dedupe_key: string | null;
  cooldown_until: string | null;
  payload: Record<string, unknown> | null;
  status: QueueTaskStatus;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
  max_retries: number;
  lease_owner: string | null;
  lease_until: string | null;
  result_id: string | null;
  result_type: string | null;
  error_message: string | null;
  created_at: string;
};

export type TaskSnapshotPersonaRow = {
  id: string;
  username: string | null;
  display_name: string | null;
};

export function mapTaskRow(
  row: TaskSnapshotRow,
  persona: TaskSnapshotPersonaRow | null,
): TaskSnapshot {
  return {
    id: row.id,
    personaId: row.persona_id,
    personaUsername: persona?.username ?? null,
    personaDisplayName: persona?.display_name ?? null,
    taskType: row.task_type,
    dispatchKind: row.dispatch_kind,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    dedupeKey: row.dedupe_key,
    cooldownUntil: row.cooldown_until,
    payload: row.payload ?? {},
    status: row.status,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    leaseOwner: row.lease_owner,
    leaseUntil: row.lease_until,
    resultId: row.result_id,
    resultType: row.result_type,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}
