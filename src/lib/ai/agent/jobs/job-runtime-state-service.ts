import { privateEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AiAgentJobRuntimeStateSnapshot } from "@/lib/ai/agent/jobs/job-types";

type JobRuntimeStateRow = {
  runtime_key: string;
  paused: boolean;
  lease_owner: string | null;
  lease_until: string | null;
  runtime_app_seen_at: string | null;
  last_started_at: string | null;
  last_finished_at: string | null;
  updated_at: string;
};

type JobRuntimeStateServiceDeps = {
  runtimeKey: string;
  now: () => Date;
  loadRow: () => Promise<JobRuntimeStateRow | null>;
  touchHeartbeatRow: () => Promise<JobRuntimeStateRow | null>;
  setPausedRow: (input: { paused: boolean }) => Promise<JobRuntimeStateRow | null>;
  claimLeaseRow: (input: {
    leaseOwner: string;
    leaseMs: number;
  }) => Promise<JobRuntimeStateRow | null>;
  heartbeatLeaseRow: (input: {
    leaseOwner: string;
    leaseMs: number;
  }) => Promise<JobRuntimeStateRow | null>;
  releaseLeaseRow: (input: { leaseOwner: string }) => Promise<JobRuntimeStateRow | null>;
};

function toLeaseSeconds(leaseMs: number): number {
  return Math.max(1, Math.ceil(leaseMs / 1000));
}

function buildSnapshot(
  row: JobRuntimeStateRow | null,
  now: Date,
  runtimeKey: string,
): AiAgentJobRuntimeStateSnapshot {
  if (!row) {
    return {
      runtimeKey,
      paused: false,
      leaseOwner: null,
      leaseUntil: null,
      runtimeAppSeenAt: null,
      lastStartedAt: null,
      lastFinishedAt: null,
      updatedAt: null,
      statusLabel: "Idle",
      detail: "jobs runtime state row is missing.",
    };
  }

  const leaseActive =
    row.lease_until !== null && new Date(row.lease_until).getTime() > now.getTime();

  if (row.paused) {
    return {
      runtimeKey: row.runtime_key,
      paused: true,
      leaseOwner: row.lease_owner,
      leaseUntil: row.lease_until,
      runtimeAppSeenAt: row.runtime_app_seen_at,
      lastStartedAt: row.last_started_at,
      lastFinishedAt: row.last_finished_at,
      updatedAt: row.updated_at,
      statusLabel: "Paused",
      detail: "Jobs runtime is paused and will not claim new queue rows.",
    };
  }

  if (leaseActive) {
    return {
      runtimeKey: row.runtime_key,
      paused: false,
      leaseOwner: row.lease_owner,
      leaseUntil: row.lease_until,
      runtimeAppSeenAt: row.runtime_app_seen_at,
      lastStartedAt: row.last_started_at,
      lastFinishedAt: row.last_finished_at,
      updatedAt: row.updated_at,
      statusLabel: "Running",
      detail: row.lease_owner
        ? `Jobs runtime lease is held by ${row.lease_owner} until ${row.lease_until}.`
        : "Jobs runtime currently holds an active lease.",
    };
  }

  return {
    runtimeKey: row.runtime_key,
    paused: false,
    leaseOwner: row.lease_owner,
    leaseUntil: row.lease_until,
    runtimeAppSeenAt: row.runtime_app_seen_at,
    lastStartedAt: row.last_started_at,
    lastFinishedAt: row.last_finished_at,
    updatedAt: row.updated_at,
    statusLabel: "Idle",
    detail: "Jobs runtime is idle and ready to claim queue work.",
  };
}

export type AiAgentJobRuntimeLeaseClaimResult =
  | { mode: "claimed"; summary: string; runtimeState: AiAgentJobRuntimeStateSnapshot }
  | { mode: "blocked"; summary: string; runtimeState: AiAgentJobRuntimeStateSnapshot };

