import { describe, expect, it, vi } from "vitest";
import { AiAgentOrchestratorLoopService } from "@/lib/ai/agent/orchestrator";

describe("AiAgentOrchestratorLoopService", () => {
  it("returns blocked when the runtime lease cannot be claimed", async () => {
    const executeOrchestratorOnce = vi.fn();
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
        executeOrchestratorOnce,
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
    expect(executeOrchestratorOnce).not.toHaveBeenCalled();
  });

  it("claims, heartbeats, executes, and releases a full orchestrator iteration", async () => {
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
        executeOrchestratorOnce: async () => ({
          mode: "executed",
          summary:
            "Injected 1 notification task, 1 public task, executed 1 text task, queued 0 media jobs, and skipped compression.",
          orchestratorResult: {
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
            executedTextTask: null,
            executedMediaTask: null,
            compressionResult: null,
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
