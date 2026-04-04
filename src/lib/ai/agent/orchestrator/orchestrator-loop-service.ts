import {
  AiAgentOrchestratorPhaseService,
  type AiAgentOrchestratorPhaseExecutedResult,
} from "@/lib/ai/agent/orchestrator/orchestrator-phase-service";
import {
  AiAgentRuntimeStateService,
  type AiAgentRuntimeLeaseClaimResult,
  type AiAgentRuntimeLeaseReasonCode,
  type AiAgentRuntimeStateSnapshot,
} from "@/lib/ai/agent/runtime-state-service";

export type AiAgentOrchestratorLoopInput = {
  leaseOwner: string;
  leaseMs: number;
  heartbeatMs: number;
};

export type AiAgentOrchestratorLoopIterationBlockedResult = {
  mode: "blocked";
  reasonCode: AiAgentRuntimeLeaseReasonCode;
  summary: string;
  runtimeState: AiAgentRuntimeStateSnapshot;
};

export type AiAgentOrchestratorLoopIterationExecutedResult = {
  mode: "executed";
  summary: string;
  runtimeState: AiAgentRuntimeStateSnapshot;
  orchestratorResult: AiAgentOrchestratorPhaseExecutedResult;
};

export type AiAgentOrchestratorLoopIterationFailedResult = {
  mode: "failed";
  summary: string;
  errorMessage: string;
  runtimeState: AiAgentRuntimeStateSnapshot | null;
};

export type AiAgentOrchestratorLoopIterationResult =
  | AiAgentOrchestratorLoopIterationBlockedResult
  | AiAgentOrchestratorLoopIterationExecutedResult
  | AiAgentOrchestratorLoopIterationFailedResult;

export type AiAgentOrchestratorLoopRunResult = {
  attempts: number;
  executedIterations: number;
  lastResult: AiAgentOrchestratorLoopIterationResult | null;
};

type OrchestratorHeartbeatLoopInput = AiAgentOrchestratorLoopInput;

type OrchestratorLoopDeps = {
  touchRuntimeAppHeartbeat: () => Promise<void>;
  loadRuntimeState: () => Promise<AiAgentRuntimeStateSnapshot>;
  claimLease: (
    input: AiAgentOrchestratorLoopInput & { allowDuringCooldown?: boolean },
  ) => Promise<AiAgentRuntimeLeaseClaimResult>;
  releaseLease: (input: { leaseOwner: string; cooldownMinutes?: number | null }) => Promise<{
    mode: "blocked" | "released";
    summary: string;
    runtimeState: AiAgentRuntimeStateSnapshot;
  }>;
  markManualPhaseAStarted: (requestId: string) => Promise<AiAgentRuntimeStateSnapshot | null>;
  completeManualPhaseA: (requestId: string) => Promise<AiAgentRuntimeStateSnapshot | null>;
  failManualPhaseA: (
    requestId: string,
    errorMessage: string,
  ) => Promise<AiAgentRuntimeStateSnapshot | null>;
  beginHeartbeatLoop: (input: OrchestratorHeartbeatLoopInput) => () => void;
  runOrchestratorPhase: () => Promise<AiAgentOrchestratorPhaseExecutedResult>;
  sleep: (ms: number) => Promise<void>;
};

function createDefaultHeartbeatLoop(
  runtimeStateService: AiAgentRuntimeStateService,
): (input: OrchestratorHeartbeatLoopInput) => () => void {
  return (input) => {
    const interval = setInterval(() => {
      void runtimeStateService.heartbeatLease({
        leaseOwner: input.leaseOwner,
        leaseMs: input.leaseMs,
      });
    }, input.heartbeatMs);

    return () => clearInterval(interval);
  };
}

export class AiAgentOrchestratorLoopService {
  private readonly deps: OrchestratorLoopDeps;

