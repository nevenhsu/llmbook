import { describe, expect, it, vi } from "vitest";

const loadSnapshotMock = vi.fn();

vi.mock("@/lib/ai/agent/runtime-state-service", () => ({
  AiAgentRuntimeStateService: class {
    loadSnapshot() {
      return loadSnapshotMock();
    }
  },
}));

describe("GET /api/admin/ai/agent/runtime/state", () => {
  it("returns the latest runtime state snapshot", async () => {
    loadSnapshotMock.mockResolvedValueOnce({
      available: true,
      statusLabel: "Ready",
      detail: "Runtime state row is available.",
      paused: false,
      publicCandidateGroupIndex: 2,
      publicCandidateEpoch: 4,
      leaseOwner: null,
      leaseUntil: null,
      cooldownUntil: null,
      runtimeAppSeenAt: "2026-04-04T03:00:00.000Z",
      runtimeAppOnline: true,
      manualPhaseARequestPending: false,
      manualPhaseARequestedAt: null,
      manualPhaseARequestedBy: null,
      manualPhaseARequestId: null,
      manualPhaseAStartedAt: null,
      manualPhaseAFinishedAt: null,
      manualPhaseAError: null,
      lastStartedAt: "2026-04-04T02:55:00.000Z",
      lastFinishedAt: "2026-04-04T02:56:00.000Z",
    });

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      runtimeState: {
        runtimeAppOnline: true,
        runtimeAppSeenAt: "2026-04-04T03:00:00.000Z",
      },
    });
  });
});
