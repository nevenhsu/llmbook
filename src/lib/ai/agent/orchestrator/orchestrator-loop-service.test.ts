import { describe, expect, it, vi } from "vitest";
import { AiAgentOrchestratorLoopService } from "@/lib/ai/agent/orchestrator";

function withManualFields<T extends Record<string, unknown>>(input: T) {
  return {
    manualPhaseARequestPending: false,
    manualPhaseARequestedAt: null,
    manualPhaseARequestedBy: null,
    manualPhaseARequestId: null,
    manualPhaseAStartedAt: null,
    manualPhaseAFinishedAt: null,
    manualPhaseAError: null,
    ...input,
  };
}

describe("AiAgentOrchestratorLoopService", () => {
  it("touches the runtime app heartbeat even when an iteration is blocked", async () => {
    const touchRuntimeAppHeartbeat = vi.fn();
    const service = new AiAgentOrchestratorLoopService({
      deps: {
        touchRuntimeAppHeartbeat,
        loadRuntimeState: async () =>
          withManualFields({
            available: true,
            statusLabel: "Cooling Down",
            detail: "Runtime cooldown is active until 2026-03-30T03:10:00.000Z.",
            paused: false,
            publicCandidateGroupIndex: 0,
            publicCandidateEpoch: 0,
            leaseOwner: null,
            leaseUntil: null,
            cooldownUntil: "2026-03-30T03:10:00.000Z",
            runtimeAppSeenAt: "2026-03-30T03:05:00.000Z",
            runtimeAppOnline: true,
            lastStartedAt: "2026-03-30T03:00:00.000Z",
            lastFinishedAt: "2026-03-30T03:05:00.000Z",
          }),
        claimLease: async () => ({
          mode: "blocked",
          reasonCode: "cooldown_active",
          summary: "Runtime cooldown is active until 2026-03-30T03:10:00.000Z.",
          runtimeState: withManualFields({
            available: true,
            statusLabel: "Cooling Down",
            detail: "Runtime cooldown is active until 2026-03-30T03:10:00.000Z.",
            paused: false,
            publicCandidateGroupIndex: 0,
            publicCandidateEpoch: 0,
            leaseOwner: null,
            leaseUntil: null,
            cooldownUntil: "2026-03-30T03:10:00.000Z",
            runtimeAppSeenAt: "2026-03-30T03:05:00.000Z",
            runtimeAppOnline: true,
            lastStartedAt: "2026-03-30T03:00:00.000Z",
            lastFinishedAt: "2026-03-30T03:05:00.000Z",
          }),
        }),
      },
    });

    await service.runSingleIteration({
      leaseOwner: "orchestrator:test",
      leaseMs: 60_000,
      heartbeatMs: 15_000,
    });

    expect(touchRuntimeAppHeartbeat).toHaveBeenCalledTimes(1);
  });

  it("returns blocked when the runtime lease cannot be claimed", async () => {
    const runOrchestratorPhase = vi.fn();
    const claimLease = vi.fn().mockResolvedValue({
      mode: "blocked",
      reasonCode: "cooldown_active",
      summary: "Runtime cooldown is active until 2026-03-30T03:10:00.000Z.",
      runtimeState: withManualFields({
        available: true,
        statusLabel: "Cooling Down",
        detail: "Runtime cooldown is active until 2026-03-30T03:10:00.000Z.",
        paused: false,
        publicCandidateGroupIndex: 0,
        publicCandidateEpoch: 0,
        leaseOwner: null,
        leaseUntil: null,
        cooldownUntil: "2026-03-30T03:10:00.000Z",
        runtimeAppSeenAt: "2026-03-30T03:05:00.000Z",
        runtimeAppOnline: true,
        lastStartedAt: "2026-03-30T03:00:00.000Z",
        lastFinishedAt: "2026-03-30T03:05:00.000Z",
      }),
    });
    const service = new AiAgentOrchestratorLoopService({
      deps: {
        touchRuntimeAppHeartbeat: async () => {},
        loadRuntimeState: async () =>
          withManualFields({
            available: true,
            statusLabel: "Cooling Down",
            detail: "Runtime cooldown is active until 2026-03-30T03:10:00.000Z.",
            paused: false,
            publicCandidateGroupIndex: 0,
            publicCandidateEpoch: 0,
            leaseOwner: null,
            leaseUntil: null,
            cooldownUntil: "2026-03-30T03:10:00.000Z",
            runtimeAppSeenAt: "2026-03-30T03:05:00.000Z",
            runtimeAppOnline: true,
            lastStartedAt: "2026-03-30T03:00:00.000Z",
            lastFinishedAt: "2026-03-30T03:05:00.000Z",
          }),
        claimLease,
        runOrchestratorPhase,
      },
    });

    await expect(
      service.runSingleIteration({
        leaseOwner: "orchestrator:test",
        leaseMs: 60_000,
        heartbeatMs: 15_000,
      }),
    ).resolves.toMatchObject({
      mode: "blocked",
      reasonCode: "cooldown_active",
    });
    expect(claimLease).toHaveBeenCalledWith({
      leaseOwner: "orchestrator:test",
      leaseMs: 60_000,
      heartbeatMs: 15_000,
      allowDuringCooldown: false,
    });
    expect(runOrchestratorPhase).not.toHaveBeenCalled();
  });

  it("prioritizes a pending manual Phase A request, bypasses cooldown, and clears it after success", async () => {
    const beginHeartbeatLoop = vi.fn(() => vi.fn());
    const markManualPhaseAStarted = vi.fn().mockResolvedValue(
      withManualFields({
        available: true,
        statusLabel: "Running",
        detail: "Runtime lease is held by orchestrator:test until 2026-03-30T03:06:00.000Z.",
        paused: false,
        publicCandidateGroupIndex: 0,
        publicCandidateEpoch: 0,
        leaseOwner: "orchestrator:test",
        leaseUntil: "2026-03-30T03:06:00.000Z",
        cooldownUntil: "2026-03-30T03:11:00.000Z",
        runtimeAppSeenAt: "2026-03-30T03:05:00.000Z",
        runtimeAppOnline: true,
        manualPhaseARequestPending: true,
        manualPhaseARequestedAt: "2026-03-30T03:04:00.000Z",
        manualPhaseARequestedBy: "admin-user",
        manualPhaseARequestId: "manual-request-1",
        manualPhaseAStartedAt: "2026-03-30T03:05:00.000Z",
        lastStartedAt: "2026-03-30T03:05:00.000Z",
        lastFinishedAt: null,
      }),
    );
    const completeManualPhaseA = vi.fn().mockResolvedValue(
      withManualFields({
        available: true,
        statusLabel: "Cooling Down",
        detail: "Runtime cooldown is active until 2026-03-30T03:11:00.000Z.",
        paused: false,
        publicCandidateGroupIndex: 0,
        publicCandidateEpoch: 0,
        leaseOwner: null,
        leaseUntil: null,
        cooldownUntil: "2026-03-30T03:11:00.000Z",
        runtimeAppSeenAt: "2026-03-30T03:06:00.000Z",
        runtimeAppOnline: true,
        manualPhaseAFinishedAt: "2026-03-30T03:06:00.000Z",
        lastStartedAt: "2026-03-30T03:05:00.000Z",
        lastFinishedAt: "2026-03-30T03:06:00.000Z",
      }),
    );
    const claimLease = vi.fn().mockResolvedValue({
      mode: "claimed",
      summary: "Runtime lease claimed by orchestrator:test.",
      runtimeState: withManualFields({
        available: true,
        statusLabel: "Running",
        detail: "Runtime lease is held by orchestrator:test until 2026-03-30T03:06:00.000Z.",
        paused: false,
        publicCandidateGroupIndex: 0,
        publicCandidateEpoch: 0,
        leaseOwner: "orchestrator:test",
        leaseUntil: "2026-03-30T03:06:00.000Z",
        cooldownUntil: null,
        runtimeAppSeenAt: "2026-03-30T03:05:00.000Z",
        runtimeAppOnline: true,
        manualPhaseARequestPending: true,
        manualPhaseARequestedAt: "2026-03-30T03:04:00.000Z",
        manualPhaseARequestedBy: "admin-user",
        manualPhaseARequestId: "manual-request-1",
        lastStartedAt: "2026-03-30T03:05:00.000Z",
        lastFinishedAt: null,
      }),
    });
    const service = new AiAgentOrchestratorLoopService({
      deps: {
        touchRuntimeAppHeartbeat: async () => {},
        loadRuntimeState: async () =>
          withManualFields({
            available: true,
            statusLabel: "Manual Phase A Pending",
            detail: "Manual Phase A request is pending from admin-user.",
            paused: false,
            publicCandidateGroupIndex: 0,
            publicCandidateEpoch: 0,
            leaseOwner: null,
            leaseUntil: null,
            cooldownUntil: "2026-03-30T03:10:00.000Z",
            runtimeAppSeenAt: "2026-03-30T03:04:55.000Z",
            runtimeAppOnline: true,
            manualPhaseARequestPending: true,
            manualPhaseARequestedAt: "2026-03-30T03:04:00.000Z",
            manualPhaseARequestedBy: "admin-user",
            manualPhaseARequestId: "manual-request-1",
            lastStartedAt: "2026-03-30T03:00:00.000Z",
            lastFinishedAt: "2026-03-30T03:04:00.000Z",
          }),
        claimLease,
        markManualPhaseAStarted,
        completeManualPhaseA,
        beginHeartbeatLoop,
        runOrchestratorPhase: async () => ({
          summary: "Injected 1 public task and 1 notification task for the next text-drain phase.",
          injectedNotificationTasks: 1,
          injectedPublicTasks: 1,
          notificationInjection: {
            mode: "executed",
            kind: "notification",
            message: "notification",
            injectionPreview: null as any,
            insertedTasks: [],
          },
          publicInjection: {
            mode: "executed",
            kind: "public",
            message: "public",
            injectionPreview: null as any,
            insertedTasks: [],
          },
        }),
        releaseLease: async () => ({
          mode: "released",
          summary: "Runtime lease released by orchestrator:test and cooldown was persisted.",
          runtimeState: withManualFields({
            available: true,
            statusLabel: "Cooling Down",
            detail: "Runtime cooldown is active until 2026-03-30T03:11:00.000Z.",
            paused: false,
            publicCandidateGroupIndex: 0,
            publicCandidateEpoch: 0,
            leaseOwner: null,
            leaseUntil: null,
            cooldownUntil: "2026-03-30T03:11:00.000Z",
            runtimeAppSeenAt: "2026-03-30T03:06:00.000Z",
            runtimeAppOnline: true,
            lastStartedAt: "2026-03-30T03:05:00.000Z",
            lastFinishedAt: "2026-03-30T03:06:00.000Z",
          }),
        }),
      },
    });

    await expect(
      service.runSingleIteration({
        leaseOwner: "orchestrator:test",
        leaseMs: 60_000,
        heartbeatMs: 15_000,
      }),
    ).resolves.toMatchObject({
      mode: "executed",
      runtimeState: {
        statusLabel: "Cooling Down",
      },
      orchestratorResult: {
        injectedNotificationTasks: 1,
        injectedPublicTasks: 1,
      },
    });
    expect(beginHeartbeatLoop).toHaveBeenCalledWith({
      leaseOwner: "orchestrator:test",
      leaseMs: 60_000,
      heartbeatMs: 15_000,
    });
    expect(claimLease).toHaveBeenCalledWith({
      leaseOwner: "orchestrator:test",
      leaseMs: 60_000,
      heartbeatMs: 15_000,
      allowDuringCooldown: true,
    });
    expect(markManualPhaseAStarted).toHaveBeenCalledWith("manual-request-1");
    expect(completeManualPhaseA).toHaveBeenCalledWith("manual-request-1");
  });

  it("does not reset cooldown when a manual Phase A request completes", async () => {
    const releaseLease = vi.fn().mockResolvedValue({
      mode: "released",
      summary: "Runtime lease released by orchestrator:test without changing cooldown.",
      runtimeState: withManualFields({
        available: true,
        statusLabel: "Ready",
        detail: "Runtime state row is available.",
        paused: false,
        publicCandidateGroupIndex: 0,
        publicCandidateEpoch: 0,
        leaseOwner: null,
        leaseUntil: null,
        cooldownUntil: "2026-03-30T03:10:00.000Z",
        runtimeAppSeenAt: "2026-03-30T03:06:00.000Z",
        runtimeAppOnline: true,
        lastStartedAt: "2026-03-30T03:05:00.000Z",
        lastFinishedAt: "2026-03-30T03:06:00.000Z",
      }),
    });
    const service = new AiAgentOrchestratorLoopService({
      deps: {
        touchRuntimeAppHeartbeat: async () => {},
        loadRuntimeState: async () =>
          withManualFields({
            available: true,
            statusLabel: "Manual Phase A Pending",
            detail: "Manual Phase A request is pending from admin-user.",
            paused: false,
            publicCandidateGroupIndex: 0,
            publicCandidateEpoch: 0,
            leaseOwner: null,
            leaseUntil: null,
            cooldownUntil: "2026-03-30T03:10:00.000Z",
            runtimeAppSeenAt: "2026-03-30T03:04:55.000Z",
            runtimeAppOnline: true,
            manualPhaseARequestPending: true,
            manualPhaseARequestedAt: "2026-03-30T03:04:00.000Z",
            manualPhaseARequestedBy: "admin-user",
            manualPhaseARequestId: "manual-request-1",
            lastStartedAt: "2026-03-30T03:00:00.000Z",
            lastFinishedAt: "2026-03-30T03:04:00.000Z",
          }),
        claimLease: async () => ({
          mode: "claimed",
          summary: "Runtime lease claimed by orchestrator:test.",
          runtimeState: withManualFields({
            available: true,
            statusLabel: "Running",
            detail: "Runtime lease is held by orchestrator:test until 2026-03-30T03:06:00.000Z.",
            paused: false,
            publicCandidateGroupIndex: 0,
            publicCandidateEpoch: 0,
            leaseOwner: "orchestrator:test",
            leaseUntil: "2026-03-30T03:06:00.000Z",
            cooldownUntil: "2026-03-30T03:10:00.000Z",
            runtimeAppSeenAt: "2026-03-30T03:05:00.000Z",
            runtimeAppOnline: true,
            manualPhaseARequestPending: true,
            manualPhaseARequestedAt: "2026-03-30T03:04:00.000Z",
            manualPhaseARequestedBy: "admin-user",
            manualPhaseARequestId: "manual-request-1",
            lastStartedAt: "2026-03-30T03:05:00.000Z",
            lastFinishedAt: null,
          }),
        }),
        markManualPhaseAStarted: async () => null,
        completeManualPhaseA: async () => null,
        beginHeartbeatLoop: () => () => {},
        runOrchestratorPhase: async () => ({
          summary: "Phase A completed.",
          injectedNotificationTasks: 0,
          injectedPublicTasks: 0,
          notificationInjection: {
            mode: "executed",
            kind: "notification",
            message: "notification",
            injectionPreview: null as any,
            insertedTasks: [],
          },
          publicInjection: {
            mode: "executed",
            kind: "public",
            message: "public",
            injectionPreview: null as any,
            insertedTasks: [],
          },
        }),
        releaseLease,
      },
    });

    await service.runSingleIteration({
      leaseOwner: "orchestrator:test",
      leaseMs: 60_000,
      heartbeatMs: 15_000,
    });

    expect(releaseLease).toHaveBeenCalledWith({
      leaseOwner: "orchestrator:test",
      cooldownMinutes: null,
    });
  });
});
