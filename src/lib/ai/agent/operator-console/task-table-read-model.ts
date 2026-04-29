import { createAdminClient } from "@/lib/supabase/admin";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import type {
  AiAgentOperatorTaskTableResponse,
  AiAgentOperatorTaskTarget,
} from "@/lib/ai/agent/operator-console/types";
import { parseTextFlowFailureSummary } from "@/lib/ai/agent/execution/flows/types";

type PersonaRow = {
  id: string;
  username: string | null;
  display_name: string | null;
};

type TaskRow = {
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

function mapTaskRow(row: TaskRow, persona: PersonaRow | null): AiAgentRecentTaskSnapshot {
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

type Deps = {
  countActiveRows: (kind: "public" | "notification") => Promise<number>;
  countTerminalRows: (kind: "public" | "notification") => Promise<number>;
  loadActiveRows: (input: {
    kind: "public" | "notification";
    offset: number;
    limit: number;
  }) => Promise<AiAgentRecentTaskSnapshot[]>;
  loadTerminalRows: (input: {
    kind: "public" | "notification";
    offset: number;
    limit: number;
  }) => Promise<AiAgentRecentTaskSnapshot[]>;
  loadTargetMap: (
    tasks: AiAgentRecentTaskSnapshot[],
  ) => Promise<Map<string, AiAgentOperatorTaskTarget>>;
  now: () => Date;
};

const ACTIVE_STATUSES = ["PENDING", "RUNNING", "IN_REVIEW"] as const;
const TERMINAL_STATUSES = ["DONE", "FAILED", "SKIPPED"] as const;

export class AiAgentTaskTableReadModel {
  private readonly deps: Deps;

  public constructor(options?: { deps?: Partial<Deps> }) {
    this.deps = {
      countActiveRows:
        options?.deps?.countActiveRows ??
        (async (kind) => {
          const supabase = createAdminClient();
          const { count, error } = await supabase
            .from("persona_tasks")
            .select("id", { count: "exact", head: true })
            .eq("dispatch_kind", kind)
            .in("status", [...ACTIVE_STATUSES]);
          if (error) {
            throw new Error(`count active persona_tasks failed: ${error.message}`);
          }
          return count ?? 0;
        }),
      countTerminalRows:
        options?.deps?.countTerminalRows ??
        (async (kind) => {
          const supabase = createAdminClient();
          const { count, error } = await supabase
            .from("persona_tasks")
            .select("id", { count: "exact", head: true })
            .eq("dispatch_kind", kind)
            .in("status", [...TERMINAL_STATUSES]);
          if (error) {
            throw new Error(`count terminal persona_tasks failed: ${error.message}`);
          }
          return count ?? 0;
        }),
      loadActiveRows:
        options?.deps?.loadActiveRows ??
        (async (input) =>
          this.readRows({ ...input, statuses: [...ACTIVE_STATUSES], orderColumn: "scheduled_at" })),
      loadTerminalRows:
        options?.deps?.loadTerminalRows ??
        (async (input) =>
          this.readRows({
            ...input,
            statuses: [...TERMINAL_STATUSES],
            orderColumn: "completed_at",
          })),
      loadTargetMap: options?.deps?.loadTargetMap ?? ((tasks) => this.readTargetMap(tasks)),
      now: options?.deps?.now ?? (() => new Date()),
    };
  }

  public async list(input: {
    kind: "public" | "notification";
    page: number;
    pageSize: number;
  }): Promise<AiAgentOperatorTaskTableResponse> {
    const page = Math.max(1, input.page);
    const pageSize = Math.max(1, Math.min(input.pageSize, 50));
    const [activeCount, terminalCount] = await Promise.all([
      this.deps.countActiveRows(input.kind),
      this.deps.countTerminalRows(input.kind),
    ]);
    const totalItems = activeCount + terminalCount;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const offset = (page - 1) * pageSize;

    let rows: AiAgentRecentTaskSnapshot[] = [];
    if (offset < activeCount) {
      const activeRows = await this.deps.loadActiveRows({
        kind: input.kind,
        offset,
        limit: pageSize,
      });
      rows = activeRows;

      if (rows.length < pageSize) {
        const terminalRows = await this.deps.loadTerminalRows({
          kind: input.kind,
          offset: 0,
          limit: pageSize - rows.length,
        });
        rows = [...rows, ...terminalRows];
      }
    } else {
      rows = await this.deps.loadTerminalRows({
        kind: input.kind,
        offset: offset - activeCount,
        limit: pageSize,
      });
    }

    const targetMap = await this.deps.loadTargetMap(rows);

    return {
      kind: input.kind,
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
      rows: rows.map((row) => ({
        id: row.id,
        persona: {
          id: row.personaId,
          username: row.personaUsername,
          displayName: row.personaDisplayName,
        },
        taskType: row.taskType,
        dispatchKind: row.dispatchKind,
        status: row.status,
        target: targetMap.get(row.id) ?? { href: null, label: null },
        scheduledAt: row.scheduledAt,
        completedAt: row.completedAt,
        createdAt: row.createdAt,
        errorMessage: row.errorMessage,
        flowFailure: parseTextFlowFailureSummary(row.errorMessage),
        canRedo: row.status === "DONE",
      })),
    };
  }

  private async readRows(input: {
    kind: "public" | "notification";
    statuses: string[];
    offset: number;
    limit: number;
    orderColumn: "scheduled_at" | "completed_at";
  }): Promise<AiAgentRecentTaskSnapshot[]> {
    if (input.limit <= 0) {
      return [];
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("persona_tasks")
      .select(
        "id, persona_id, task_type, dispatch_kind, source_table, source_id, dedupe_key, cooldown_until, payload, status, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, result_id, result_type, error_message, created_at",
      )
      .eq("dispatch_kind", input.kind)
      .in("status", input.statuses)
      .order(input.orderColumn, { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(input.offset, input.offset + input.limit - 1)
      .returns<TaskRow[]>();

    if (error) {
      throw new Error(`load persona_tasks failed: ${error.message}`);
    }

    const rows = data ?? [];
    const personaIds = Array.from(new Set(rows.map((row) => row.persona_id)));
    let personaMap = new Map<string, PersonaRow>();
    if (personaIds.length > 0) {
      const { data: personaRows, error: personaError } = await supabase
        .from("personas")
        .select("id, username, display_name")
        .in("id", personaIds)
        .returns<PersonaRow[]>();
      if (personaError) {
        throw new Error(`load persona task personas failed: ${personaError.message}`);
      }
      personaMap = new Map((personaRows ?? []).map((persona) => [persona.id, persona]));
    }

    return rows.map((row) => mapTaskRow(row, personaMap.get(row.persona_id) ?? null));
  }

  private async readTargetMap(
    tasks: AiAgentRecentTaskSnapshot[],
  ): Promise<Map<string, AiAgentOperatorTaskTarget>> {
    const supabase = createAdminClient();
    const resultPosts = tasks
      .filter((task) => task.resultType === "post" && task.resultId)
      .map((task) => task.resultId as string);
    const resultComments = tasks
      .filter((task) => task.resultType === "comment" && task.resultId)
      .map((task) => task.resultId as string);
    const sourcePosts = tasks
      .filter((task) => task.sourceTable === "posts" && task.sourceId)
      .map((task) => task.sourceId as string);
    const sourceComments = tasks
      .filter((task) => task.sourceTable === "comments" && task.sourceId)
      .map((task) => task.sourceId as string);

    const [postRows, commentRows] = await Promise.all([
      resultPosts.length + sourcePosts.length > 0
        ? supabase
            .from("posts")
            .select("id, boards(slug)")
            .in("id", Array.from(new Set([...resultPosts, ...sourcePosts])))
            .returns<
              {
                id: string;
                boards: { slug: string | null } | { slug: string | null }[] | null;
              }[]
            >()
        : Promise.resolve({ data: [], error: null } as const),
      resultComments.length + sourceComments.length > 0
        ? supabase
            .from("comments")
            .select("id, post_id, posts(id, boards(slug))")
            .in("id", Array.from(new Set([...resultComments, ...sourceComments])))
            .returns<
              {
                id: string;
                post_id: string | null;
                posts:
                  | {
                      id: string;
                      boards: { slug: string | null } | { slug: string | null }[] | null;
                    }
                  | {
                      id: string;
                      boards: { slug: string | null } | { slug: string | null }[] | null;
                    }[]
                  | null;
              }[]
            >()
        : Promise.resolve({ data: [], error: null } as const),
    ]);

    if (postRows.error) {
      throw new Error(`load task post targets failed: ${postRows.error.message}`);
    }
    if (commentRows.error) {
      throw new Error(`load task comment targets failed: ${commentRows.error.message}`);
    }

    const postPathMap = new Map<string, string>();
    for (const row of postRows.data ?? []) {
      const board = Array.isArray(row.boards) ? row.boards[0] : row.boards;
      if (board?.slug) {
        postPathMap.set(row.id, `/r/${board.slug}/posts/${row.id}`);
      }
    }

    const commentPathMap = new Map<string, string>();
    for (const row of commentRows.data ?? []) {
      const post = Array.isArray(row.posts) ? row.posts[0] : row.posts;
      const board = Array.isArray(post?.boards) ? post?.boards[0] : post?.boards;
      if (board?.slug && row.post_id) {
        commentPathMap.set(row.id, `/r/${board.slug}/posts/${row.post_id}#comment-${row.id}`);
      }
    }

    const targetMap = new Map<string, AiAgentOperatorTaskTarget>();
    for (const task of tasks) {
      if (task.resultType === "post" && task.resultId) {
        const href = postPathMap.get(task.resultId) ?? null;
        targetMap.set(task.id, { href, label: href });
        continue;
      }
      if (task.resultType === "comment" && task.resultId) {
        const href = commentPathMap.get(task.resultId) ?? null;
        targetMap.set(task.id, { href, label: href });
        continue;
      }
      if (task.sourceTable === "posts" && task.sourceId) {
        const href = postPathMap.get(task.sourceId) ?? null;
        targetMap.set(task.id, { href, label: href });
        continue;
      }
      if (task.sourceTable === "comments" && task.sourceId) {
        const href = commentPathMap.get(task.sourceId) ?? null;
        targetMap.set(task.id, { href, label: href });
        continue;
      }
      targetMap.set(task.id, { href: null, label: null });
    }

    return targetMap;
  }
}
