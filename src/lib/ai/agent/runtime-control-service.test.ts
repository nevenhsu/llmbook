import { describe, expect, it } from "vitest";
import {
  AiAgentRuntimeControlService,
  buildRuntimeControlGuard,
} from "@/lib/ai/agent/runtime-control-service";

describe("AiAgentRuntimeControlService", () => {
  it("blocks runtime controls when runtime state is unavailable", async () => {
    const service = new AiAgentRuntimeControlService({
      deps: {
        loadRuntimeState: async () => ({
          available: false,
          statusLabel: "Unavailable",
          detail: "orchestrator_runtime_state is not implemented yet in this repo slice.",
          paused: null,
          leaseOwner: null,
          leaseUntil: null,
          cooldownUntil: null,
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
          available: true,
          statusLabel: "Ready",
          detail: "Runtime state row is available.",
          paused: false,
          leaseOwner: "orchestrator-1",
          leaseUntil: "2026-03-29T01:15:00.000Z",
          cooldownUntil: null,
          lastStartedAt: "2026-03-29T01:10:00.000Z",
          lastFinishedAt: "2026-03-29T01:11:00.000Z",
        }),
        executeAction: async () => ({
          available: true,
          statusLabel: "Paused",
          detail: "Runtime paused by operator.",
          paused: true,
          leaseOwner: "operator",
          leaseUntil: "2026-03-29T01:20:00.000Z",
          cooldownUntil: "2026-03-29T01:25:00.000Z",
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
          available: true,
          statusLabel: "Paused",
          detail: "Runtime paused by operator.",
          paused: true,
          leaseOwner: "operator",
          leaseUntil: "2026-03-29T01:20:00.000Z",
          cooldownUntil: "2026-03-29T01:25:00.000Z",
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

  it("blocks run_cycle when cooldown is still active", () => {
    expect(
      buildRuntimeControlGuard(
        "run_cycle",
        {
          available: true,
          statusLabel: "Running",
          detail: "Runtime lease is healthy.",
          paused: false,
          leaseOwner: "orchestrator-1",
          leaseUntil: "2026-03-29T01:15:00.000Z",
          cooldownUntil: "2026-03-29T01:25:00.000Z",
          lastStartedAt: "2026-03-29T01:10:00.000Z",
          lastFinishedAt: "2026-03-29T01:11:00.000Z",
        },
        new Date("2026-03-29T01:20:00.000Z").getTime(),
      ),
    ).toMatchObject({
      canExecute: false,
      reasonCode: "cooldown_active",
    });
  });

  it("blocks run_cycle when another runtime lease is still active", () => {
    expect(
      buildRuntimeControlGuard(
        "run_cycle",
        {
          available: true,
          statusLabel: "Running",
          detail: "Runtime lease is healthy.",
          paused: false,
          leaseOwner: "orchestrator-1",
          leaseUntil: "2026-03-29T01:30:00.000Z",
          cooldownUntil: null,
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
});
