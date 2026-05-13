import { createAdminClient } from "@/lib/supabase/admin";
import {
  mapTaskRow,
  type TaskSnapshot,
  type TaskSnapshotPersonaRow,
  type TaskSnapshotRow,
} from "@/lib/ai/agent/read-models/task-snapshot";
import type { QueueTaskStatus } from "@/lib/ai/task-queue/task-queue";
import {
  buildMemoryEntryPreview,
  buildMemoryPersonaPreview,
  type AiAgentMemoryEntryPreview,
  type AiAgentMemoryPersonaOption,
  type AiAgentMemoryPersonaPreview,
} from "@/lib/ai/agent/memory/memory-preview";

type PersonaRow = TaskSnapshotPersonaRow;
type TaskRow = TaskSnapshotRow;

type MemoryRow = {
  id: string;
  persona_id: string;
  memory_type: "memory" | "long_memory";
  scope: "persona" | "thread" | "board";
  thread_id: string | null;
  board_id: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  expires_at: string | null;
  importance: number | null;
  created_at: string;
  updated_at: string;
};

const fromTaskRow = mapTaskRow;

export class AiAgentMemoryPreviewStore {
  public async getRuntimePreviewSet(): Promise<{
    personas: AiAgentMemoryPersonaOption[];
    previews: AiAgentMemoryPersonaPreview[];
  }> {
    const supabase = createAdminClient();
    const { data: memoryRows, error: memoryError } = await supabase
      .from("persona_memories")
      .select(
        "id, persona_id, memory_type, scope, thread_id, board_id, content, metadata, expires_at, importance, created_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(120);

    if (memoryError) {
      throw new Error(`load persona_memories failed: ${memoryError.message}`);
    }

    const personaIds = [...new Set((memoryRows ?? []).map((row) => row.persona_id))].slice(0, 8);
    if (personaIds.length === 0) {
      return {
        personas: [],
        previews: [],
      };
    }

    const [{ data: personas, error: personasError }, { data: tasks, error: tasksError }] =
      await Promise.all([
        supabase.from("personas").select("id, username, display_name").in("id", personaIds),
        supabase
          .from("persona_tasks")
          .select(
            "id, persona_id, task_type, dispatch_kind, source_table, source_id, dedupe_key, cooldown_until, payload, status, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, result_id, result_type, error_message, created_at",
          )
          .in("persona_id", personaIds)
          .order("created_at", { ascending: false })
          .limit(120),
      ]);

    if (personasError) {
      throw new Error(`load personas failed: ${personasError.message}`);
    }
    if (tasksError) {
      throw new Error(`load persona_tasks for memory preview failed: ${tasksError.message}`);
    }

    const personaMap = new Map((personas ?? []).map((persona) => [persona.id, persona]));
    const entryMap = new Map<string, AiAgentMemoryEntryPreview[]>();

    for (const row of (memoryRows ?? []) as MemoryRow[]) {
      const persona = personaMap.get(row.persona_id);
      if (!persona?.username) {
        continue;
      }
      const next = buildMemoryEntryPreview({
        id: row.id,
        personaId: row.persona_id,
        username: persona.username,
        displayName: persona.display_name ?? persona.username,
        memoryType: row.memory_type,
        scope: row.scope,
        threadId: row.thread_id,
        boardId: row.board_id,
        content: row.content,
        metadata: row.metadata ?? {},
        expiresAt: row.expires_at,
        importance: row.importance,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
      entryMap.set(row.persona_id, [...(entryMap.get(row.persona_id) ?? []), next]);
    }

    const tasksByPersona = new Map<string, TaskSnapshot[]>();
    for (const row of (tasks ?? []) as TaskRow[]) {
      const persona = personaMap.get(row.persona_id) ?? null;
      const next = fromTaskRow(row, persona);
      tasksByPersona.set(row.persona_id, [...(tasksByPersona.get(row.persona_id) ?? []), next]);
    }

    const personaOptions: AiAgentMemoryPersonaOption[] = personaIds
      .map((personaId) => {
        const persona = personaMap.get(personaId);
        if (!persona?.username) {
          return null;
        }
        const entries = entryMap.get(personaId) ?? [];
        const shortEntries = entries.filter((entry) => entry.memoryType === "memory");
        return {
          personaId,
          username: persona.username,
          displayName: persona.display_name ?? persona.username,
          shortMemoryCount: shortEntries.length,
          longMemoryPresent: entries.some(
            (entry) => entry.memoryType === "long_memory" && entry.scope === "persona",
          ),
          compressibleCount: shortEntries.filter((entry) => !entry.hasOpenLoop).length,
          openLoopCount: shortEntries.filter((entry) => entry.hasOpenLoop).length,
        };
      })
      .filter((item): item is AiAgentMemoryPersonaOption => item !== null);

    const previews = personaOptions.map((persona) =>
      buildMemoryPersonaPreview({
        persona,
        entries: entryMap.get(persona.personaId) ?? [],
        recentTasks: tasksByPersona.get(persona.personaId) ?? [],
      }),
    );

    return {
      personas: personaOptions,
      previews,
    };
  }
}