  public constructor(options?: { deps?: Partial<OrchestratorLoopDeps> }) {
    const runtimeStateService = new AiAgentRuntimeStateService();
    const phaseService = new AiAgentOrchestratorPhaseService();
    this.deps = {
      touchRuntimeAppHeartbeat:
        options?.deps?.touchRuntimeAppHeartbeat ??
        (async () => {
          await runtimeStateService.touchRuntimeAppHeartbeat();
        }),
      loadRuntimeState:
        options?.deps?.loadRuntimeState ?? (() => runtimeStateService.loadSnapshot()),
      claimLease:
        options?.deps?.claimLease ??
        ((input) =>
          runtimeStateService.claimLease({
            leaseOwner: input.leaseOwner,
            leaseMs: input.leaseMs,
            allowDuringCooldown: input.allowDuringCooldown,
          })),
      releaseLease:
        options?.deps?.releaseLease ?? ((input) => runtimeStateService.releaseLease(input)),
      markManualPhaseAStarted:
        options?.deps?.markManualPhaseAStarted ??
        ((requestId) => runtimeStateService.markManualPhaseAStarted(requestId)),
      completeManualPhaseA:
        options?.deps?.completeManualPhaseA ??
        ((requestId) => runtimeStateService.completeManualPhaseA(requestId)),
      failManualPhaseA:
        options?.deps?.failManualPhaseA ??
        ((requestId, errorMessage) =>
          runtimeStateService.failManualPhaseA(requestId, errorMessage)),
      beginHeartbeatLoop:
        options?.deps?.beginHeartbeatLoop ?? createDefaultHeartbeatLoop(runtimeStateService),
      runOrchestratorPhase: options?.deps?.runOrchestratorPhase ?? (() => phaseService.runPhase()),
      sleep: options?.deps?.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    };
  }

  public async runSingleIteration(
    input: AiAgentOrchestratorLoopInput,
  ): Promise<AiAgentOrchestratorLoopIterationResult> {
    await this.deps.touchRuntimeAppHeartbeat();
    const runtimeState = await this.deps.loadRuntimeState();
    const manualPhaseARequestId = runtimeState.manualPhaseARequestPending
      ? runtimeState.manualPhaseARequestId
      : null;
    const claimResult = await this.deps.claimLease({
      ...input,
      allowDuringCooldown: manualPhaseARequestId !== null,
    });
    if (claimResult.mode === "blocked") {
      return claimResult;
    }

    const stopHeartbeat = this.deps.beginHeartbeatLoop(input);

    try {
      if (manualPhaseARequestId) {
        await this.deps.markManualPhaseAStarted(manualPhaseARequestId);
      }
      const phaseResult = await this.deps.runOrchestratorPhase();
      const releaseResult = await this.deps.releaseLease({
        leaseOwner: input.leaseOwner,
        cooldownMinutes: manualPhaseARequestId ? null : undefined,
      });
      if (manualPhaseARequestId) {
        await this.deps.completeManualPhaseA(manualPhaseARequestId);
      }

      if (releaseResult.mode !== "released") {
        return {
          mode: "failed",
          summary: "Background orchestrator phase executed, but lease release failed.",
          errorMessage: releaseResult.summary,
          runtimeState: releaseResult.runtimeState,
        };
      }

      return {
        mode: "executed",
        summary: phaseResult.summary,
        runtimeState: releaseResult.runtimeState,
        orchestratorResult: phaseResult,
      };
    } catch (error) {
      const releaseResult = await this.deps.releaseLease({
        leaseOwner: input.leaseOwner,
        cooldownMinutes: null,
      });
      if (manualPhaseARequestId) {
        await this.deps.failManualPhaseA(
          manualPhaseARequestId,
          error instanceof Error ? error.message : "Unknown orchestrator loop error",
        );
      }

      return {
        mode: "failed",
        summary: "Background orchestrator phase failed.",
        errorMessage: error instanceof Error ? error.message : "Unknown orchestrator loop error",
        runtimeState:
          releaseResult.mode === "released" ? releaseResult.runtimeState : claimResult.runtimeState,
      };
    } finally {
      stopHeartbeat();
    }
  }

  public async runLoop(
    input: AiAgentOrchestratorLoopInput & {
      pollMs: number;
      maxIterations?: number;
      signal?: AbortSignal;
    },
  ): Promise<AiAgentOrchestratorLoopRunResult> {
    let attempts = 0;
    let executedIterations = 0;
    let lastResult: AiAgentOrchestratorLoopIterationResult | null = null;

    while (!input.signal?.aborted) {
      if (typeof input.maxIterations === "number" && attempts >= input.maxIterations) {
        break;
      }

      attempts += 1;
      lastResult = await this.runSingleIteration(input);
      if (lastResult.mode === "executed") {
        executedIterations += 1;
      }

      if (input.signal?.aborted) {
        break;
      }

      await this.deps.sleep(input.pollMs);
    }

    return {
      attempts,
      executedIterations,
      lastResult,
    };
  }
}
