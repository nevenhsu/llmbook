import type { AiAgentMemoryOutcomeTrace } from "@/lib/ai/agent/memory";
import type {
  AiAgentRunnerExecutedResponse,
  AiAgentRunnerGuardedExecuteResponse,
  AiAgentRunnerPreviewResponse,
  AiAgentRunnerResponse,
} from "@/lib/ai/agent/execution/admin-runner-service";
import type { AiAgentTaskInjectionExecutedResponse } from "@/lib/ai/agent/intake/task-injection-service";

export type AiAgentOperatorFlowTrace = {
  intake: {
    kind: "notification" | "public" | null;
    insertedTaskCount: number;
    insertedTaskIds: string[];
    completed: boolean;
  };
  execution: {
    mode: AiAgentRunnerResponse["mode"] | null;
    target:
      | AiAgentRunnerExecutedResponse["target"]
      | AiAgentRunnerPreviewResponse["target"]
      | AiAgentRunnerGuardedExecuteResponse["target"]
      | null;
    selectedTaskId: string | null;
    textPersisted: boolean;
    mediaPersisted: boolean;
    compressionPersisted: boolean;
  };
  memory: AiAgentMemoryOutcomeTrace | null;
  stageStatus: {
    intakeCompleted: boolean;
    executionCompleted: boolean;
    latestWriteReady: boolean;
    latestWritePersisted: boolean;
    compressionPersisted: boolean;
  };
};

export function buildOperatorFlowTrace(input: {
  injectionResponse: AiAgentTaskInjectionExecutedResponse | null;
  runnerResponse: AiAgentRunnerResponse | null;
  memoryOutcomeTrace: AiAgentMemoryOutcomeTrace | null;
}): AiAgentOperatorFlowTrace | null {
  const { injectionResponse, runnerResponse, memoryOutcomeTrace } = input;
  if (!injectionResponse && !runnerResponse && !memoryOutcomeTrace) {
    return null;
  }

  const runnerExecuted = runnerResponse?.mode === "executed" ? runnerResponse : null;

  return {
    intake: {
      kind: injectionResponse?.kind ?? null,
      insertedTaskCount: injectionResponse?.insertedTasks.length ?? 0,
      insertedTaskIds: injectionResponse?.insertedTasks.map((task) => task.id) ?? [],
      completed: injectionResponse?.mode === "executed",
    },
    execution: {
      mode: runnerResponse?.mode ?? null,
      target: runnerResponse?.target ?? null,
      selectedTaskId: runnerResponse?.selectedTaskId ?? null,
      textPersisted:
        runnerExecuted?.textResult !== null && runnerExecuted?.textResult !== undefined,
      mediaPersisted:
        runnerExecuted?.mediaResult !== null && runnerExecuted?.mediaResult !== undefined,
      compressionPersisted:
        runnerExecuted?.compressionResult !== null &&
        runnerExecuted?.compressionResult !== undefined,
    },
    memory: memoryOutcomeTrace,
    stageStatus: {
      intakeCompleted: injectionResponse?.mode === "executed",
      executionCompleted: runnerResponse?.mode === "executed",
      latestWriteReady: memoryOutcomeTrace?.stageStatus.latestWriteCandidateReady ?? false,
      latestWritePersisted: memoryOutcomeTrace?.stageStatus.latestWritePersisted ?? false,
      compressionPersisted: memoryOutcomeTrace?.stageStatus.compressionPersisted ?? false,
    },
  };
}
