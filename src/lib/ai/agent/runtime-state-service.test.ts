import { describe, expect, it, vi } from "vitest";
import {
  AiAgentRuntimeStateService,
  buildAiAgentRuntimeStateSnapshot,
} from "@/lib/ai/agent/runtime-state-service";

describe("runtime-state-service", () => {
  it("builds a ready snapshot from an available singleton row", () => {
    const snapshot = buildAiAgentRuntimeStateSnapshot(
      {
        singleton_key: "global",
        paused: false,
        public_candidate_group_index: 2,
        public_candidate_epoch: 4,
        lease_owner: null,
        lease_until: null,
        cooldown_until: null,
        last_started_at: "2026-03-30T03:00:00.000Z",
        last_finished_at: "2026-03-30T03:01:00.000Z",
        updated_at: "2026-03-30T03:01:00.000Z",
      },
      new Date("2026-03-30T03:02:00.000Z"),
    );

    expect(snapshot).toMatchObject({
      available: true,
      statusLabel: "Ready",
      paused: false,
      publicCandidateGroupIndex: 2,
      publicCandidateEpoch: 4,
      lastStartedAt: "2026-03-30T03:00:00.000Z",
      lastFinishedAt: "2026-03-30T03:01:00.000Z",
    });
  });

  it("persists a run_cycle transition with cooldown from config", async () => {
    const persistedRows: Array<Record<string, unknown>> = [];
    const service = new AiAgentRuntimeStateService({
      deps: {
        loadRow: async () => ({
          singleton_key: "global",
          paused: false,
          public_candidate_group_index: 0,
          public_candidate_epoch: 0,
          lease_owner: null,
          lease_until: null,
          cooldown_until: null,
          last_started_at: null,
          last_finished_at: null,
          updated_at: "2026-03-30T03:00:00.000Z",
        }),
        loadCooldownMinutes: async () => 5,
        persistAction: async (_action, input) => {
          persistedRows.push({
            action: _action,
            now: input.now.toISOString(),
            cooldownMinutes: input.cooldownMinutes,
          });
          return {
            singleton_key: "global",
            paused: false,
            public_candidate_group_index: 0,
            public_candidate_epoch: 0,
            lease_owner: "admin:run_cycle",
            lease_until: input.now.toISOString(),
            cooldown_until: new Date(input.now.getTime() + 5 * 60_000).toISOString(),
            last_started_at: input.now.toISOString(),
            last_finished_at: input.now.toISOString(),
            updated_at: input.now.toISOString(),
          };
        },
        now: () => new Date("2026-03-30T03:05:00.000Z"),
      },
    });

    const snapshot = await service.executeAction("run_cycle");

    expect(snapshot).toMatchObject({
      available: true,
      statusLabel: "Cooling Down",
      cooldownUntil: "2026-03-30T03:10:00.000Z",
      lastStartedAt: "2026-03-30T03:05:00.000Z",
    });
    expect(persistedRows).toEqual([
      {
        action: "run_cycle",
        now: "2026-03-30T03:05:00.000Z",
        cooldownMinutes: 5,
      },
    ]);
  });

  it("blocks lease claim early while cooldown is still active", async () => {
    const claimLeaseRow = vi.fn();
    const service = new AiAgentRuntimeStateService({
      deps: {
        loadRow: async () => ({
          singleton_key: "global",
          paused: false,
          public_candidate_group_index: 3,
          public_candidate_epoch: 1,
          lease_owner: null,
          lease_until: null,
          cooldown_until: "2026-03-30T03:10:00.000Z",
          last_started_at: "2026-03-30T03:00:00.000Z",
          last_finished_at: "2026-03-30T03:05:00.000Z",
          updated_at: "2026-03-30T03:05:00.000Z",
        }),
        claimLeaseRow,
        now: () => new Date("2026-03-30T03:06:00.000Z"),
      },
    });

    await expect(
      service.claimLease({
        leaseOwner: "orchestrator:test",
        leaseMs: 60_000,
      }),
    ).resolves.toMatchObject({
      mode: "blocked",
      reasonCode: "cooldown_active",
    });
    expect(claimLeaseRow).not.toHaveBeenCalled();
  });

  it("claims, heartbeats, and releases the runtime lease through shared helpers", async () => {
    const service = new AiAgentRuntimeStateService({
      deps: {
        loadRow: async () => ({
          singleton_key: "global",
          paused: false,
          public_candidate_group_index: 1,
          public_candidate_epoch: 2,
          lease_owner: null,
          lease_until: null,
          cooldown_until: null,
          last_started_at: null,
          last_finished_at: null,
          updated_at: "2026-03-30T03:00:00.000Z",
        }),
        claimLeaseRow: async () => ({
          singleton_key: "global",
          paused: false,
          public_candidate_group_index: 1,
          public_candidate_epoch: 2,
          lease_owner: "orchestrator:test",
          lease_until: "2026-03-30T03:07:00.000Z",
          cooldown_until: null,
          last_started_at: "2026-03-30T03:05:00.000Z",
          last_finished_at: null,
          updated_at: "2026-03-30T03:05:00.000Z",
        }),
        heartbeatLeaseRow: async () => ({
          singleton_key: "global",
          paused: false,
          public_candidate_group_index: 1,
          public_candidate_epoch: 2,
          lease_owner: "orchestrator:test",
          lease_until: "2026-03-30T03:06:30.000Z",
          cooldown_until: null,
          last_started_at: "2026-03-30T03:05:00.000Z",
          last_finished_at: null,
          updated_at: "2026-03-30T03:05:30.000Z",
        }),
        releaseLeaseRow: async () => ({
          singleton_key: "global",
          paused: false,
          public_candidate_group_index: 1,
          public_candidate_epoch: 2,
          lease_owner: null,
          lease_until: null,
          cooldown_until: "2026-03-30T03:11:00.000Z",
          last_started_at: "2026-03-30T03:05:00.000Z",
          last_finished_at: "2026-03-30T03:06:00.000Z",
          updated_at: "2026-03-30T03:06:00.000Z",
        }),
        loadCooldownMinutes: async () => 5,
        now: () => new Date("2026-03-30T03:06:00.000Z"),
      },
    });

    await expect(
      service.claimLease({
        leaseOwner: "orchestrator:test",
        leaseMs: 60_000,
      }),
    ).resolves.toMatchObject({
      mode: "claimed",
      runtimeState: {
        statusLabel: "Running",
        leaseOwner: "orchestrator:test",
      },
    });

    await expect(
      service.heartbeatLease({
        leaseOwner: "orchestrator:test",
        leaseMs: 60_000,
      }),
    ).resolves.toMatchObject({
      mode: "heartbeated",
      runtimeState: {
        leaseUntil: "2026-03-30T03:06:30.000Z",
      },
    });

    await expect(
      service.releaseLease({
        leaseOwner: "orchestrator:test",
      }),
    ).resolves.toMatchObject({
      mode: "released",
      runtimeState: {
        statusLabel: "Cooling Down",
        cooldownUntil: "2026-03-30T03:11:00.000Z",
      },
    });
  });

  it("includes public candidate rotation fields in the snapshot", async () => {
    const service = new AiAgentRuntimeStateService({
      deps: {
        loadRow: async () => ({
          singleton_key: "global",
          paused: false,
          public_candidate_group_index: 5,
          public_candidate_epoch: 9,
          lease_owner: null,
          lease_until: null,
          cooldown_until: null,
          last_started_at: "2026-03-30T03:00:00.000Z",
          last_finished_at: "2026-03-30T03:01:00.000Z",
          updated_at: "2026-03-30T03:02:00.000Z",
        }),
        now: () => new Date("2026-03-30T03:03:00.000Z"),
      },
    });

    await expect(service.loadSnapshot()).resolves.toMatchObject({
      publicCandidateGroupIndex: 5,
      publicCandidateEpoch: 9,
    });
  });
});
