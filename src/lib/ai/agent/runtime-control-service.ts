import {
  AiAgentRuntimeStateService,
  type AiAgentRuntimeStateSnapshot,
} from "@/lib/ai/agent/runtime-state-service";

export type AiAgentRuntimeControlAction = "pause" | "resume" | "run_phase_a";
export type AiAgentRuntimeControlReasonCode =
  | "runtime_state_unavailable"
  | "already_paused"
  | "not_paused"
  | "runtime_paused"
  | "lease_active"
  | "manual_phase_a_pending"
  | "runtime_app_offline"
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
  executeRuntimeStateAction: (
    action: "pause" | "resume",
  ) => Promise<AiAgentRuntimeStateSnapshot | null>;
  requestManualPhaseA: (input: {
    requestedBy: string;
  }) => Promise<AiAgentRuntimeStateSnapshot | null>;
  now: () => number;
};

function labelForAction(action: AiAgentRuntimeControlAction): string {
  switch (action) {
    case "pause":
      return "Pause runtime";
    case "resume":
      return "Resume runtime";
    case "run_phase_a":
      return "Run Phase A";
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

  if (action === "run_phase_a" && runtimeState.paused === true) {
    return {
      action,
      actionLabel,
      canExecute: false,
      summary: "Runtime is paused; resume before running Phase A.",
      reasonCode: "runtime_paused",
    };
  }

  if (action === "run_phase_a" && runtimeState.manualPhaseARequestPending === true) {
    return {
      action,
      actionLabel,
      canExecute: false,
      summary: "Manual Phase A request is already pending; wait for the runtime app to start it.",
      reasonCode: "manual_phase_a_pending",
    };
  }

  if (action === "run_phase_a" && runtimeState.runtimeAppOnline !== true) {
    return {
      action,
      actionLabel,
      canExecute: false,
      summary:
        "Runtime app is offline; Run Phase A is unavailable until the background runner heartbeat returns.",
      reasonCode: "runtime_app_offline",
    };
  }

  if (
    action === "run_phase_a" &&
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
      executeRuntimeStateAction:
        options?.deps?.executeRuntimeStateAction ??
        (async (action) => runtimeStateService.executeAction(action)),
      requestManualPhaseA:
        options?.deps?.requestManualPhaseA ??
        (async (input) => runtimeStateService.requestManualPhaseA(input)),
      now: options?.deps?.now ?? (() => Date.now()),
    };
  }

  public async execute(
    action: AiAgentRuntimeControlAction,
    options?: {
      requestedBy?: string;
    },
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

    const updatedRuntimeState =
      action === "run_phase_a"
        ? await this.deps.requestManualPhaseA({
            requestedBy: options?.requestedBy ?? "admin:run_phase_a",
          })
        : await this.deps.executeRuntimeStateAction(action);
    if (!updatedRuntimeState) {
      return {
        mode: "blocked_execute",
        action,
        actionLabel: guard.actionLabel,
        reasonCode: "control_not_wired",
        summary:
          action === "run_phase_a"
            ? "Manual Phase A request could not be persisted."
            : `${guard.actionLabel} is not wired in this repo slice yet.`,
        runtimeState,
      };
    }

    return {
      mode: "executed",
      action,
      actionLabel: guard.actionLabel,
      summary:
        action === "run_phase_a"
          ? "Manual Phase A request accepted. Runtime app will execute it next."
          : `${guard.actionLabel} executed against orchestrator runtime state.`,
      runtimeState: updatedRuntimeState,
    };
  }
}
