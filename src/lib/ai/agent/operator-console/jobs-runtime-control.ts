import type { AiAgentJobRuntimeStateSnapshot } from "@/lib/ai/agent/jobs/job-types";
import { AiAgentJobRuntimeStateService } from "@/lib/ai/agent/jobs/job-runtime-state-service";

export type AiAgentJobsRuntimeAction = "pause" | "start";

export type AiAgentJobsRuntimeControlResponse =
  | {
      mode: "blocked_execute";
      action: AiAgentJobsRuntimeAction;
      actionLabel: string;
      summary: string;
      runtimeState: AiAgentJobRuntimeStateSnapshot;
    }
  | {
      mode: "executed";
      action: AiAgentJobsRuntimeAction;
      actionLabel: string;
      summary: string;
      runtimeState: AiAgentJobRuntimeStateSnapshot;
    };

type Deps = {
  loadRuntimeState: () => Promise<AiAgentJobRuntimeStateSnapshot>;
  setPaused: (paused: boolean) => Promise<AiAgentJobRuntimeStateSnapshot | null>;
};

function labelForAction(action: AiAgentJobsRuntimeAction): string {
  return action === "pause" ? "Pause" : "Start";
}

export class AiAgentJobsRuntimeControlService {
  private readonly deps: Deps;

  public constructor(options?: { deps?: Partial<Deps>; runtimeKey?: string }) {
    const stateService = new AiAgentJobRuntimeStateService({ runtimeKey: options?.runtimeKey });
    this.deps = {
      loadRuntimeState: options?.deps?.loadRuntimeState ?? (() => stateService.loadSnapshot()),
      setPaused: options?.deps?.setPaused ?? ((paused) => stateService.setPaused(paused)),
    };
  }

  public async execute(
    action: AiAgentJobsRuntimeAction,
  ): Promise<AiAgentJobsRuntimeControlResponse> {
    const runtimeState = await this.deps.loadRuntimeState();
    const blocked = this.getBlockedSummary(action, runtimeState);
    if (blocked) {
      return {
        mode: "blocked_execute",
        action,
        actionLabel: labelForAction(action),
        summary: blocked,
        runtimeState,
      };
    }

    const nextState = await this.deps.setPaused(action === "pause");
    if (!nextState) {
      return {
        mode: "blocked_execute",
        action,
        actionLabel: labelForAction(action),
        summary: `${labelForAction(action)} could not be persisted.`,
        runtimeState,
      };
    }

    return {
      mode: "executed",
      action,
      actionLabel: labelForAction(action),
      summary:
        action === "pause"
          ? "Pause will stop new job claims after the current job finishes."
          : "Start resumed the jobs runtime; the next poll may claim pending work.",
      runtimeState: nextState,
    };
  }

  private getBlockedSummary(
    action: AiAgentJobsRuntimeAction,
    runtimeState: AiAgentJobRuntimeStateSnapshot,
  ): string | null {
    if (action === "pause" && runtimeState.paused) {
      return "Jobs runtime is already paused.";
    }
    if (action === "start" && !runtimeState.paused) {
      return "Jobs runtime is already running.";
    }
    return null;
  }
}
