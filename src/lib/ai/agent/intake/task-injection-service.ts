import type { AiAgentRuntimeIntakeKind } from "@/lib/ai/agent/intake/intake-read-model";
import {
  type TaskCandidatePreview,
  type TaskInjectionPreview,
} from "@/lib/ai/agent/intake/intake-preview";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import type { QueueTaskStatus } from "@/lib/ai/task-queue/task-queue";
import { createAdminClient } from "@/lib/supabase/admin";

type PersonaIdentityRow = {
  id: string;
  username: string | null;
  display_name: string | null;
};

type InsertedTaskRow = {
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

type InjectPersonaTasksRpcCandidate = {
  candidate_index: number;
  persona_id: string;
  task_type: "comment" | "post" | "reply";
  dispatch_kind: "notification" | "public";
  source_table: string | null;
  source_id: string | null;
  dedupe_key: string;
  cooldown_until: string;
  payload: Record<string, unknown>;
};

type InjectPersonaTasksRpcResult = {
  candidate_index: number;
  inserted: boolean;
  skip_reason: string | null;
  task_id: string | null;
};

type TaskInjectionServiceDeps = {
  injectCandidates: (
    candidates: InjectPersonaTasksRpcCandidate[],
  ) => Promise<InjectPersonaTasksRpcResult[]>;
  loadInsertedTaskRows: (taskIds: string[]) => Promise<InsertedTaskRow[]>;
  loadPersonaIdentity: (personaId: string) => Promise<PersonaIdentityRow | null>;
};

export type AiAgentTaskInjectionExecutedResponse = {
  mode: "executed";
  kind: AiAgentRuntimeIntakeKind | "manual";
  message: string;
  injectionPreview: TaskInjectionPreview;
  insertedTasks: AiAgentRecentTaskSnapshot[];
};

function toQueueTaskType(candidate: TaskCandidatePreview): "comment" | "post" | "reply" {
  if (candidate.payload.contentType === "post") {
    return "post";
  }

  if (candidate.dispatchKind === "notification" && candidate.payload.contentType === "reply") {
    return "reply";
  }

  return "comment";
}

function toRpcCandidate(candidate: TaskCandidatePreview): InjectPersonaTasksRpcCandidate {
  return {
    candidate_index: candidate.candidateIndex,
    persona_id: candidate.personaId,
    task_type: toQueueTaskType(candidate),
    dispatch_kind: candidate.dispatchKind,
    source_table: candidate.sourceTable,
    source_id: candidate.sourceId,
    dedupe_key: candidate.dedupeKey,
    cooldown_until: candidate.cooldownUntil,
    payload: candidate.payload,
  };
}

function buildActualInjectionPreview(input: {
  candidates: TaskCandidatePreview[];
  rpcResults: InjectPersonaTasksRpcResult[];
}): TaskInjectionPreview {
  const resultMap = new Map(
    input.rpcResults.map((result) => [result.candidate_index, result] as const),
  );
  const results = input.candidates.map((candidate) => {
    const result = resultMap.get(candidate.candidateIndex);
    return {
      candidateIndex: candidate.candidateIndex,
      inserted: result?.inserted ?? false,
      skipReason: result?.skip_reason ?? "missing_rpc_result",
      taskId: result?.task_id ?? null,
      taskType: candidate.payload.contentType,
      dispatchKind: candidate.dispatchKind,
      personaUsername: candidate.username,
      sourceTable: candidate.sourceTable,
      sourceId: candidate.sourceId,
    };
  });

  const insertedTaskIds = results.flatMap((result) =>
    result.inserted && result.taskId ? [result.taskId] : [],
  );
  const skippedReasonCounts = results.reduce<Record<string, number>>((counts, result) => {
    if (result.skipReason) {
      counts[result.skipReason] = (counts[result.skipReason] ?? 0) + 1;
    }
    return counts;
  }, {});

  return {
    rpcName: "inject_persona_tasks",
    summary: {
      candidateCount: results.length,
      insertedCount: results.filter((result) => result.inserted).length,
      skippedCount: results.filter((result) => !result.inserted).length,
      insertedTaskIds,
      skippedReasonCounts,
    },
    results,
  };
}

function toRecentTaskSnapshot(
  row: InsertedTaskRow,
  persona: PersonaIdentityRow | null,
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

export class AiAgentTaskInjectionService {
  private readonly deps: TaskInjectionServiceDeps;

  public constructor(options?: { deps?: Partial<TaskInjectionServiceDeps> }) {
    this.deps = {
      injectCandidates:
        options?.deps?.injectCandidates ??
        (async (candidates) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase.rpc("inject_persona_tasks", {
            candidates,
          });

          if (error) {
            throw new Error(`inject_persona_tasks RPC failed: ${error.message}`);
          }

          return Array.isArray(data) ? (data as InjectPersonaTasksRpcResult[]) : [];
        }),
      loadInsertedTaskRows:
        options?.deps?.loadInsertedTaskRows ??
        (async (taskIds) => {
          if (taskIds.length === 0) {
            return [];
          }

          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("persona_tasks")
            .select(
              "id, persona_id, task_type, dispatch_kind, source_table, source_id, dedupe_key, cooldown_until, payload, status, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, result_id, result_type, error_message, created_at",
            )
            .in("id", taskIds)
            .returns<InsertedTaskRow[]>();

          if (error) {
            throw new Error(`load injected persona_tasks failed: ${error.message}`);
          }

          return data ?? [];
        }),
      loadPersonaIdentity:
        options?.deps?.loadPersonaIdentity ??
        (async (personaId) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("personas")
            .select("id, username, display_name")
            .eq("id", personaId)
            .maybeSingle<PersonaIdentityRow>();

          if (error) {
            throw new Error(`load task persona identity failed: ${error.message}`);
          }

          return data ?? null;
        }),
    };
  }

  public async executeCandidates(input: {
    candidates: TaskCandidatePreview[];
    kind?: AiAgentRuntimeIntakeKind | "manual";
  }): Promise<AiAgentTaskInjectionExecutedResponse> {
    const kind = input.kind ?? "manual";

    const rpcResults = await this.deps.injectCandidates(
      input.candidates.map((candidate) => toRpcCandidate(candidate)),
    );
    const injectionPreview = buildActualInjectionPreview({
      candidates: input.candidates,
      rpcResults,
    });

    const insertedTaskIds = injectionPreview.summary.insertedTaskIds;
    const insertedRows = await this.deps.loadInsertedTaskRows(insertedTaskIds);
    const insertedRowMap = new Map(insertedRows.map((row) => [row.id, row] as const));

    const insertedTasks = await Promise.all(
      insertedTaskIds
        .flatMap((taskId) => {
          const row = insertedRowMap.get(taskId);
          return row ? [row] : [];
        })
        .map(async (row) =>
          toRecentTaskSnapshot(row, await this.deps.loadPersonaIdentity(row.persona_id)),
        ),
    );

    return {
      mode: "executed",
      kind,
      message:
        kind === "manual"
          ? `Inserted ${insertedTasks.length} persona_tasks rows for manual save.`
          : `Inserted ${insertedTasks.length} persona_tasks rows for ${kind} intake.`,
      injectionPreview,
      insertedTasks,
    };
  }
}
