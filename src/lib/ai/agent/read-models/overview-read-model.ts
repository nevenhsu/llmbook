import { loadAiAgentConfig, type AiAgentConfigSnapshot } from "@/lib/ai/agent/config/agent-config";
import {
  AiAgentRuntimeStateService,
  type AiAgentRuntimeStateSnapshot,
} from "@/lib/ai/agent/runtime-state-service";
import type { QueueTaskStatus } from "@/lib/ai/task-queue/task-queue";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mapTaskRow,
  type TaskSnapshot,
  type TaskSnapshotPersonaRow,
  type TaskSnapshotRow,
} from "./task-snapshot";

export type AiAgentQueueSummary = {
  pending: number;
  running: number;
  inReview: number;
  done: number;
  failed: number;
  skipped: number;
  total: number;
};

export type AiAgentUsageSnapshot = {
  windowStart: string;
  windowEnd: string | null;
  textPromptTokens: number;
  textCompletionTokens: number;
  imageGenerationCount: number;
  updatedAt: string;
};

export type AiAgentCheckpointSnapshot = {
  sourceName: string;
  lastCapturedAt: string;
  safetyOverlapSeconds: number;
};

export type AiAgentLatestRunSnapshot = {
  runAt: string;
  snapshotFrom: string;
  snapshotTo: string;
  commentsInjected: number;
  postsInjected: number;
  skippedReason: string | null;
  metadata: Record<string, unknown>;
};

export type { AiAgentRuntimeStateSnapshot } from "@/lib/ai/agent/runtime-state-service";

export type AiAgentRecentMediaJobSnapshot = {
  id: string;
  personaId: string | null;
  personaUsername: string | null;
  personaDisplayName: string | null;
  postId: string | null;
  commentId: string | null;
  status: "PENDING_GENERATION" | "RUNNING" | "DONE" | "FAILED";
  imagePrompt: string | null;
  url: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string | null;
  lastError: string | null;
  createdAt: string;
};

// Temporary alias during migration — consumers should move to TaskSnapshot
export type AiAgentRecentTaskSnapshot = TaskSnapshot;

export type AiAgentOverviewSnapshot = {
  config: AiAgentConfigSnapshot;
  queue: AiAgentQueueSummary;
  usage: AiAgentUsageSnapshot | null;
  checkpoints: AiAgentCheckpointSnapshot[];
  latestRun: AiAgentLatestRunSnapshot | null;
  recentTasks: AiAgentRecentTaskSnapshot[];
  recentRuns: AiAgentLatestRunSnapshot[];
  recentMediaJobs: AiAgentRecentMediaJobSnapshot[];
  runtimeState: AiAgentRuntimeStateSnapshot;
};

type AiAgentTaskStatusRow = {
  status: QueueTaskStatus;
};

type AiAgentTaskRow = TaskSnapshotRow;
type PersonaIdentityRow = TaskSnapshotPersonaRow;

type OverviewDeps = {
  loadConfig: () => Promise<AiAgentConfigSnapshot>;
  loadTaskStatuses: () => Promise<AiAgentTaskStatusRow[]>;
  loadUsage: () => Promise<AiAgentUsageSnapshot | null>;
  loadCheckpoints: () => Promise<AiAgentCheckpointSnapshot[]>;
  loadLatestRun: () => Promise<AiAgentLatestRunSnapshot | null>;
  loadRecentTasks: () => Promise<AiAgentRecentTaskSnapshot[]>;
  loadRecentRuns: () => Promise<AiAgentLatestRunSnapshot[]>;
  loadRecentMediaJobs: () => Promise<AiAgentRecentMediaJobSnapshot[]>;
  loadRuntimeState: () => Promise<AiAgentRuntimeStateSnapshot>;
};

type OrchestratorRunRow = {
  run_at: string;
  snapshot_from: string;
  snapshot_to: string;
  comments_injected: number;
  posts_injected: number;
  skipped_reason: string | null;
  metadata: Record<string, unknown> | null;
};

type MediaJobRow = {
  id: string;
  persona_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  status: "PENDING_GENERATION" | "RUNNING" | "DONE" | "FAILED";
  image_prompt: string | null;
  url: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  last_error: string | null;
  created_at: string;
};

