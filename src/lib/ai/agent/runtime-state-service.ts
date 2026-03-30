import { loadAiAgentConfig } from "@/lib/ai/agent/config/agent-config";
import { createAdminClient } from "@/lib/supabase/admin";

export const ORCHESTRATOR_RUNTIME_SINGLETON_KEY = "global";

export type AiAgentRuntimeStateSnapshot = {
  available: boolean;
  statusLabel: string;
  detail: string;
  paused: boolean | null;
  leaseOwner: string | null;
  leaseUntil: string | null;
  cooldownUntil: string | null;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
};

export type OrchestratorRuntimeStateRow = {
  singleton_key: string;
  paused: boolean;
  lease_owner: string | null;
  lease_until: string | null;
  cooldown_until: string | null;
  last_started_at: string | null;
  last_finished_at: string | null;
  updated_at: string;
};

export type RuntimeStateAction = "pause" | "resume" | "run_cycle";

export type AiAgentRuntimeLeaseReasonCode =
  | "runtime_state_unavailable"
  | "runtime_paused"
  | "cooldown_active"
  | "lease_held_by_other"
  | "lease_not_owned";

export type AiAgentRuntimeLeaseInput = {
  leaseOwner: string;
  leaseMs: number;
};

export type AiAgentRuntimeLeaseClaimInput = AiAgentRuntimeLeaseInput & {
  allowDuringCooldown?: boolean;
};

export type AiAgentRuntimeLeaseReleaseInput = {
  leaseOwner: string;
  cooldownMinutes?: number | null;
};

export type AiAgentRuntimeLeaseBlockedResult = {
  mode: "blocked";
  reasonCode: AiAgentRuntimeLeaseReasonCode;
  summary: string;
  runtimeState: AiAgentRuntimeStateSnapshot;
};

export type AiAgentRuntimeLeaseClaimedResult = {
  mode: "claimed";
  summary: string;
  runtimeState: AiAgentRuntimeStateSnapshot;
};

export type AiAgentRuntimeLeaseHeartbeatedResult = {
  mode: "heartbeated";
  summary: string;
  runtimeState: AiAgentRuntimeStateSnapshot;
};

export type AiAgentRuntimeLeaseReleasedResult = {
  mode: "released";
  summary: string;
  runtimeState: AiAgentRuntimeStateSnapshot;
};

export type AiAgentRuntimeLeaseClaimResult =
  | AiAgentRuntimeLeaseBlockedResult
  | AiAgentRuntimeLeaseClaimedResult;

export type AiAgentRuntimeLeaseHeartbeatResult =
  | AiAgentRuntimeLeaseBlockedResult
  | AiAgentRuntimeLeaseHeartbeatedResult;

export type AiAgentRuntimeLeaseReleaseResult =
  | AiAgentRuntimeLeaseBlockedResult
  | AiAgentRuntimeLeaseReleasedResult;

type RuntimeStateServiceDeps = {
  loadRow: () => Promise<OrchestratorRuntimeStateRow | null>;
  loadCooldownMinutes: () => Promise<number>;
  persistAction: (
    action: RuntimeStateAction,
    input: { row: OrchestratorRuntimeStateRow; now: Date; cooldownMinutes: number },
  ) => Promise<OrchestratorRuntimeStateRow>;
  claimLeaseRow: (
    input: AiAgentRuntimeLeaseClaimInput,
  ) => Promise<OrchestratorRuntimeStateRow | null>;
  heartbeatLeaseRow: (
    input: AiAgentRuntimeLeaseInput,
  ) => Promise<OrchestratorRuntimeStateRow | null>;
  releaseLeaseRow: (
    input: AiAgentRuntimeLeaseReleaseInput,
  ) => Promise<OrchestratorRuntimeStateRow | null>;
  now: () => Date;
};

function normalizeIsoString(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return new Date(timestamp).toISOString();
}

function toLeaseSeconds(leaseMs: number): number {
  return Math.max(1, Math.ceil(leaseMs / 1000));
}

