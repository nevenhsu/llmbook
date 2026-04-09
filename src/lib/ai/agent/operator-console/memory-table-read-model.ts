import { createAdminClient } from "@/lib/supabase/admin";
import type { AiAgentOperatorMemoryTableResponse } from "@/lib/ai/agent/operator-console/types";

type PersonaSummaryRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  last_compressed_at: string | null;
  compression_state: Record<string, unknown> | null;
};

type PersonaMemoryRow = {
  persona_id: string;
  memory_type: string;
  updated_at: string;
};

type Deps = {
  loadPersonas: () => Promise<
    Array<{
      id: string;
      username: string | null;
      displayName: string | null;
      lastCompressedAt: string | null;
      priorityScore: number | null;
    }>
  >;
  loadMemoryStats: () => Promise<
    Map<
      string,
      {
        shortMemoryCount: number;
        longMemoryPresent: boolean;
        latestMemoryUpdatedAt: string | null;
      }
    >
  >;
  now: () => Date;
};

export class AiAgentMemoryTableReadModel {
  private readonly deps: Deps;

  public constructor(options?: { deps?: Partial<Deps> }) {
    this.deps = {
      loadPersonas:
        options?.deps?.loadPersonas ??
        (async () => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("personas")
            .select("id, username, display_name, last_compressed_at, compression_state")
            .returns<PersonaSummaryRow[]>();
          if (error) {
            throw new Error(`load memory personas failed: ${error.message}`);
          }
          return (data ?? []).map((row) => ({
            id: row.id,
            username: row.username,
            displayName: row.display_name,
            lastCompressedAt: row.last_compressed_at,
            priorityScore:
              typeof row.compression_state?.priorityScore === "number"
                ? row.compression_state.priorityScore
                : null,
          }));
        }),
      loadMemoryStats:
        options?.deps?.loadMemoryStats ??
        (async () => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("persona_memories")
            .select("persona_id, memory_type, updated_at")
            .returns<PersonaMemoryRow[]>();
          if (error) {
            throw new Error(`load persona_memories failed: ${error.message}`);
          }
          const map = new Map<
            string,
            {
              shortMemoryCount: number;
              longMemoryPresent: boolean;
              latestMemoryUpdatedAt: string | null;
            }
          >();
          for (const row of data ?? []) {
            const current = map.get(row.persona_id) ?? {
              shortMemoryCount: 0,
              longMemoryPresent: false,
              latestMemoryUpdatedAt: null,
            };
            if (row.memory_type === "long_memory") {
              current.longMemoryPresent = true;
            } else {
              current.shortMemoryCount += 1;
            }
            if (
              !current.latestMemoryUpdatedAt ||
              new Date(row.updated_at).getTime() > new Date(current.latestMemoryUpdatedAt).getTime()
            ) {
              current.latestMemoryUpdatedAt = row.updated_at;
            }
            map.set(row.persona_id, current);
          }
          return map;
        }),
      now: options?.deps?.now ?? (() => new Date()),
    };
  }

  public async list(input: {
    page: number;
    pageSize: number;
  }): Promise<AiAgentOperatorMemoryTableResponse> {
    const page = Math.max(1, input.page);
    const pageSize = Math.max(1, Math.min(input.pageSize, 50));
    const [personas, statsMap] = await Promise.all([
      this.deps.loadPersonas(),
      this.deps.loadMemoryStats(),
    ]);

    const rows = personas
      .map((persona) => {
        const stats = statsMap.get(persona.id) ?? {
          shortMemoryCount: 0,
          longMemoryPresent: false,
          latestMemoryUpdatedAt: null,
        };
        return {
          persona: {
            id: persona.id,
            username: persona.username,
            displayName: persona.displayName,
          },
          longMemoryPresent: stats.longMemoryPresent,
          shortMemoryCount: stats.shortMemoryCount,
          latestMemoryUpdatedAt: stats.latestMemoryUpdatedAt,
          lastCompressedAt: persona.lastCompressedAt,
          priorityScore: persona.priorityScore,
        };
      })
      .sort((left, right) => {
        if (!left.lastCompressedAt && right.lastCompressedAt) {
          return -1;
        }
        if (left.lastCompressedAt && !right.lastCompressedAt) {
          return 1;
        }
        if (left.lastCompressedAt && right.lastCompressedAt) {
          const delta =
            new Date(left.lastCompressedAt).getTime() - new Date(right.lastCompressedAt).getTime();
          if (delta !== 0) {
            return delta;
          }
        }
        const priorityDelta = (right.priorityScore ?? 0) - (left.priorityScore ?? 0);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        return (left.persona.username ?? left.persona.id).localeCompare(
          right.persona.username ?? right.persona.id,
        );
      });

    const totalItems = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

    return {
      page,
      pageSize,
      totalItems,
      totalPages,
      fetchedAt: this.deps.now().toISOString(),
      summary: {
        total: totalItems,
      },
      rows: pageRows,
    };
  }
}