function emptyQueueSummary(): AiAgentQueueSummary {
  return {
    pending: 0,
    running: 0,
    inReview: 0,
    done: 0,
    failed: 0,
    skipped: 0,
    total: 0,
  };
}

function summarizeQueue(rows: AiAgentTaskStatusRow[]): AiAgentQueueSummary {
  const summary = emptyQueueSummary();
  for (const row of rows) {
    summary.total += 1;
    switch (row.status) {
      case "PENDING":
        summary.pending += 1;
        break;
      case "RUNNING":
        summary.running += 1;
        break;
      case "IN_REVIEW":
        summary.inReview += 1;
        break;
      case "DONE":
        summary.done += 1;
        break;
      case "FAILED":
        summary.failed += 1;
        break;
      case "SKIPPED":
        summary.skipped += 1;
        break;
    }
  }
  return summary;
}

export class AiAgentOverviewStore {
  private readonly deps: OverviewDeps;

  public constructor(options?: { deps?: Partial<OverviewDeps> }) {
    const runtimeStateService = new AiAgentRuntimeStateService();
    this.deps = {
      loadConfig: options?.deps?.loadConfig ?? (() => loadAiAgentConfig()),
      loadTaskStatuses: options?.deps?.loadTaskStatuses ?? (() => this.readTaskStatuses()),
      loadUsage: options?.deps?.loadUsage ?? (() => this.readUsage()),
      loadCheckpoints: options?.deps?.loadCheckpoints ?? (() => this.readCheckpoints()),
      loadLatestRun: options?.deps?.loadLatestRun ?? (() => this.readLatestRun()),
      loadRecentTasks: options?.deps?.loadRecentTasks ?? (() => this.readRecentTasks()),
      loadRecentRuns: options?.deps?.loadRecentRuns ?? (() => this.readRecentRuns()),
      loadRecentMediaJobs: options?.deps?.loadRecentMediaJobs ?? (() => this.readRecentMediaJobs()),
      loadRuntimeState:
        options?.deps?.loadRuntimeState ?? (() => runtimeStateService.loadSnapshot()),
    };
  }

  public async getSnapshot(): Promise<AiAgentOverviewSnapshot> {
    const [
      config,
      taskStatuses,
      usage,
      checkpoints,
      latestRun,
      recentTasks,
      recentRuns,
      recentMediaJobs,
      runtimeState,
    ] = await Promise.all([
      this.deps.loadConfig(),
      this.deps.loadTaskStatuses(),
      this.deps.loadUsage(),
      this.deps.loadCheckpoints(),
      this.deps.loadLatestRun(),
      this.deps.loadRecentTasks(),
      this.deps.loadRecentRuns(),
      this.deps.loadRecentMediaJobs(),
      this.deps.loadRuntimeState(),
    ]);

    return {
      config,
      queue: summarizeQueue(taskStatuses),
      usage,
      checkpoints,
      latestRun,
      recentTasks,
      recentRuns,
      recentMediaJobs,
      runtimeState,
    };
  }

  private async readTaskStatuses(): Promise<AiAgentTaskStatusRow[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("persona_tasks")
      .select("status")
      .returns<AiAgentTaskStatusRow[]>();

    if (error) {
      throw new Error(`load persona_tasks status failed: ${error.message}`);
    }

    return data ?? [];
  }

  private async readUsage(): Promise<AiAgentUsageSnapshot | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_global_usage")
      .select(
        "window_start, window_end, text_prompt_tokens, text_completion_tokens, image_generation_count, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        window_start: string;
        window_end: string | null;
        text_prompt_tokens: number;
        text_completion_tokens: number;
        image_generation_count: number;
        updated_at: string;
      }>();

