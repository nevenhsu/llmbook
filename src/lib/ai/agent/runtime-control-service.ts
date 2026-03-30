import {
  AiAgentRuntimeStateService,
  type AiAgentRuntimeStateSnapshot,
} from "@/lib/ai/agent/runtime-state-service";

export type AiAgentRuntimeControlAction = "pause" | "resume" | "run_cycle";
export type AiAgentRuntimeControlReasonCode =
  | "runtime_state_unavailable"
  | "already_paused"
  | "not_paused"
  | "runtime_paused"
  | "cooldown_active"
  | "lease_active"
  | "control_not_wired";

export type AiAgentRuntimeControlGuard = {
  action: AiAgentRuntimeControlAction;
  actionLabel: string;
  canExecute: boolean;
  summary: string;
  reasonCode: AiAgentRuntimeControlReasonCode | null;
};

export type AiAgentRuntimeControlBlockedResponse = {
  mode: "blocked_execute";
  action: AiAgentRuntimeControlAction;
  actionLabel: string;
  reasonCode: AiAgentRuntimeControlReasonCode;
  summary: string;
  runtimeState: AiAgentRuntimeStateSnapshot;
};

export type AiAgentRuntimeControlExecutedResponse = {
  mode: "executed";
  action: AiAgentRuntimeControlAction;
  actionLabel: string;
  summary: string;
  runtimeState: AiAgentRuntimeStateSnapshot;
};

export type AiAgentRuntimeControlResponse =
  | AiAgentRuntimeControlBlockedResponse
  | AiAgentRuntimeControlExecutedResponse;

type RuntimeControlServiceDeps = {
  loadRuntimeState: () => Promise<AiAgentRuntimeStateSnapshot>;
  executeAction: (
    action: AiAgentRuntimeControlAction,
  ) => Promise<AiAgentRuntimeStateSnapshot | null>;
  now: () => number;
};

function labelForAction(action: AiAgentRuntimeControlAction): string {
  switch (action) {
    case "pause":
      return "Pause runtime";
    case "resume":
      return "Resume runtime";
    case "run_cycle":
      return "Force run cycle";
  }
}

export function buildRuntimeControlGuard(
  action: AiAgentRuntimeControlAction,
  runtimeState: AiAgentRuntimeStateSnapshot,
  now = Date.now(),
): AiAgentRuntimeControlGuard {
  const actionLabel = labelForAction(action);

  if (!runtimeState.available) {
    return {
      action,
      actionLabel,
      canExecute: false,
      summary: runtimeState.detail,
      reasonCode: "runtime_state_unavailable",
    };
  }

  if (action === "pause" && runtimeState.paused === true) {
    return {
      action,
      actionLabel,
      canExecute: false,
      summary: "Runtime is already paused.",
      reasonCode: "already_paused",
    };
  }

  if (action === "resume" && runtimeState.paused === false) {
    return {
      action,
      actionLabel,
      canExecute: false,
      summary: "Runtime is not paused.",
      reasonCode: "not_paused",
    };
  }

  if (action === "run_cycle" && runtimeState.paused === true) {
    return {
      action,
      actionLabel,
      canExecute: false,
      summary: "Runtime is paused; resume before forcing another cycle.",
      reasonCode: "runtime_paused",
    };
  }

  if (
    action === "run_cycle" &&
    runtimeState.cooldownUntil &&
    new Date(runtimeState.cooldownUntil).getTime() > now
  ) {
    return {
      action,
      actionLabel,
      canExecute: false,
      summary: `Runtime cooldown is active until ${runtimeState.cooldownUntil}.`,
      reasonCode: "cooldown_active",
    };
  }

  if (
    action === "run_cycle" &&
    runtimeState.leaseUntil &&
    new Date(runtimeState.leaseUntil).getTime() > now
  ) {
    return {
      action,
      actionLabel,
      canExecute: false,
      summary: `Runtime lease is active until ${runtimeState.leaseUntil}; wait for the current orchestrator cycle to finish.`,
      reasonCode: "lease_active",
    };
  }

  return {
    action,
    actionLabel,
    canExecute: true,
    summary: `${actionLabel} is available.`,
    reasonCode: null,
  };
}

export class AiAgentRuntimeControlService {
  private readonly deps: RuntimeControlServiceDeps;

  public constructor(options?: { deps?: Partial<RuntimeControlServiceDeps> }) {
    const runtimeStateService = new AiAgentRuntimeStateService();
    this.deps = {
      loadRuntimeState:
        options?.deps?.loadRuntimeState ?? (async () => runtimeStateService.loadSnapshot()),
      executeAction:
        options?.deps?.executeAction ??
        (async (action) => runtimeStateService.executeAction(action)),
      now: options?.deps?.now ?? (() => Date.now()),
    };
  }

  public async execute(
    action: AiAgentRuntimeControlAction,
  ): Promise<AiAgentRuntimeControlResponse> {
    const runtimeState = await this.deps.loadRuntimeState();
    const guard = buildRuntimeControlGuard(action, runtimeState, this.deps.now());

    if (!guard.canExecute) {
      return {
        mode: "blocked_execute",
        action,
        actionLabel: guard.actionLabel,
        reasonCode: guard.reasonCode ?? "runtime_state_unavailable",
        summary: guard.summary,
        runtimeState,
      };
    }

    const updatedRuntimeState = await this.deps.executeAction(action);
    if (!updatedRuntimeState) {
      return {
        mode: "blocked_execute",
        action,
        actionLabel: guard.actionLabel,
        reasonCode: "control_not_wired",
        summary: `${guard.actionLabel} is not wired in this repo slice yet.`,
        runtimeState,
      };
    }

    return {
      mode: "executed",
      action,
      actionLabel: guard.actionLabel,
      summary: `${guard.actionLabel} executed against orchestrator runtime state.`,
      runtimeState: updatedRuntimeState,
    };
  }
}
