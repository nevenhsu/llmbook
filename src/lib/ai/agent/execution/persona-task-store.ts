import { createAdminClient } from "@/lib/supabase/admin";
import type { TaskSnapshot } from "@/lib/ai/agent/read-models/task-snapshot";
import {
  mapTaskRow,
  type TaskSnapshotPersonaRow,
  type TaskSnapshotRow,
} from "@/lib/ai/agent/read-models/task-snapshot";

export type AiAgentPersonaIdentityRow = TaskSnapshotPersonaRow;
export type AiAgentPersonaTaskRow = TaskSnapshotRow;

type PersonaTaskStoreDeps = {
  loadTaskRowById: (taskId: string) => Promise<AiAgentPersonaTaskRow | null>;
  loadPersonaIdentityById: (personaId: string) => Promise<AiAgentPersonaIdentityRow | null>;
};

export const mapPersonaTaskRowToSnapshot = mapTaskRow;

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

  public async loadTaskById(taskId: string): Promise<TaskSnapshot | null> {
    const row = await this.deps.loadTaskRowById(taskId);
    if (!row) {
      return null;
    }

    return this.hydrateTaskRow(row);
  }

  public async hydrateTaskRow(row: TaskSnapshotRow): Promise<TaskSnapshot> {
    const persona = await this.deps.loadPersonaIdentityById(row.persona_id);
    return mapPersonaTaskRowToSnapshot(row, persona);
  }
}
