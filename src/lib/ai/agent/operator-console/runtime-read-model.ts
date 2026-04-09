import { createAdminClient } from "@/lib/supabase/admin";
import { AiAgentJobRuntimeStateService } from "@/lib/ai/agent/jobs/job-runtime-state-service";
import { AiAgentRuntimeStateService } from "@/lib/ai/agent/runtime-state-service";
import { privateEnv } from "@/lib/env";
import type { AiAgentOperatorRuntimeTabResponse } from "@/lib/ai/agent/operator-console/types";

type Deps = {
  loadMainRuntime: () => Promise<AiAgentOperatorRuntimeTabResponse["mainRuntime"]>;
  loadJobsRuntime: () => Promise<AiAgentOperatorRuntimeTabResponse["jobsRuntime"]>;
  countQueueTasksAll: () => Promise<number>;
  countPublicTasks: () => Promise<number>;
  countNotificationTasks: () => Promise<number>;
  countImageQueue: () => Promise<number>;
  countJobsQueue: () => Promise<number>;
  now: () => Date;
};

export class AiAgentOperatorRuntimeReadModel {
  private readonly deps: Deps;

  public constructor(options?: { deps?: Partial<Deps>; runtimeKey?: string }) {
    const runtimeKey = options?.runtimeKey ?? privateEnv.aiAgentRuntimeStateKey;
    this.deps = {
      loadMainRuntime:
        options?.deps?.loadMainRuntime ?? (() => new AiAgentRuntimeStateService().loadSnapshot()),
      loadJobsRuntime:
        options?.deps?.loadJobsRuntime ??
        (() => new AiAgentJobRuntimeStateService({ runtimeKey }).loadSnapshot()),
      countQueueTasksAll:
        options?.deps?.countQueueTasksAll ?? (() => this.countTable("persona_tasks")),
      countPublicTasks:
        options?.deps?.countPublicTasks ??
        (() => this.countTable("persona_tasks", { column: "dispatch_kind", value: "public" })),
      countNotificationTasks:
        options?.deps?.countNotificationTasks ??
        (() =>
          this.countTable("persona_tasks", { column: "dispatch_kind", value: "notification" })),
      countImageQueue: options?.deps?.countImageQueue ?? (() => this.countTable("media")),
      countJobsQueue:
        options?.deps?.countJobsQueue ??
        (() => this.countTable("job_tasks", { column: "runtime_key", value: runtimeKey })),
      now: options?.deps?.now ?? (() => new Date()),
    };
  }

  public async load(): Promise<AiAgentOperatorRuntimeTabResponse> {
    const [
      mainRuntime,
      jobsRuntime,
      queueTasksAll,
      publicTasks,
      notificationTasks,
      imageQueue,
      jobsQueue,
    ] = await Promise.all([
      this.deps.loadMainRuntime(),
      this.deps.loadJobsRuntime(),
      this.deps.countQueueTasksAll(),
      this.deps.countPublicTasks(),
      this.deps.countNotificationTasks(),
      this.deps.countImageQueue(),
      this.deps.countJobsQueue(),
    ]);

    return {
      mainRuntime,
      jobsRuntime,
      summary: {
        queueTasksAll,
        publicTasks,
        notificationTasks,
        imageQueue,
        jobsQueue,
      },
      fetchedAt: this.deps.now().toISOString(),
    };
  }

  private async countTable(
    table: "persona_tasks" | "media" | "job_tasks",
    where?: { column: string; value: string },
  ): Promise<number> {
    const supabase = createAdminClient();
    let query = supabase.from(table).select("id", { count: "exact", head: true });
    if (where) {
      query = query.eq(where.column, where.value);
    }
    const { count, error } = await query;
    if (error) {
      throw new Error(`count ${table} failed: ${error.message}`);
    }
    return count ?? 0;
  }
}
