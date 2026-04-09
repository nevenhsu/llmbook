import { createAdminClient } from "@/lib/supabase/admin";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";

export type AiAgentPersonaIdentityRow = {
  id: string;
  username: string | null;
  display_name: string | null;
};

export type AiAgentPersonaTaskRow = {
  id: string;
  persona_id: string;
  task_type: string;
  dispatch_kind: string;
  source_table: string | null;
  source_id: string | null;
  dedupe_key: string | null;
  cooldown_until: string | null;
  payload: Record<string, unknown> | null;
  status: AiAgentRecentTaskSnapshot["status"];
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

type PersonaTaskStoreDeps = {
  loadTaskRowById: (taskId: string) => Promise<AiAgentPersonaTaskRow | null>;
  loadPersonaIdentityById: (personaId: string) => Promise<AiAgentPersonaIdentityRow | null>;
};

export function mapPersonaTaskRowToSnapshot(
  row: AiAgentPersonaTaskRow,
  persona: AiAgentPersonaIdentityRow | null,
): AiAgentRecentTaskSnapshot {
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

export class AiAgentPersonaTaskStore {
  private readonly deps: PersonaTaskStoreDeps;

  public constructor(options?: { deps?: Partial<PersonaTaskStoreDeps> }) {
    this.deps = {
      loadTaskRowById:
        options?.deps?.loadTaskRowById ??
        (async (taskId) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("persona_tasks")
            .select(
              "id, persona_id, task_type, dispatch_kind, source_table, source_id, dedupe_key, cooldown_until, payload, status, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, result_id, result_type, error_message, created_at",
            )
            .eq("id", taskId)
            .maybeSingle<AiAgentPersonaTaskRow>();

          if (error) {
            throw new Error(`load persona_task failed: ${error.message}`);
          }

          return data ?? null;
        }),
      loadPersonaIdentityById:
        options?.deps?.loadPersonaIdentityById ??
        (async (personaId) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("personas")
            .select("id, username, display_name")
            .eq("id", personaId)
            .maybeSingle<AiAgentPersonaIdentityRow>();

          if (error) {
            throw new Error(`load task persona identity failed: ${error.message}`);
          }

          return data ?? null;
        }),
    };
  }

  public async loadTaskById(taskId: string): Promise<AiAgentRecentTaskSnapshot | null> {
    const row = await this.deps.loadTaskRowById(taskId);
    if (!row) {
      return null;
    }

    return this.hydrateTaskRow(row);
  }

  public async hydrateTaskRow(row: AiAgentPersonaTaskRow): Promise<AiAgentRecentTaskSnapshot> {
    const persona = await this.deps.loadPersonaIdentityById(row.persona_id);
    return mapPersonaTaskRowToSnapshot(row, persona);
  }
}