    if (error) {
      throw new Error(`load ai_global_usage failed: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return {
      windowStart: data.window_start,
      windowEnd: data.window_end,
      textPromptTokens: data.text_prompt_tokens,
      textCompletionTokens: data.text_completion_tokens,
      imageGenerationCount: data.image_generation_count,
      updatedAt: data.updated_at,
    };
  }

  private async readCheckpoints(): Promise<AiAgentCheckpointSnapshot[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("heartbeat_checkpoints")
      .select("source_name, last_captured_at, safety_overlap_seconds")
      .order("source_name", { ascending: true })
      .returns<
        Array<{
          source_name: string;
          last_captured_at: string;
          safety_overlap_seconds: number;
        }>
      >();

    if (error) {
      throw new Error(`load heartbeat_checkpoints failed: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      sourceName: row.source_name,
      lastCapturedAt: row.last_captured_at,
      safetyOverlapSeconds: row.safety_overlap_seconds,
    }));
  }

  private async readLatestRun(): Promise<AiAgentLatestRunSnapshot | null> {
    const runs = await this.readRecentRuns(1);
    return runs[0] ?? null;
  }

  private async readRecentTasks(limit = 12): Promise<AiAgentRecentTaskSnapshot[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("persona_tasks")
      .select(
        "id, persona_id, task_type, dispatch_kind, source_table, source_id, dedupe_key, cooldown_until, payload, status, scheduled_at, started_at, completed_at, retry_count, max_retries, lease_owner, lease_until, result_id, result_type, error_message, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<AiAgentTaskRow[]>();

    if (error) {
      throw new Error(`load recent persona_tasks failed: ${error.message}`);
    }

    const rows = data ?? [];
    if (rows.length === 0) {
      return [];
    }

    const personaIds = [...new Set(rows.map((row) => row.persona_id))];
    const { data: personas, error: personaError } = await supabase
      .from("personas")
      .select("id, username, display_name")
      .in("id", personaIds)
      .returns<PersonaIdentityRow[]>();

    if (personaError) {
      throw new Error(`load task persona identities failed: ${personaError.message}`);
    }

    const personaMap = new Map(
      (personas ?? []).map(
        (persona) => [persona.id, persona] satisfies [string, PersonaIdentityRow],
      ),
    );

    return rows.map((row) => mapTaskRow(row, personaMap.get(row.persona_id) ?? null));
  }

  private async readRecentRuns(limit = 8): Promise<AiAgentLatestRunSnapshot[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("orchestrator_run_log")
      .select(
        "run_at, snapshot_from, snapshot_to, comments_injected, posts_injected, skipped_reason, metadata",
      )
      .order("run_at", { ascending: false })
      .limit(limit)
      .returns<OrchestratorRunRow[]>();

    if (error) {
      throw new Error(`load orchestrator_run_log failed: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      runAt: row.run_at,
      snapshotFrom: row.snapshot_from,
      snapshotTo: row.snapshot_to,
      commentsInjected: row.comments_injected,
      postsInjected: row.posts_injected,
      skippedReason: row.skipped_reason,
      metadata: row.metadata ?? {},
    }));
  }

  private async readRecentMediaJobs(limit = 12): Promise<AiAgentRecentMediaJobSnapshot[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("media")
      .select(
        "id, persona_id, post_id, comment_id, status, image_prompt, url, mime_type, width, height, size_bytes, retry_count, max_retries, next_retry_at, last_error, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<MediaJobRow[]>();

    if (error) {
      throw new Error(`load recent media jobs failed: ${error.message}`);
    }

    const rows = data ?? [];
    if (rows.length === 0) {
      return [];
    }

    const personaIds = Array.from(
      new Set(rows.map((row) => row.persona_id).filter((value): value is string => Boolean(value))),
    );
    let personaMap = new Map<string, PersonaIdentityRow>();
    if (personaIds.length > 0) {
      const { data: personas, error: personaError } = await supabase
        .from("personas")
        .select("id, username, display_name")
        .in("id", personaIds)
        .returns<PersonaIdentityRow[]>();

      if (personaError) {
        throw new Error(`load media persona identities failed: ${personaError.message}`);
      }

      personaMap = new Map(
        (personas ?? []).map(
          (persona) => [persona.id, persona] satisfies [string, PersonaIdentityRow],
        ),
      );
    }

    return rows.map((row) => {
      const persona = row.persona_id ? (personaMap.get(row.persona_id) ?? null) : null;
      return {
        id: row.id,
        personaId: row.persona_id,
        personaUsername: persona?.username ?? null,
        personaDisplayName: persona?.display_name ?? null,
        postId: row.post_id,
        commentId: row.comment_id,
        status: row.status,
        imagePrompt: row.image_prompt,
        url: row.url,
        mimeType: row.mime_type,
        width: row.width,
        height: row.height,
        sizeBytes: row.size_bytes,
        retryCount: row.retry_count,
        maxRetries: row.max_retries,
        nextRetryAt: row.next_retry_at,
        lastError: row.last_error,
        createdAt: row.created_at,
      };
    });
  }
}
