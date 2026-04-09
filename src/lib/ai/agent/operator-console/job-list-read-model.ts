import { createAdminClient } from "@/lib/supabase/admin";
import { AiAgentJobRuntimeStateService } from "@/lib/ai/agent/jobs/job-runtime-state-service";
import type { AiAgentJobTask } from "@/lib/ai/agent/jobs/job-types";
import type {
  AiAgentOperatorJobListResponse,
  AiAgentOperatorJobTarget,
  AiAgentOperatorPersonaCell,
} from "@/lib/ai/agent/operator-console/types";
import { privateEnv } from "@/lib/env";

type JobRow = {
  id: string;
  runtime_key: string;
  job_type: AiAgentJobTask["jobType"];
  subject_kind: AiAgentJobTask["subjectKind"];
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

function mapJobRow(row: JobRow): AiAgentJobTask {
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

type Deps = {
  loadRuntimeState: () => Promise<AiAgentOperatorJobListResponse["runtimeState"]>;
  countActiveRows: () => Promise<number>;
  countTerminalRows: () => Promise<number>;
  loadActiveRows: (input: { offset: number; limit: number }) => Promise<AiAgentJobTask[]>;
  loadTerminalRows: (input: { offset: number; limit: number }) => Promise<AiAgentJobTask[]>;
  buildTargets: (jobs: AiAgentJobTask[]) => Promise<Map<string, AiAgentOperatorJobTarget>>;
  now: () => Date;
};

export class AiAgentJobListReadModel {
  private readonly deps: Deps;

  public constructor(options?: { deps?: Partial<Deps>; runtimeKey?: string }) {
    const runtimeKey = options?.runtimeKey ?? privateEnv.aiAgentRuntimeStateKey;
    const runtimeStateService = new AiAgentJobRuntimeStateService({ runtimeKey });
    this.deps = {
      loadRuntimeState:
        options?.deps?.loadRuntimeState ?? (() => runtimeStateService.loadSnapshot()),
      countActiveRows:
        options?.deps?.countActiveRows ??
        (() => this.countRows(runtimeKey, ["PENDING", "RUNNING"])),
      countTerminalRows:
        options?.deps?.countTerminalRows ??
        (() => this.countRows(runtimeKey, ["DONE", "FAILED", "SKIPPED"])),
      loadActiveRows:
        options?.deps?.loadActiveRows ??
        ((input) => this.readRows(runtimeKey, ["PENDING", "RUNNING"], "scheduled_at", input)),
      loadTerminalRows:
        options?.deps?.loadTerminalRows ??
        ((input) =>
          this.readRows(runtimeKey, ["DONE", "FAILED", "SKIPPED"], "completed_at", input)),
      buildTargets: options?.deps?.buildTargets ?? ((jobs) => this.readTargets(jobs)),
      now: options?.deps?.now ?? (() => new Date()),
    };
  }

  public async list(input: {
    page: number;
    pageSize: number;
  }): Promise<AiAgentOperatorJobListResponse> {
    const page = Math.max(1, input.page);
    const pageSize = Math.max(1, Math.min(input.pageSize, 50));
    const [runtimeState, activeCount, terminalCount] = await Promise.all([
      this.deps.loadRuntimeState(),
      this.deps.countActiveRows(),
      this.deps.countTerminalRows(),
    ]);
    const totalItems = activeCount + terminalCount;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const offset = (page - 1) * pageSize;

    let jobs: AiAgentJobTask[] = [];
    if (offset < activeCount) {
      const active = await this.deps.loadActiveRows({ offset, limit: pageSize });
      jobs = active;
      if (jobs.length < pageSize) {
        const terminal = await this.deps.loadTerminalRows({
          offset: 0,
          limit: pageSize - jobs.length,
        });
        jobs = [...jobs, ...terminal];
      }
    } else {
      jobs = await this.deps.loadTerminalRows({
        offset: offset - activeCount,
        limit: pageSize,
      });
    }

    const targetMap = await this.deps.buildTargets(jobs);

    return {
      runtimeState,
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
      rows: jobs.map((job) => ({
        id: job.id,
        jobType: job.jobType,
        subjectId: job.subjectId,
        status: job.status,
        target: targetMap.get(job.id) ?? { kind: "task", label: null, href: null },
        errorMessage: job.errorMessage,
        finishedAt: job.completedAt ? job.completedAt.toISOString() : null,
        createdAt: job.createdAt.toISOString(),
        canClone: ["DONE", "FAILED", "SKIPPED"].includes(job.status),
        canRetry: ["DONE", "FAILED", "SKIPPED"].includes(job.status) && Boolean(job.errorMessage),
      })),
    };
  }

  private async countRows(runtimeKey: string, statuses: string[]): Promise<number> {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("job_tasks")
      .select("id", { count: "exact", head: true })
      .eq("runtime_key", runtimeKey)
      .in("status", statuses);
    if (error) {
      throw new Error(`count job_tasks failed: ${error.message}`);
    }
    return count ?? 0;
  }

  private async readRows(
    runtimeKey: string,
    statuses: string[],
    orderColumn: "scheduled_at" | "completed_at",
    input: { offset: number; limit: number },
  ): Promise<AiAgentJobTask[]> {
    if (input.limit <= 0) {
      return [];
    }
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("job_tasks")
      .select(
        "id, runtime_key, job_type, subject_kind, subject_id, dedupe_key, status, payload, requested_by, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, error_message, created_at, updated_at",
      )
      .eq("runtime_key", runtimeKey)
      .in("status", statuses)
      .order(orderColumn, { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(input.offset, input.offset + input.limit - 1)
      .returns<JobRow[]>();
    if (error) {
      throw new Error(`load job_tasks failed: ${error.message}`);
    }
    return (data ?? []).map((row) => mapJobRow(row));
  }

  private async readTargets(
    jobs: AiAgentJobTask[],
  ): Promise<Map<string, AiAgentOperatorJobTarget>> {
    const supabase = createAdminClient();
    const taskIds = jobs
      .filter((job) => job.subjectKind === "persona_task")
      .map((job) => job.subjectId);
    const personaIds = jobs
      .filter((job) => job.subjectKind === "persona")
      .map((job) => job.subjectId);

    const [taskRows, personaRows] = await Promise.all([
      taskIds.length > 0
        ? supabase
            .from("persona_tasks")
            .select("id, result_id, result_type, source_table, source_id")
            .in("id", Array.from(new Set(taskIds)))
            .returns<
              {
                id: string;
                result_id: string | null;
                result_type: "comment" | "post" | null;
                source_table: string | null;
                source_id: string | null;
              }[]
            >()
        : Promise.resolve({ data: [], error: null } as const),
      personaIds.length > 0
        ? supabase
            .from("personas")
            .select("id, username, display_name")
            .in("id", Array.from(new Set(personaIds)))
            .returns<{ id: string; username: string | null; display_name: string | null }[]>()
        : Promise.resolve({ data: [], error: null } as const),
    ]);

    if (taskRows.error) {
      throw new Error(`load job persona_tasks failed: ${taskRows.error.message}`);
    }
    if (personaRows.error) {
      throw new Error(`load job persona targets failed: ${personaRows.error.message}`);
    }

    const taskMap = new Map((taskRows.data ?? []).map((row) => [row.id, row]));
    const personaMap = new Map<string, AiAgentOperatorPersonaCell>(
      (personaRows.data ?? []).map((row) => [
        row.id,
        {
          id: row.id,
          username: row.username,
          displayName: row.display_name,
        },
      ]),
    );

    const taskTargetMap = await this.buildTaskTargetMap(Array.from(taskMap.values()));
    const targetMap = new Map<string, AiAgentOperatorJobTarget>();
    for (const job of jobs) {
      if (job.subjectKind === "persona_task") {
        const task = taskMap.get(job.subjectId);
        targetMap.set(job.id, {
          kind: "task",
          label: task ? (taskTargetMap.get(task.id)?.label ?? null) : null,
          href: task ? (taskTargetMap.get(task.id)?.href ?? null) : null,
        });
        continue;
      }

      targetMap.set(job.id, {
        kind: "memory",
        label:
          personaMap.get(job.subjectId)?.displayName ??
          personaMap.get(job.subjectId)?.username ??
          null,
        href: null,
        persona: personaMap.get(job.subjectId) ?? null,
      });
    }

    return targetMap;
  }

  private async buildTaskTargetMap(
    tasks: Array<{
      id: string;
      result_id: string | null;
      result_type: "comment" | "post" | null;
      source_table: string | null;
      source_id: string | null;
    }>,
  ): Promise<Map<string, { href: string | null; label: string | null }>> {
    const supabase = createAdminClient();
    const postIds = tasks.flatMap((task) =>
      task.result_type === "post" && task.result_id
        ? [task.result_id]
        : task.source_table === "posts" && task.source_id
          ? [task.source_id]
          : [],
    );
    const commentIds = tasks.flatMap((task) =>
      task.result_type === "comment" && task.result_id
        ? [task.result_id]
        : task.source_table === "comments" && task.source_id
          ? [task.source_id]
          : [],
    );

    const [posts, comments] = await Promise.all([
      postIds.length > 0
        ? supabase
            .from("posts")
            .select("id, boards(slug)")
            .in("id", Array.from(new Set(postIds)))
            .returns<
              { id: string; boards: { slug: string | null } | { slug: string | null }[] | null }[]
            >()
        : Promise.resolve({ data: [], error: null } as const),
      commentIds.length > 0
        ? supabase
            .from("comments")
            .select("id, post_id, posts(id, boards(slug))")
            .in("id", Array.from(new Set(commentIds)))
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

    if (posts.error) {
      throw new Error(`load job post target paths failed: ${posts.error.message}`);
    }
    if (comments.error) {
      throw new Error(`load job comment target paths failed: ${comments.error.message}`);
    }

    const postPathMap = new Map<string, string>();
    for (const row of posts.data ?? []) {
      const board = Array.isArray(row.boards) ? row.boards[0] : row.boards;
      if (board?.slug) {
        postPathMap.set(row.id, `/r/${board.slug}/posts/${row.id}`);
      }
    }
    const commentPathMap = new Map<string, string>();
    for (const row of comments.data ?? []) {
      const post = Array.isArray(row.posts) ? row.posts[0] : row.posts;
      const board = Array.isArray(post?.boards) ? post?.boards[0] : post?.boards;
      if (board?.slug && row.post_id) {
        commentPathMap.set(row.id, `/r/${board.slug}/posts/${row.post_id}#comment-${row.id}`);
      }
    }

    const result = new Map<string, { href: string | null; label: string | null }>();
    for (const task of tasks) {
      let href: string | null = null;
      if (task.result_type === "post" && task.result_id) {
        href = postPathMap.get(task.result_id) ?? null;
      } else if (task.result_type === "comment" && task.result_id) {
        href = commentPathMap.get(task.result_id) ?? null;
      } else if (task.source_table === "posts" && task.source_id) {
        href = postPathMap.get(task.source_id) ?? null;
      } else if (task.source_table === "comments" && task.source_id) {
        href = commentPathMap.get(task.source_id) ?? null;
      }
      result.set(task.id, { href, label: href });
    }
    return result;
  }
}
