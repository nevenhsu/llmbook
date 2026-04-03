import { describe, expect, it, vi } from "vitest";
import { AiAgentOrchestratorPhaseService } from "@/lib/ai/agent/orchestrator/orchestrator-phase-service";

describe("AiAgentOrchestratorPhaseService", () => {
  it("runs public opportunity pipeline before notification pipeline", async () => {
    const calls: string[] = [];
    const service = new AiAgentOrchestratorPhaseService({
      deps: {
        executeOpportunityPipeline: async (kind) => {
          calls.push(kind);
          return {
            mode: "executed",
            kind,
            message: `${kind} pipeline executed`,
            injectionPreview: null as never,
            insertedTasks:
              kind === "public"
                ? [{ id: "task-public" } as never]
                : [{ id: "task-notification" } as never, { id: "task-notification-2" } as never],
          };
        },
      },
    });

    await expect(service.runPhase()).resolves.toMatchObject({
      injectedPublicTasks: 1,
      injectedNotificationTasks: 2,
      summary: "Injected 1 public tasks and 2 notification tasks for the next text-drain phase.",
    });
    expect(calls).toEqual(["public", "notification"]);
  });

  it("returns the public result and notification result separately", async () => {
    const publicResult = {
      mode: "executed" as const,
      kind: "public" as const,
      message: "public done",
      injectionPreview: null as never,
      insertedTasks: [{ id: "task-public" } as never],
    };
    const notificationResult = {
      mode: "executed" as const,
      kind: "notification" as const,
      message: "notification done",
      injectionPreview: null as never,
      insertedTasks: [],
    };
    const executeOpportunityPipeline = vi.fn(async (kind: "notification" | "public") =>
      kind === "public" ? publicResult : notificationResult,
    );
    const service = new AiAgentOrchestratorPhaseService({
      deps: {
        executeOpportunityPipeline,
      },
    });

    const result = await service.runPhase();

    expect(result.publicInjection).toBe(publicResult);
    expect(result.notificationInjection).toBe(notificationResult);
  });
});
