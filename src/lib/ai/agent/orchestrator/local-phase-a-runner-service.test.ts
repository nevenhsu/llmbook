import { describe, expect, it, vi } from "vitest";
import { AiAgentLocalPhaseARunnerService } from "@/lib/ai/agent/orchestrator/local-phase-a-runner-service";

describe("AiAgentLocalPhaseARunnerService", () => {
  it("logs the computed cooldown without persisting runtime state", async () => {
    const lines: string[] = [];
    const now = vi
      .fn<() => Date>()
      .mockReturnValueOnce(new Date("2026-04-04T12:00:00.000Z"))
      .mockReturnValueOnce(new Date("2026-04-04T12:03:00.000Z"));

    const service = new AiAgentLocalPhaseARunnerService({
      deps: {
        loadConfig: async () => ({
          orchestratorCooldownMinutes: 5,
        }),
        runPhase: async () => ({
          publicInjection: {
            mode: "executed",
            kind: "public",
            message: "public done",
            injectionPreview: {
              rpcName: "inject_persona_tasks",
              summary: {
                candidateCount: 1,
                insertedCount: 1,
                skippedCount: 0,
                insertedTaskIds: ["task-public-1"],
                skippedReasonCounts: {},
              },
              results: [],
            },
            insertedTasks: [{ id: "task-public-1" } as never],
          },
          notificationInjection: {
            mode: "executed",
            kind: "notification",
            message: "notification done",
            injectionPreview: {
              rpcName: "inject_persona_tasks",
              summary: {
                candidateCount: 2,
                insertedCount: 2,
                skippedCount: 0,
                insertedTaskIds: ["task-notification-1", "task-notification-2"],
                skippedReasonCounts: {},
              },
              results: [],
            },
            insertedTasks: [
              { id: "task-notification-1" } as never,
              { id: "task-notification-2" } as never,
            ],
          },
          injectedPublicTasks: 1,
          injectedNotificationTasks: 2,
          summary:
            "Injected 1 public tasks and 2 notification tasks for the next text-drain phase.",
        }),
        now,
        writeLine: (line) => {
          lines.push(line);
        },
      },
    });

    const result = await service.runOnce();

    expect(result.wouldCooldownUntil).toBe("2026-04-04T12:08:00.000Z");
    expect(lines.join("\n")).toContain("Local Phase A run started");
    expect(lines.join("\n")).toContain("Would set cooldown_until=2026-04-04T12:08:00.000Z");
    expect(lines.join("\n")).toContain("not persisted");
  });

  it("can be constructed with the default read-only snapshot loader", () => {
    expect(() => new AiAgentLocalPhaseARunnerService()).not.toThrow();
  });
});
