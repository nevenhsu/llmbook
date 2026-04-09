import type { AiAgentRuntimeStateSnapshot } from "@/lib/ai/agent/runtime-state-service";
import { AiAgentRuntimeStateService } from "@/lib/ai/agent/runtime-state-service";

export type AiAgentOperatorRuntimeAction = "pause" | "start";

export type AiAgentOperatorRuntimeControlResponse =
  | {
      mode: "blocked_execute";
      action: AiAgentOperatorRuntimeAction;
      actionLabel: string;
      summary: string;
      runtimeState: AiAgentRuntimeStateSnapshot;
    }
  | {
      mode: "executed";
      action: AiAgentOperatorRuntimeAction;
      actionLabel: string;
      summary: string;
      runtimeState: AiAgentRuntimeStateSnapshot;
    };

type Deps = {
  loadRuntimeState: () => Promise<AiAgentRuntimeStateSnapshot>;
  pauseRuntime: () => Promise<AiAgentRuntimeStateSnapshot | null>;
  resumeRuntime: () => Promise<AiAgentRuntimeStateSnapshot | null>;
  requestManualPhaseA: (input: {
    requestedBy: string;
  }) => Promise<AiAgentRuntimeStateSnapshot | null>;
  now: () => number;
};

function labelForAction(action: AiAgentOperatorRuntimeAction): string {
  return action === "pause" ? "Pause" : "Start";
}

export class AiAgentOperatorRuntimeControlService {
  private readonly deps: Deps;

  public constructor(options?: { deps?: Partial<Deps> }) {
    const runtimeStateService = new AiAgentRuntimeStateService();
    this.deps = {
      loadRuntimeState:
        options?.deps?.loadRuntimeState ?? (() => runtimeStateService.loadSnapshot()),
      pauseRuntime:
        options?.deps?.pauseRuntime ?? (() => runtimeStateService.executeAction("pause")),
      resumeRuntime:
        options?.deps?.resumeRuntime ?? (() => runtimeStateService.executeAction("resume")),
      requestManualPhaseA:
        options?.deps?.requestManualPhaseA ??
        ((input) => runtimeStateService.requestManualPhaseA(input)),
      now: options?.deps?.now ?? (() => Date.now()),
    };
  }

  public async execute(
    action: AiAgentOperatorRuntimeAction,
    options?: { requestedBy?: string },
  ): Promise<AiAgentOperatorRuntimeControlResponse> {
    const runtimeState = await this.deps.loadRuntimeState();
    const blocked = this.getBlockedSummary(action, runtimeState, this.deps.now());
    if (blocked) {
      return {
        mode: "blocked_execute",
        action,
        actionLabel: labelForAction(action),
        summary: blocked,
        runtimeState,
      };
    }

    if (action === "pause") {
      const nextState = await this.deps.pauseRuntime();
      if (!nextState) {
        return {
          mode: "blocked_execute",
          action,
          actionLabel: labelForAction(action),
          summary: "Pause could not be persisted.",
          runtimeState,
        };
      }

      return {
        mode: "executed",
        action,
        actionLabel: labelForAction(action),
        summary: "Pause will stop new cycles after current work is safely finished.",
        runtimeState: nextState,
      };
    }

    const resumedState = await this.deps.resumeRuntime();
    if (!resumedState) {
      return {
        mode: "blocked_execute",
        action,
        actionLabel: labelForAction(action),
        summary: "Start could not resume the runtime.",
        runtimeState,
      };
    }

    const requestedState = await this.deps.requestManualPhaseA({
      requestedBy: options?.requestedBy ?? "admin:start",
    });
    if (!requestedState) {
      return {
        mode: "blocked_execute",
        action,
        actionLabel: labelForAction(action),
        summary: "Start could not request the next Phase A cycle.",
        runtimeState: resumedState,
      };
    }

    return {
      mode: "executed",
      action,
      actionLabel: labelForAction(action),
      summary: "Start resumed the runtime and requested the next cycle immediately.",
      runtimeState: requestedState,
    };
  }

  private getBlockedSummary(
    action: AiAgentOperatorRuntimeAction,
    runtimeState: AiAgentRuntimeStateSnapshot,
    now: number,
  ): string | null {
    if (!runtimeState.available) {
      return runtimeState.detail;
    }

    if (action === "pause") {
      if (runtimeState.paused === true) {
        return "Runtime is already paused.";
      }
      return null;
    }

    if (runtimeState.paused === false) {
      return "Runtime is already running.";
    }

    if (runtimeState.runtimeAppOnline !== true) {
      return "Runtime app is offline; Start is unavailable until the background runner heartbeat returns.";
    }

    if (runtimeState.manualPhaseARequestPending === true) {
      return "A manual Phase A request is already pending.";
    }

    if (runtimeState.leaseUntil && new Date(runtimeState.leaseUntil).getTime() > now) {
      return `Runtime lease is active until ${runtimeState.leaseUntil}; wait for the current cycle to finish.`;
    }

    return null;
  }
}
