import { createAdminClient } from "@/lib/supabase/admin";
import type { AiAgentOperatorImageTableResponse } from "@/lib/ai/agent/operator-console/types";

type MediaStatus = "PENDING_GENERATION" | "RUNNING" | "DONE" | "FAILED";
type PersonaRow = {
  id: string;
  username: string | null;
  display_name: string | null;
};
type MediaRow = {
  id: string;
  persona_id: string | null;
  status: MediaStatus;
  image_prompt: string | null;
  url: string | null;
  created_at: string;
};

type Deps = {
  countActiveRows: () => Promise<number>;
  countTerminalRows: () => Promise<number>;
  loadActiveRows: (input: {
    offset: number;
    limit: number;
  }) => Promise<AiAgentOperatorImageTableResponse["rows"]>;
  loadTerminalRows: (input: {
    offset: number;
    limit: number;
  }) => Promise<AiAgentOperatorImageTableResponse["rows"]>;
  now: () => Date;
};

export class AiAgentImageTableReadModel {
  private readonly deps: Deps;

  public constructor(options?: { deps?: Partial<Deps> }) {
    this.deps = {
      countActiveRows:
        options?.deps?.countActiveRows ?? (() => this.countRows(["PENDING_GENERATION", "RUNNING"])),
      countTerminalRows:
        options?.deps?.countTerminalRows ?? (() => this.countRows(["DONE", "FAILED"])),
      loadActiveRows:
        options?.deps?.loadActiveRows ??
        ((input) => this.readRows(["PENDING_GENERATION", "RUNNING"], input)),
      loadTerminalRows:
        options?.deps?.loadTerminalRows ?? ((input) => this.readRows(["DONE", "FAILED"], input)),
      now: options?.deps?.now ?? (() => new Date()),
    };
  }

  public async list(input: {
    page: number;
    pageSize: number;
  }): Promise<AiAgentOperatorImageTableResponse> {
    const page = Math.max(1, input.page);
    const pageSize = Math.max(1, Math.min(input.pageSize, 50));
    const [activeCount, terminalCount] = await Promise.all([
      this.deps.countActiveRows(),
      this.deps.countTerminalRows(),
    ]);
    const totalItems = activeCount + terminalCount;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const offset = (page - 1) * pageSize;

    let rows = [] as AiAgentOperatorImageTableResponse["rows"];
    if (offset < activeCount) {
      const activeRows = await this.deps.loadActiveRows({ offset, limit: pageSize });
      rows = activeRows;
      if (rows.length < pageSize) {
        const terminalRows = await this.deps.loadTerminalRows({
          offset: 0,
          limit: pageSize - rows.length,
        });
        rows = [...rows, ...terminalRows];
      }
    } else {
      rows = await this.deps.loadTerminalRows({
        offset: offset - activeCount,
        limit: pageSize,
      });
    }

    return {
      page,
      pageSize,
      totalItems,
      totalPages,
      fetchedAt: this.deps.now().toISOString(),
      summary: {
        active: activeCount,
        terminal: terminalCount,
        total: totalItems,
      },
      rows,
    };
  }

  private async countRows(statuses: MediaStatus[]): Promise<number> {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("media")
      .select("id", { count: "exact", head: true })
      .in("status", statuses);
    if (error) {
      throw new Error(`count media rows failed: ${error.message}`);
    }
    return count ?? 0;
  }

  private async readRows(
    statuses: MediaStatus[],
    input: { offset: number; limit: number },
  ): Promise<AiAgentOperatorImageTableResponse["rows"]> {
    if (input.limit <= 0) {
      return [];
    }
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("media")
      .select("id, persona_id, status, image_prompt, url, created_at")
      .in("status", statuses)
      .order("created_at", { ascending: false })
      .range(input.offset, input.offset + input.limit - 1)
      .returns<MediaRow[]>();
    if (error) {
      throw new Error(`load media rows failed: ${error.message}`);
    }

    const rows = data ?? [];
    const personaIds = Array.from(
      new Set(rows.map((row) => row.persona_id).filter((value): value is string => Boolean(value))),
    );
    let personaMap = new Map<string, PersonaRow>();
    if (personaIds.length > 0) {
      const { data: personaRows, error: personaError } = await supabase
        .from("personas")
        .select("id, username, display_name")
        .in("id", personaIds)
        .returns<PersonaRow[]>();
      if (personaError) {
        throw new Error(`load image personas failed: ${personaError.message}`);
      }
      personaMap = new Map((personaRows ?? []).map((row) => [row.id, row]));
    }

    return rows.map((row) => ({
      id: row.id,
      persona: row.persona_id
        ? {
            id: row.persona_id,
            username: personaMap.get(row.persona_id)?.username ?? null,
            displayName: personaMap.get(row.persona_id)?.display_name ?? null,
          }
        : null,
      status: row.status,
      imageUrl: row.url,
      imagePrompt: row.image_prompt,
      createdAt: row.created_at,
      canRedo: row.status === "DONE",
    }));
  }
}
