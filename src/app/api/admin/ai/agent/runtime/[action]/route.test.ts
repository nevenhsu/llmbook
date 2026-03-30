import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const executeMock = vi.fn();

vi.mock("@/lib/ai/agent/runtime-control-service", () => ({
  AiAgentRuntimeControlService: class {
    execute(action: string) {
      return executeMock(action);
    }
  },
}));

describe("POST /api/admin/ai/agent/runtime/[action]", () => {
  it("returns blocked runtime control payloads with 409", async () => {
    executeMock.mockResolvedValueOnce({
      mode: "blocked_execute",
      action: "pause",
      actionLabel: "Pause runtime",
      reasonCode: "runtime_state_unavailable",
      summary: "orchestrator_runtime_state is not implemented yet in this repo slice.",
      runtimeState: {
        available: false,
        statusLabel: "Unavailable",
        detail: "orchestrator_runtime_state is not implemented yet in this repo slice.",
      },
    });

    const { POST } = await import("./route");
    const response = await POST({} as NextRequest, {
      params: Promise.resolve({ action: "pause" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      mode: "blocked_execute",
      action: "pause",
    });
  });
});
