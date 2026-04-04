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
        runtime_app_seen_at: "2026-03-30T03:01:50.000Z",
        manual_phase_a_requested_at: null,
        manual_phase_a_requested_by: null,
        manual_phase_a_request_id: null,
        manual_phase_a_started_at: null,
        manual_phase_a_finished_at: null,
        manual_phase_a_error: null,
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
      runtimeAppSeenAt: "2026-03-30T03:01:50.000Z",
      runtimeAppOnline: true,
      manualPhaseARequestPending: false,
      lastStartedAt: "2026-03-30T03:00:00.000Z",
      lastFinishedAt: "2026-03-30T03:01:00.000Z",
    });
  });

  it("marks the runtime app offline when the heartbeat is stale", () => {
    const snapshot = buildAiAgentRuntimeStateSnapshot(
      {
        singleton_key: "global",
        paused: false,
        public_candidate_group_index: 2,
        public_candidate_epoch: 4,
        lease_owner: null,
        lease_until: null,
        cooldown_until: null,
        runtime_app_seen_at: "2026-03-30T03:00:00.000Z",
        manual_phase_a_requested_at: null,
        manual_phase_a_requested_by: null,
        manual_phase_a_request_id: null,
        manual_phase_a_started_at: null,
        manual_phase_a_finished_at: null,
        manual_phase_a_error: null,
        last_started_at: "2026-03-30T03:00:00.000Z",
        last_finished_at: "2026-03-30T03:01:00.000Z",
        updated_at: "2026-03-30T03:01:00.000Z",
      },
      new Date("2026-03-30T03:02:00.000Z"),
    );

    expect(snapshot).toMatchObject({
      available: true,
      runtimeAppSeenAt: "2026-03-30T03:00:00.000Z",
      runtimeAppOnline: false,
    });
  });

  it("persists a manual Phase A request instead of executing inline", async () => {
    const service = new AiAgentRuntimeStateService({
      deps: {
        persistManualPhaseARequest: async (input) => ({
          singleton_key: "global",
          paused: false,
          public_candidate_group_index: 0,
          public_candidate_epoch: 0,
          lease_owner: null,
          lease_until: null,
          cooldown_until: "2026-03-30T03:10:00.000Z",
          runtime_app_seen_at: "2026-03-30T03:04:30.000Z",
          manual_phase_a_requested_at: input.now.toISOString(),
          manual_phase_a_requested_by: input.requestedBy,
          manual_phase_a_request_id: input.requestId ?? "manual-request-1",
          manual_phase_a_started_at: null,
          manual_phase_a_finished_at: null,
          manual_phase_a_error: null,
          last_started_at: null,
          last_finished_at: "2026-03-30T03:00:00.000Z",
          updated_at: input.now.toISOString(),
        }),
        now: () => new Date("2026-03-30T03:05:00.000Z"),
      },
    });

    const snapshot = await service.requestManualPhaseA({
      requestedBy: "admin-user",
      requestId: "manual-request-1",
    });

    expect(snapshot).toMatchObject({
      available: true,
      statusLabel: "Manual Phase A Pending",
      manualPhaseARequestPending: true,
      manualPhaseARequestedBy: "admin-user",
      manualPhaseARequestId: "manual-request-1",
    });
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
          runtime_app_seen_at: "2026-03-30T03:05:30.000Z",
          manual_phase_a_requested_at: null,
          manual_phase_a_requested_by: null,
          manual_phase_a_request_id: null,
          manual_phase_a_started_at: null,
          manual_phase_a_finished_at: null,
          manual_phase_a_error: null,
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
          runtime_app_seen_at: "2026-03-30T03:04:30.000Z",
          manual_phase_a_requested_at: null,
          manual_phase_a_requested_by: null,
          manual_phase_a_request_id: null,
          manual_phase_a_started_at: null,
          manual_phase_a_finished_at: null,
          manual_phase_a_error: null,
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
          runtime_app_seen_at: "2026-03-30T03:05:00.000Z",
          manual_phase_a_requested_at: null,
          manual_phase_a_requested_by: null,
          manual_phase_a_request_id: null,
          manual_phase_a_started_at: null,
          manual_phase_a_finished_at: null,
          manual_phase_a_error: null,
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
          runtime_app_seen_at: "2026-03-30T03:05:30.000Z",
          manual_phase_a_requested_at: null,
          manual_phase_a_requested_by: null,
          manual_phase_a_request_id: null,
          manual_phase_a_started_at: null,
          manual_phase_a_finished_at: null,
          manual_phase_a_error: null,
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
          runtime_app_seen_at: "2026-03-30T03:06:00.000Z",
          manual_phase_a_requested_at: null,
          manual_phase_a_requested_by: null,
          manual_phase_a_request_id: null,
          manual_phase_a_started_at: null,
          manual_phase_a_finished_at: null,
          manual_phase_a_error: null,
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
          runtime_app_seen_at: "2026-03-30T03:02:30.000Z",
          manual_phase_a_requested_at: null,
          manual_phase_a_requested_by: null,
          manual_phase_a_request_id: null,
          manual_phase_a_started_at: null,
          manual_phase_a_finished_at: null,
          manual_phase_a_error: null,
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
      runtimeAppOnline: true,
    });
  });
});
