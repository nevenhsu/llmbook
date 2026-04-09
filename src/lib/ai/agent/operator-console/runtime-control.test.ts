import { describe, expect, it, vi } from "vitest";
import { AiAgentOperatorRuntimeControlService } from "@/lib/ai/agent/operator-console/runtime-control";
import { AiAgentJobsRuntimeControlService } from "@/lib/ai/agent/operator-console/jobs-runtime-control";

describe("AiAgentOperatorRuntimeControlService", () => {
  it("blocks Start when the main runtime is already running", async () => {
    const service = new AiAgentOperatorRuntimeControlService({
      deps: {
        loadRuntimeState: vi.fn().mockResolvedValue({
          available: true,
          statusLabel: "Ready",
          detail: "Runtime is available.",
          paused: false,
          publicCandidateGroupIndex: null,
          publicCandidateEpoch: null,
          leaseOwner: null,
          leaseUntil: null,
          cooldownUntil: null,
          runtimeAppSeenAt: "2026-04-08T11:00:00.000Z",
          runtimeAppOnline: true,
          manualPhaseARequestPending: false,
          manualPhaseARequestedAt: null,
          manualPhaseARequestedBy: null,
          manualPhaseARequestId: null,
          manualPhaseAStartedAt: null,
          manualPhaseAFinishedAt: null,
          manualPhaseAError: null,
          lastStartedAt: null,
          lastFinishedAt: null,
        }),
        pauseRuntime: vi.fn(),
        resumeRuntime: vi.fn(),
        requestManualPhaseA: vi.fn(),
        now: vi.fn().mockReturnValue(Date.now()),
      },
    });

    const result = await service.execute("start", { requestedBy: "admin-user" });

    expect(result.mode).toBe("blocked_execute");
    expect(result.summary).toContain("already running");
  });

  it("resumes and requests manual phase A when Start is allowed", async () => {
    const resumeRuntime = vi.fn().mockResolvedValue({
      available: true,
      statusLabel: "Ready",
      detail: "Runtime is available.",
      paused: false,
      publicCandidateGroupIndex: null,
      publicCandidateEpoch: null,
      leaseOwner: null,
      leaseUntil: null,
      cooldownUntil: null,
      runtimeAppSeenAt: "2026-04-08T11:00:00.000Z",
      runtimeAppOnline: true,
      manualPhaseARequestPending: false,
      manualPhaseARequestedAt: null,
      manualPhaseARequestedBy: null,
      manualPhaseARequestId: null,
      manualPhaseAStartedAt: null,
      manualPhaseAFinishedAt: null,
      manualPhaseAError: null,
      lastStartedAt: null,
      lastFinishedAt: null,
    });
    const requestManualPhaseA = vi.fn().mockResolvedValue({
      available: true,
      statusLabel: "Ready",
      detail: "Runtime is available.",
      paused: false,
      publicCandidateGroupIndex: null,
      publicCandidateEpoch: null,
      leaseOwner: null,
      leaseUntil: null,
      cooldownUntil: null,
      runtimeAppSeenAt: "2026-04-08T11:00:00.000Z",
      runtimeAppOnline: true,
      manualPhaseARequestPending: true,
      manualPhaseARequestedAt: "2026-04-08T12:00:00.000Z",
      manualPhaseARequestedBy: "admin-user",
      manualPhaseARequestId: "request-1",
      manualPhaseAStartedAt: null,
      manualPhaseAFinishedAt: null,
      manualPhaseAError: null,
      lastStartedAt: null,
      lastFinishedAt: null,
    });

    const service = new AiAgentOperatorRuntimeControlService({
      deps: {
        loadRuntimeState: vi.fn().mockResolvedValue({
          available: true,
          statusLabel: "Paused",
          detail: "Runtime is paused.",
          paused: true,
          publicCandidateGroupIndex: null,
          publicCandidateEpoch: null,
          leaseOwner: null,
          leaseUntil: null,
          cooldownUntil: null,
          runtimeAppSeenAt: "2026-04-08T11:00:00.000Z",
          runtimeAppOnline: true,
          manualPhaseARequestPending: false,
          manualPhaseARequestedAt: null,
          manualPhaseARequestedBy: null,
          manualPhaseARequestId: null,
          manualPhaseAStartedAt: null,
          manualPhaseAFinishedAt: null,
          manualPhaseAError: null,
          lastStartedAt: null,
          lastFinishedAt: null,
        }),
        pauseRuntime: vi.fn(),
        resumeRuntime,
        requestManualPhaseA,
        now: vi.fn().mockReturnValue(Date.now()),
      },
    });

    const result = await service.execute("start", { requestedBy: "admin-user" });

    expect(result.mode).toBe("executed");
    expect(resumeRuntime).toHaveBeenCalled();
    expect(requestManualPhaseA).toHaveBeenCalledWith({ requestedBy: "admin-user" });
  });
});

describe("AiAgentJobsRuntimeControlService", () => {
  it("toggles pause state for the jobs runtime", async () => {
    const setPaused = vi
      .fn()
      .mockResolvedValueOnce({
        runtimeKey: "global",
        paused: true,
        leaseOwner: null,
        leaseUntil: null,
        runtimeAppSeenAt: null,
        lastStartedAt: null,
        lastFinishedAt: null,
        updatedAt: "2026-04-08T12:00:00.000Z",
        statusLabel: "Paused",
        detail: "Jobs runtime is paused and will not claim new queue rows.",
      })
      .mockResolvedValueOnce({
        runtimeKey: "global",
        paused: false,
        leaseOwner: null,
        leaseUntil: null,
        runtimeAppSeenAt: null,
        lastStartedAt: null,
        lastFinishedAt: null,
        updatedAt: "2026-04-08T12:05:00.000Z",
        statusLabel: "Idle",
        detail: "Jobs runtime is idle and ready to claim queue work.",
      });

    const service = new AiAgentJobsRuntimeControlService({
      deps: {
        loadRuntimeState: vi
          .fn()
          .mockResolvedValueOnce({
            runtimeKey: "global",
            paused: false,
            leaseOwner: null,
            leaseUntil: null,
            runtimeAppSeenAt: null,
            lastStartedAt: null,
            lastFinishedAt: null,
            updatedAt: "2026-04-08T11:00:00.000Z",
            statusLabel: "Idle",
            detail: "Jobs runtime is idle and ready to claim queue work.",
          })
          .mockResolvedValueOnce({
            runtimeKey: "global",
            paused: true,
            leaseOwner: null,
            leaseUntil: null,
            runtimeAppSeenAt: null,
            lastStartedAt: null,
            lastFinishedAt: null,
            updatedAt: "2026-04-08T12:00:00.000Z",
            statusLabel: "Paused",
            detail: "Jobs runtime is paused and will not claim new queue rows.",
          }),
        setPaused,
      },
    });

    const paused = await service.execute("pause");
    const started = await service.execute("start");

    expect(paused.mode).toBe("executed");
    expect(started.mode).toBe("executed");
    expect(setPaused).toHaveBeenNthCalledWith(1, true);
    expect(setPaused).toHaveBeenNthCalledWith(2, false);
  });
});
