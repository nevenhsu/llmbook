import { describe, expect, it, vi } from "vitest";
import { AiAgentOrchestratorLoopService } from "@/lib/ai/agent/orchestrator";

describe("AiAgentOrchestratorLoopService", () => {
  it("returns blocked when the runtime lease cannot be claimed", async () => {
    const runOrchestratorPhase = vi.fn();
    const service = new AiAgentOrchestratorLoopService({
      deps: {
        claimLease: async () => ({
          mode: "blocked",
          reasonCode: "cooldown_active",
          summary: "Runtime cooldown is active until 2026-03-30T03:10:00.000Z.",
          runtimeState: {
            available: true,
            statusLabel: "Cooling Down",
            detail: "Runtime cooldown is active until 2026-03-30T03:10:00.000Z.",
            paused: false,
            leaseOwner: null,
            leaseUntil: null,
            cooldownUntil: "2026-03-30T03:10:00.000Z",
            lastStartedAt: "2026-03-30T03:00:00.000Z",
            lastFinishedAt: "2026-03-30T03:05:00.000Z",
          },
        }),
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
    expect(runOrchestratorPhase).not.toHaveBeenCalled();
  });

  it("claims, heartbeats, injects queue work, and releases a full orchestrator phase", async () => {
    const beginHeartbeatLoop = vi.fn(() => vi.fn());
    const service = new AiAgentOrchestratorLoopService({
      deps: {
        claimLease: async () => ({
          mode: "claimed",
          summary: "Runtime lease claimed by orchestrator:test.",
          runtimeState: {
            available: true,
            statusLabel: "Running",
            detail: "Runtime lease is held by orchestrator:test until 2026-03-30T03:06:00.000Z.",
            paused: false,
            leaseOwner: "orchestrator:test",
            leaseUntil: "2026-03-30T03:06:00.000Z",
            cooldownUntil: null,
            lastStartedAt: "2026-03-30T03:05:00.000Z",
            lastFinishedAt: null,
          },
        }),
        beginHeartbeatLoop,
        runOrchestratorPhase: async () => ({
          summary: "Injected 1 notification task and 1 public task for the next text-drain phase.",
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
          runtimeState: {
            available: true,
            statusLabel: "Cooling Down",
            detail: "Runtime cooldown is active until 2026-03-30T03:11:00.000Z.",
            paused: false,
            leaseOwner: null,
            leaseUntil: null,
            cooldownUntil: "2026-03-30T03:11:00.000Z",
            lastStartedAt: "2026-03-30T03:05:00.000Z",
            lastFinishedAt: "2026-03-30T03:06:00.000Z",
          },
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
  });
});
