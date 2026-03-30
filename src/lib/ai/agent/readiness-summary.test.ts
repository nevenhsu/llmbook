import { describe, expect, it } from "vitest";
import { buildAiAgentReadinessSummary } from "@/lib/ai/agent/readiness-summary";
import { buildMockAiAgentOverviewSnapshot } from "@/lib/ai/agent/testing/mock-overview-snapshot";

describe("readiness-summary", () => {
  it("marks overview as blocked when runtime state is unavailable and backlog requires attention", () => {
    const summary = buildAiAgentReadinessSummary(buildMockAiAgentOverviewSnapshot());

    expect(summary.overallStatus).toBe("blocked");
    expect(summary.statusLabel).toBe("Blocked");
    expect(summary.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "runtime_state",
          status: "fail",
        }),
        expect.objectContaining({
          key: "queue_backlog",
          status: "fail",
        }),
      ]),
    );
  });
});
