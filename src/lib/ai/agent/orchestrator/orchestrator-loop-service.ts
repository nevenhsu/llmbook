import {
  AiAgentAdminRunnerService,
  type AiAgentRunnerExecutedResponse,
  type AiAgentRunnerGuardedExecuteResponse,
  type AiAgentOrchestratorExecutedResult,
} from "@/lib/ai/agent/execution/admin-runner-service";
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
  orchestratorResult: AiAgentOrchestratorExecutedResult;
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
  claimLease: (input: AiAgentOrchestratorLoopInput) => Promise<AiAgentRuntimeLeaseClaimResult>;
  releaseLease: (input: { leaseOwner: string; cooldownMinutes?: number | null }) => Promise<{
    mode: "blocked" | "released";
    summary: string;
    runtimeState: AiAgentRuntimeStateSnapshot;
  }>;
  beginHeartbeatLoop: (input: OrchestratorHeartbeatLoopInput) => () => void;
  executeOrchestratorOnce: () => Promise<
    | Pick<AiAgentRunnerGuardedExecuteResponse, "mode" | "summary">
    | Pick<AiAgentRunnerExecutedResponse, "mode" | "summary" | "orchestratorResult">
  >;
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
    const runnerService = new AiAgentAdminRunnerService();
    this.deps = {
      claimLease:
        options?.deps?.claimLease ??
        ((input) =>
          runtimeStateService.claimLease({
            leaseOwner: input.leaseOwner,
            leaseMs: input.leaseMs,
          })),
      releaseLease:
        options?.deps?.releaseLease ?? ((input) => runtimeStateService.releaseLease(input)),
      beginHeartbeatLoop:
        options?.deps?.beginHeartbeatLoop ?? createDefaultHeartbeatLoop(runtimeStateService),
      executeOrchestratorOnce:
        options?.deps?.executeOrchestratorOnce ??
        (() => runnerService.executeTarget({ target: "orchestrator_once" })),
      sleep: options?.deps?.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    };
  }

  public async runSingleIteration(
    input: AiAgentOrchestratorLoopInput,
  ): Promise<AiAgentOrchestratorLoopIterationResult> {
    const claimResult = await this.deps.claimLease(input);
    if (claimResult.mode === "blocked") {
      return claimResult;
    }

    const stopHeartbeat = this.deps.beginHeartbeatLoop(input);

    try {
      const runnerResult = await this.deps.executeOrchestratorOnce();
      if (runnerResult.mode !== "executed" || !runnerResult.orchestratorResult) {
        const releaseResult = await this.deps.releaseLease({
          leaseOwner: input.leaseOwner,
          cooldownMinutes: null,
        });
        return {
          mode: "failed",
          summary: "Background orchestrator iteration did not reach an executed state.",
          errorMessage: runnerResult.summary,
          runtimeState:
            releaseResult.mode === "released"
              ? releaseResult.runtimeState
              : claimResult.runtimeState,
        };
      }

      const releaseResult = await this.deps.releaseLease({
        leaseOwner: input.leaseOwner,
      });
      if (releaseResult.mode !== "released") {
        return {
          mode: "failed",
          summary: "Background orchestrator iteration executed, but lease release failed.",
          errorMessage: releaseResult.summary,
          runtimeState: releaseResult.runtimeState,
        };
      }

      return {
        mode: "executed",
        summary: runnerResult.summary,
        runtimeState: releaseResult.runtimeState,
        orchestratorResult: runnerResult.orchestratorResult,
      };
    } catch (error) {
      const releaseResult = await this.deps.releaseLease({
        leaseOwner: input.leaseOwner,
        cooldownMinutes: null,
      });

      return {
        mode: "failed",
        summary: "Background orchestrator iteration failed.",
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