function buildLeaseBlockedResult(input: {
  row: OrchestratorRuntimeStateRow | null;
  now: Date;
  requestedLeaseOwner: string;
  allowDuringCooldown?: boolean;
  fallbackSummary: string;
  missingLeaseOwnedByRequesterSummary?: string;
}): AiAgentRuntimeLeaseBlockedResult {
  const runtimeState = buildAiAgentRuntimeStateSnapshot(input.row, input.now);

  if (!input.row) {
    return {
      mode: "blocked",
      reasonCode: "runtime_state_unavailable",
      summary: runtimeState.detail,
      runtimeState,
    };
  }

  if (input.row.paused) {
    return {
      mode: "blocked",
      reasonCode: "runtime_paused",
      summary: "Runtime is paused; resume it before the long-running orchestrator can proceed.",
      runtimeState,
    };
  }

  const leaseUntil = normalizeIsoString(input.row.lease_until);
  const cooldownUntil = normalizeIsoString(input.row.cooldown_until);
  const nowMs = input.now.getTime();
  const leaseActive = leaseUntil ? new Date(leaseUntil).getTime() > nowMs : false;
  const cooldownActive = cooldownUntil ? new Date(cooldownUntil).getTime() > nowMs : false;

  if (leaseActive && input.row.lease_owner && input.row.lease_owner !== input.requestedLeaseOwner) {
    return {
      mode: "blocked",
      reasonCode: "lease_held_by_other",
      summary: `Runtime lease is currently held by ${input.row.lease_owner} until ${leaseUntil}.`,
      runtimeState,
    };
  }

  if (!input.allowDuringCooldown && cooldownActive) {
    return {
      mode: "blocked",
      reasonCode: "cooldown_active",
      summary: `Runtime cooldown is active until ${cooldownUntil}.`,
      runtimeState,
    };
  }

  if (input.missingLeaseOwnedByRequesterSummary) {
    return {
      mode: "blocked",
      reasonCode: "lease_not_owned",
      summary: input.missingLeaseOwnedByRequesterSummary,
      runtimeState,
    };
  }

  return {
    mode: "blocked",
    reasonCode: "lease_held_by_other",
    summary: input.fallbackSummary,
    runtimeState,
  };
}

export function buildAiAgentRuntimeStateSnapshot(
  row: OrchestratorRuntimeStateRow | null,
  now = new Date(),
): AiAgentRuntimeStateSnapshot {
  if (!row) {
    return {
      available: false,
      statusLabel: "Unavailable",
      detail: "orchestrator_runtime_state row is missing.",
      paused: null,
      leaseOwner: null,
      leaseUntil: null,
      cooldownUntil: null,
      lastStartedAt: null,
      lastFinishedAt: null,
    };
  }

  const leaseUntil = normalizeIsoString(row.lease_until);
  const cooldownUntil = normalizeIsoString(row.cooldown_until);
  const nowMs = now.getTime();
  const leaseActive = leaseUntil ? new Date(leaseUntil).getTime() > nowMs : false;
  const cooldownActive = cooldownUntil ? new Date(cooldownUntil).getTime() > nowMs : false;

  let statusLabel = "Ready";
  let detail = "Runtime state row is available.";
  if (row.paused) {
    statusLabel = "Paused";
    detail = "Runtime paused by operator.";
  } else if (leaseActive) {
    statusLabel = "Running";
    detail = row.lease_owner
      ? `Runtime lease is held by ${row.lease_owner} until ${leaseUntil}.`
      : `Runtime lease is active until ${leaseUntil}.`;
  } else if (cooldownActive) {
    statusLabel = "Cooling Down";
    detail = `Runtime cooldown is active until ${cooldownUntil}.`;
  }

  return {
    available: true,
    statusLabel,
    detail,
    paused: row.paused,
    leaseOwner: row.lease_owner,
    leaseUntil,
    cooldownUntil,
    lastStartedAt: normalizeIsoString(row.last_started_at),
    lastFinishedAt: normalizeIsoString(row.last_finished_at),
  };
}

export class AiAgentRuntimeStateService {
  private readonly deps: RuntimeStateServiceDeps;

