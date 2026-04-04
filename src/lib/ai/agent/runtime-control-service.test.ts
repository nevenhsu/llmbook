import { describe, expect, it } from "vitest";
import {
  AiAgentRuntimeControlService,
  buildRuntimeControlGuard,
} from "@/lib/ai/agent/runtime-control-service";

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

describe("AiAgentRuntimeControlService", () => {
  it("blocks runtime controls when runtime state is unavailable", async () => {
    const service = new AiAgentRuntimeControlService({
      deps: {
        loadRuntimeState: async () => ({
          ...withManualFields({}),
          available: false,
          statusLabel: "Unavailable",
          detail: "orchestrator_runtime_state is not implemented yet in this repo slice.",
          paused: null,
          publicCandidateGroupIndex: null,
          publicCandidateEpoch: null,
          leaseOwner: null,
          leaseUntil: null,
          cooldownUntil: null,
          runtimeAppSeenAt: null,
          runtimeAppOnline: null,
          lastStartedAt: null,
          lastFinishedAt: null,
        }),
      },
    });

    await expect(service.execute("pause")).resolves.toMatchObject({
      mode: "blocked_execute",
      action: "pause",
      reasonCode: "runtime_state_unavailable",
    });
  });

  it("returns executed when a runtime control callback is provided", async () => {
    const service = new AiAgentRuntimeControlService({
      deps: {
        loadRuntimeState: async () => ({
          ...withManualFields({}),
          available: true,
          statusLabel: "Ready",
          detail: "Runtime state row is available.",
          paused: false,
          publicCandidateGroupIndex: 0,
          publicCandidateEpoch: 0,
          leaseOwner: "orchestrator-1",
          leaseUntil: "2026-03-29T01:15:00.000Z",
          cooldownUntil: null,
          runtimeAppSeenAt: "2026-03-29T01:14:45.000Z",
          runtimeAppOnline: true,
          lastStartedAt: "2026-03-29T01:10:00.000Z",
          lastFinishedAt: "2026-03-29T01:11:00.000Z",
        }),
        executeRuntimeStateAction: async () => ({
          ...withManualFields({}),
          available: true,
          statusLabel: "Paused",
          detail: "Runtime paused by operator.",
          paused: true,
          publicCandidateGroupIndex: 0,
          publicCandidateEpoch: 0,
          leaseOwner: "operator",
          leaseUntil: "2026-03-29T01:20:00.000Z",
          cooldownUntil: "2026-03-29T01:25:00.000Z",
          runtimeAppSeenAt: "2026-03-29T01:14:45.000Z",
          runtimeAppOnline: true,
          lastStartedAt: "2026-03-29T01:10:00.000Z",
          lastFinishedAt: "2026-03-29T01:11:00.000Z",
        }),
      },
    });

    await expect(service.execute("pause")).resolves.toMatchObject({
      mode: "executed",
      action: "pause",
      runtimeState: {
        statusLabel: "Paused",
      },
    });
  });

  it("blocks pause when runtime is already paused", async () => {
    const service = new AiAgentRuntimeControlService({
      deps: {
        loadRuntimeState: async () => ({
          ...withManualFields({}),
          available: true,
          statusLabel: "Paused",
          detail: "Runtime paused by operator.",
          paused: true,
          publicCandidateGroupIndex: 0,
          publicCandidateEpoch: 0,
          leaseOwner: "operator",
          leaseUntil: "2026-03-29T01:20:00.000Z",
          cooldownUntil: "2026-03-29T01:25:00.000Z",
          runtimeAppSeenAt: "2026-03-29T01:14:45.000Z",
          runtimeAppOnline: true,
          lastStartedAt: "2026-03-29T01:10:00.000Z",
          lastFinishedAt: "2026-03-29T01:11:00.000Z",
        }),
      },
    });

    await expect(service.execute("pause")).resolves.toMatchObject({
      mode: "blocked_execute",
      action: "pause",
      reasonCode: "already_paused",
    });
  });

  it("allows run_phase_a during cooldown when no cycle is running", () => {
    expect(
      buildRuntimeControlGuard(
        "run_phase_a",
        {
          ...withManualFields({}),
          available: true,
          statusLabel: "Cooling Down",
          detail: "Runtime cooldown is active.",
          paused: false,
          publicCandidateGroupIndex: 0,
          publicCandidateEpoch: 0,
          leaseOwner: null,
          leaseUntil: null,
          cooldownUntil: "2026-03-29T01:25:00.000Z",
          runtimeAppSeenAt: "2026-03-29T01:19:55.000Z",
          runtimeAppOnline: true,
          lastStartedAt: "2026-03-29T01:10:00.000Z",
          lastFinishedAt: "2026-03-29T01:11:00.000Z",
        },
        new Date("2026-03-29T01:20:00.000Z").getTime(),
      ),
    ).toMatchObject({
      canExecute: true,
      reasonCode: null,
    });
  });

  it("blocks run_phase_a when another runtime lease is still active", () => {
    expect(
      buildRuntimeControlGuard(
        "run_phase_a",
        {
          ...withManualFields({}),
          available: true,
          statusLabel: "Running",
          detail: "Runtime lease is healthy.",
          paused: false,
          publicCandidateGroupIndex: 0,
          publicCandidateEpoch: 0,
          leaseOwner: "orchestrator-1",
          leaseUntil: "2026-03-29T01:30:00.000Z",
          cooldownUntil: null,
          runtimeAppSeenAt: "2026-03-29T01:19:55.000Z",
          runtimeAppOnline: true,
          lastStartedAt: "2026-03-29T01:10:00.000Z",
          lastFinishedAt: "2026-03-29T01:11:00.000Z",
        },
        new Date("2026-03-29T01:20:00.000Z").getTime(),
      ),
    ).toMatchObject({
      canExecute: false,
      reasonCode: "lease_active",
    });
  });

  it("blocks run_phase_a when the runtime app heartbeat is offline", () => {
    expect(
      buildRuntimeControlGuard(
        "run_phase_a",
        {
          ...withManualFields({}),
          available: true,
          statusLabel: "Ready",
          detail: "Runtime state row is available.",
          paused: false,
          publicCandidateGroupIndex: 0,
          publicCandidateEpoch: 0,
          leaseOwner: null,
          leaseUntil: null,
          cooldownUntil: null,
          runtimeAppSeenAt: "2026-03-29T01:10:00.000Z",
          runtimeAppOnline: false,
          lastStartedAt: "2026-03-29T01:10:00.000Z",
          lastFinishedAt: "2026-03-29T01:11:00.000Z",
        },
        new Date("2026-03-29T01:20:00.000Z").getTime(),
      ),
    ).toMatchObject({
      canExecute: false,
      reasonCode: "runtime_app_offline",
    });
  });

  it("persists a manual Phase A request instead of executing inline", async () => {
    const requestManualPhaseA = async () =>
      withManualFields({
        available: true,
        statusLabel: "Manual Phase A Pending",
        detail: "Manual Phase A request is pending from admin-user.",
        paused: false,
        publicCandidateGroupIndex: 0,
        publicCandidateEpoch: 0,
        leaseOwner: null,
        leaseUntil: null,
        cooldownUntil: "2026-03-29T01:25:00.000Z",
        runtimeAppSeenAt: "2026-03-29T01:19:55.000Z",
        runtimeAppOnline: true,
        manualPhaseARequestPending: true,
        manualPhaseARequestedAt: "2026-03-29T01:20:00.000Z",
        manualPhaseARequestedBy: "admin-user",
        manualPhaseARequestId: "manual-request-1",
        lastStartedAt: "2026-03-29T01:10:00.000Z",
        lastFinishedAt: "2026-03-29T01:11:00.000Z",
      });
    let executeRuntimeStateActionCalled = false;
    const service = new AiAgentRuntimeControlService({
      deps: {
        loadRuntimeState: async () =>
          withManualFields({
            available: true,
            statusLabel: "Cooling Down",
            detail: "Runtime cooldown is active.",
            paused: false,
            publicCandidateGroupIndex: 0,
            publicCandidateEpoch: 0,
            leaseOwner: null,
            leaseUntil: null,
            cooldownUntil: "2026-03-29T01:25:00.000Z",
            runtimeAppSeenAt: "2026-03-29T01:19:55.000Z",
            runtimeAppOnline: true,
            lastStartedAt: "2026-03-29T01:10:00.000Z",
            lastFinishedAt: "2026-03-29T01:11:00.000Z",
          }),
        requestManualPhaseA,
        executeRuntimeStateAction: async () => {
          executeRuntimeStateActionCalled = true;
          return null;
        },
      },
    });

    await expect(
      service.execute("run_phase_a", { requestedBy: "admin-user" }),
    ).resolves.toMatchObject({
      mode: "executed",
      action: "run_phase_a",
      summary: "Manual Phase A request accepted. Runtime app will execute it next.",
      runtimeState: {
        manualPhaseARequestPending: true,
      },
    });
    expect(executeRuntimeStateActionCalled).toBe(false);
  });
});