export type AiAgentJobRuntimeLeaseHeartbeatResult =
  | { mode: "heartbeated"; summary: string; runtimeState: AiAgentJobRuntimeStateSnapshot }
  | { mode: "blocked"; summary: string; runtimeState: AiAgentJobRuntimeStateSnapshot };

export type AiAgentJobRuntimeLeaseReleaseResult =
  | { mode: "released"; summary: string; runtimeState: AiAgentJobRuntimeStateSnapshot }
  | { mode: "blocked"; summary: string; runtimeState: AiAgentJobRuntimeStateSnapshot };

export class AiAgentJobRuntimeStateService {
  private readonly deps: JobRuntimeStateServiceDeps;

  public constructor(options?: {
    deps?: Partial<JobRuntimeStateServiceDeps>;
    runtimeKey?: string;
  }) {
    const runtimeKey =
      options?.runtimeKey ?? options?.deps?.runtimeKey ?? privateEnv.aiAgentRuntimeStateKey;
    const now = options?.deps?.now ?? (() => new Date());

    this.deps = {
      runtimeKey,
      now,
      loadRow:
        options?.deps?.loadRow ??
        (async () => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("job_runtime_state")
            .select(
              "runtime_key, paused, lease_owner, lease_until, runtime_app_seen_at, last_started_at, last_finished_at, updated_at",
            )
            .eq("runtime_key", runtimeKey)
            .maybeSingle<JobRuntimeStateRow>();

          if (error) {
            throw new Error(`load job_runtime_state failed: ${error.message}`);
          }

          return data ?? null;
        }),
      touchHeartbeatRow:
        options?.deps?.touchHeartbeatRow ??
        (async () => {
          const supabase = createAdminClient();
          const nowIso = now().toISOString();
          const { error: ensureError } = await supabase.from("job_runtime_state").upsert(
            {
              runtime_key: runtimeKey,
              updated_at: nowIso,
            },
            { onConflict: "runtime_key" },
          );

          if (ensureError) {
            throw new Error(`ensure job_runtime_state row failed: ${ensureError.message}`);
          }

          const { data, error } = await supabase
            .from("job_runtime_state")
            .update({
              runtime_app_seen_at: nowIso,
              updated_at: nowIso,
            })
            .eq("runtime_key", runtimeKey)
            .select(
              "runtime_key, paused, lease_owner, lease_until, runtime_app_seen_at, last_started_at, last_finished_at, updated_at",
            )
            .maybeSingle<JobRuntimeStateRow>();

          if (error) {
            throw new Error(`touch job_runtime_state heartbeat failed: ${error.message}`);
          }

          return data ?? null;
        }),
      setPausedRow:
        options?.deps?.setPausedRow ??
        (async (input) => {
          const supabase = createAdminClient();
          const nowIso = now().toISOString();
          const { error: ensureError } = await supabase.from("job_runtime_state").upsert(
            {
              runtime_key: runtimeKey,
              updated_at: nowIso,
            },
            { onConflict: "runtime_key" },
          );

          if (ensureError) {
            throw new Error(`ensure job_runtime_state row failed: ${ensureError.message}`);
          }

          const { data, error } = await supabase
            .from("job_runtime_state")
            .update({
              paused: input.paused,
              updated_at: nowIso,
            })
            .eq("runtime_key", runtimeKey)
            .select(
              "runtime_key, paused, lease_owner, lease_until, runtime_app_seen_at, last_started_at, last_finished_at, updated_at",
            )
            .maybeSingle<JobRuntimeStateRow>();

          if (error) {
            throw new Error(`set job_runtime_state paused failed: ${error.message}`);
          }

          return data ?? null;
        }),
      claimLeaseRow:
        options?.deps?.claimLeaseRow ??
        (async (input) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase.rpc("claim_job_runtime_lease", {
            target_runtime_key: runtimeKey,
            next_lease_owner: input.leaseOwner,
            lease_duration_seconds: toLeaseSeconds(input.leaseMs),
          });

          if (error) {
            throw new Error(`claim_job_runtime_lease RPC failed: ${error.message}`);
          }

          return data ? (data as JobRuntimeStateRow) : null;
        }),
      heartbeatLeaseRow:
        options?.deps?.heartbeatLeaseRow ??
        (async (input) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase.rpc("heartbeat_job_runtime_lease", {
            target_runtime_key: runtimeKey,
            active_lease_owner: input.leaseOwner,
            lease_duration_seconds: toLeaseSeconds(input.leaseMs),
          });

          if (error) {
            throw new Error(`heartbeat_job_runtime_lease RPC failed: ${error.message}`);
          }

          return data ? (data as JobRuntimeStateRow) : null;
        }),
      releaseLeaseRow:
        options?.deps?.releaseLeaseRow ??
        (async (input) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase.rpc("release_job_runtime_lease", {
            target_runtime_key: runtimeKey,
            active_lease_owner: input.leaseOwner,
          });

          if (error) {
            throw new Error(`release_job_runtime_lease RPC failed: ${error.message}`);
          }

          return data ? (data as JobRuntimeStateRow) : null;
        }),
    };
  }

  public get runtimeKey(): string {
    return this.deps.runtimeKey;
  }

  public async loadSnapshot(): Promise<AiAgentJobRuntimeStateSnapshot> {
    return buildSnapshot(await this.deps.loadRow(), this.deps.now(), this.deps.runtimeKey);
  }

  public async touchRuntimeAppHeartbeat(): Promise<AiAgentJobRuntimeStateSnapshot | null> {
    const row = await this.deps.touchHeartbeatRow();
    return row ? buildSnapshot(row, this.deps.now(), this.deps.runtimeKey) : null;
  }

  public async setPaused(paused: boolean): Promise<AiAgentJobRuntimeStateSnapshot | null> {
    const row = await this.deps.setPausedRow({ paused });
    return row ? buildSnapshot(row, this.deps.now(), this.deps.runtimeKey) : null;
  }

  public async claimLease(input: {
    leaseOwner: string;
    leaseMs: number;
  }): Promise<AiAgentJobRuntimeLeaseClaimResult> {
    const now = this.deps.now();
    const claimedRow = await this.deps.claimLeaseRow(input);
    if (!claimedRow) {
      return {
        mode: "blocked",
        summary: "Jobs runtime lease is not currently available.",
        runtimeState: buildSnapshot(await this.deps.loadRow(), now, this.deps.runtimeKey),
      };
    }

    return {
      mode: "claimed",
      summary: `Jobs runtime lease claimed by ${input.leaseOwner}.`,
      runtimeState: buildSnapshot(claimedRow, now, this.deps.runtimeKey),
    };
  }

  public async heartbeatLease(input: {
    leaseOwner: string;
    leaseMs: number;
  }): Promise<AiAgentJobRuntimeLeaseHeartbeatResult> {
    const now = this.deps.now();
    const row = await this.deps.heartbeatLeaseRow(input);
    if (!row) {
      return {
        mode: "blocked",
        summary: `Jobs runtime lease heartbeat failed for ${input.leaseOwner}.`,
        runtimeState: buildSnapshot(await this.deps.loadRow(), now, this.deps.runtimeKey),
      };
    }

    return {
      mode: "heartbeated",
      summary: `Jobs runtime lease heartbeat persisted for ${input.leaseOwner}.`,
      runtimeState: buildSnapshot(row, now, this.deps.runtimeKey),
    };
  }

  public async releaseLease(input: {
    leaseOwner: string;
  }): Promise<AiAgentJobRuntimeLeaseReleaseResult> {
    const now = this.deps.now();
    const row = await this.deps.releaseLeaseRow(input);
    if (!row) {
      return {
        mode: "blocked",
        summary: `Jobs runtime lease release failed for ${input.leaseOwner}.`,
        runtimeState: buildSnapshot(await this.deps.loadRow(), now, this.deps.runtimeKey),
      };
    }

    return {
      mode: "released",
      summary: `Jobs runtime lease released by ${input.leaseOwner}.`,
      runtimeState: buildSnapshot(row, now, this.deps.runtimeKey),
    };
  }
}