  public constructor(options?: { deps?: Partial<RuntimeStateServiceDeps> }) {
    this.deps = {
      loadRow:
        options?.deps?.loadRow ??
        (async () => {
          const supabase = createAdminClient();
          const { data, error } = await supabase
            .from("orchestrator_runtime_state")
            .select(
              "singleton_key, paused, lease_owner, lease_until, cooldown_until, last_started_at, last_finished_at, updated_at",
            )
            .eq("singleton_key", ORCHESTRATOR_RUNTIME_SINGLETON_KEY)
            .maybeSingle<OrchestratorRuntimeStateRow>();

          if (error) {
            throw new Error(`load orchestrator_runtime_state failed: ${error.message}`);
          }

          return data ?? null;
        }),
      loadCooldownMinutes:
        options?.deps?.loadCooldownMinutes ??
        (async () => (await loadAiAgentConfig()).values.orchestratorCooldownMinutes),
      persistAction:
        options?.deps?.persistAction ??
        (async (action, input) => {
          const supabase = createAdminClient();
          const { row, now, cooldownMinutes } = input;
          const nextCooldownAt =
            action === "run_cycle"
              ? new Date(now.getTime() + cooldownMinutes * 60_000).toISOString()
              : row.cooldown_until;
          const patch =
            action === "pause"
              ? {
                  paused: true,
                  lease_owner: null,
                  lease_until: null,
                  updated_at: now.toISOString(),
                }
              : action === "resume"
                ? {
                    paused: false,
                    updated_at: now.toISOString(),
                  }
                : {
                    paused: false,
                    lease_owner: "admin:run_cycle",
                    lease_until: now.toISOString(),
                    cooldown_until: nextCooldownAt,
                    last_started_at: now.toISOString(),
                    last_finished_at: now.toISOString(),
                    updated_at: now.toISOString(),
                  };

          const { data, error } = await supabase
            .from("orchestrator_runtime_state")
            .update(patch)
            .eq("singleton_key", row.singleton_key)
            .select(
              "singleton_key, paused, lease_owner, lease_until, cooldown_until, last_started_at, last_finished_at, updated_at",
            )
            .single<OrchestratorRuntimeStateRow>();

          if (error) {
            throw new Error(`persist orchestrator_runtime_state failed: ${error.message}`);
          }

          return data;
        }),
      claimLeaseRow:
        options?.deps?.claimLeaseRow ??
        (async (input) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase.rpc("claim_orchestrator_runtime_lease", {
            next_lease_owner: input.leaseOwner,
            lease_duration_seconds: toLeaseSeconds(input.leaseMs),
            allow_during_cooldown: input.allowDuringCooldown ?? false,
          });

          if (error) {
            throw new Error(`claim_orchestrator_runtime_lease RPC failed: ${error.message}`);
          }

          return data ? (data as OrchestratorRuntimeStateRow) : null;
        }),
      heartbeatLeaseRow:
        options?.deps?.heartbeatLeaseRow ??
        (async (input) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase.rpc("heartbeat_orchestrator_runtime_lease", {
            active_lease_owner: input.leaseOwner,
            lease_duration_seconds: toLeaseSeconds(input.leaseMs),
          });

          if (error) {
            throw new Error(`heartbeat_orchestrator_runtime_lease RPC failed: ${error.message}`);
          }

          return data ? (data as OrchestratorRuntimeStateRow) : null;
        }),
      releaseLeaseRow:
        options?.deps?.releaseLeaseRow ??
        (async (input) => {
          const supabase = createAdminClient();
          const { data, error } = await supabase.rpc("release_orchestrator_runtime_lease", {
            active_lease_owner: input.leaseOwner,
            cooldown_minutes: input.cooldownMinutes ?? null,
          });

          if (error) {
            throw new Error(`release_orchestrator_runtime_lease RPC failed: ${error.message}`);
          }

          return data ? (data as OrchestratorRuntimeStateRow) : null;
        }),
      now: options?.deps?.now ?? (() => new Date()),
    };
  }

  public async loadSnapshot(): Promise<AiAgentRuntimeStateSnapshot> {
    return buildAiAgentRuntimeStateSnapshot(await this.deps.loadRow(), this.deps.now());
  }

  public async executeAction(
    action: RuntimeStateAction,
  ): Promise<AiAgentRuntimeStateSnapshot | null> {
    const row = await this.deps.loadRow();
    if (!row) {
      return null;
    }

    const updatedRow = await this.deps.persistAction(action, {
      row,
      now: this.deps.now(),
      cooldownMinutes: await this.deps.loadCooldownMinutes(),
    });
    return buildAiAgentRuntimeStateSnapshot(updatedRow, this.deps.now());
  }

  public async claimLease(
    input: AiAgentRuntimeLeaseClaimInput,
  ): Promise<AiAgentRuntimeLeaseClaimResult> {
    const now = this.deps.now();
    const currentRow = await this.deps.loadRow();
    if (!currentRow) {
      return buildLeaseBlockedResult({
        row: null,
        now,
        requestedLeaseOwner: input.leaseOwner,
        allowDuringCooldown: input.allowDuringCooldown,
        fallbackSummary: "orchestrator_runtime_state row is missing.",
      });
    }

    const leaseUntil = normalizeIsoString(currentRow.lease_until);
    const cooldownUntil = normalizeIsoString(currentRow.cooldown_until);
    const leaseActive = leaseUntil ? new Date(leaseUntil).getTime() > now.getTime() : false;
    const cooldownActive = cooldownUntil
      ? new Date(cooldownUntil).getTime() > now.getTime()
      : false;

    if (
      currentRow.paused ||
      (leaseActive &&
        currentRow.lease_owner !== null &&
        currentRow.lease_owner !== input.leaseOwner) ||
      (!(input.allowDuringCooldown ?? false) && cooldownActive)
    ) {
      return buildLeaseBlockedResult({
        row: currentRow,
        now,
        requestedLeaseOwner: input.leaseOwner,
        allowDuringCooldown: input.allowDuringCooldown,
        fallbackSummary: "Runtime lease is not currently available.",
      });
    }

    const claimedRow = await this.deps.claimLeaseRow(input);
    if (!claimedRow) {
      return buildLeaseBlockedResult({
        row: await this.deps.loadRow(),
        now,
        requestedLeaseOwner: input.leaseOwner,
        allowDuringCooldown: input.allowDuringCooldown,
        fallbackSummary: "Runtime lease claim was lost to another runner.",
      });
    }

    return {
      mode: "claimed",
      summary: `Runtime lease claimed by ${input.leaseOwner}.`,
      runtimeState: buildAiAgentRuntimeStateSnapshot(claimedRow, now),
    };
  }

  public async heartbeatLease(
    input: AiAgentRuntimeLeaseInput,
  ): Promise<AiAgentRuntimeLeaseHeartbeatResult> {
    const now = this.deps.now();
    const heartbeatedRow = await this.deps.heartbeatLeaseRow(input);
    if (!heartbeatedRow) {
      return buildLeaseBlockedResult({
        row: await this.deps.loadRow(),
        now,
        requestedLeaseOwner: input.leaseOwner,
        fallbackSummary: `Runtime lease heartbeat failed for ${input.leaseOwner}.`,
        missingLeaseOwnedByRequesterSummary:
          "Runtime lease heartbeat requires an active lease owned by this orchestrator runner.",
      });
    }

    return {
      mode: "heartbeated",
      summary: `Runtime lease heartbeat persisted for ${input.leaseOwner}.`,
      runtimeState: buildAiAgentRuntimeStateSnapshot(heartbeatedRow, now),
    };
  }

  public async releaseLease(
    input: AiAgentRuntimeLeaseReleaseInput,
  ): Promise<AiAgentRuntimeLeaseReleaseResult> {
    const now = this.deps.now();
    const cooldownMinutes =
      typeof input.cooldownMinutes === "number"
        ? input.cooldownMinutes
        : input.cooldownMinutes === null
          ? null
          : await this.deps.loadCooldownMinutes();
    const releasedRow = await this.deps.releaseLeaseRow({
      leaseOwner: input.leaseOwner,
      cooldownMinutes,
    });

    if (!releasedRow) {
      return buildLeaseBlockedResult({
        row: await this.deps.loadRow(),
        now,
        requestedLeaseOwner: input.leaseOwner,
        fallbackSummary: `Runtime lease release failed for ${input.leaseOwner}.`,
        missingLeaseOwnedByRequesterSummary:
          "Runtime lease release requires the current orchestrator runner to own the lease.",
      });
    }

    return {
      mode: "released",
      summary:
        cooldownMinutes === null
          ? `Runtime lease released by ${input.leaseOwner}.`
          : `Runtime lease released by ${input.leaseOwner} and cooldown was persisted.`,
      runtimeState: buildAiAgentRuntimeStateSnapshot(releasedRow, now),
    };
  }
}
