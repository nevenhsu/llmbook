import type { AiAgentTaskInjectionExecutedResponse } from "@/lib/ai/agent/intake/task-injection-service";
import type { IntakeProgressEvent } from "@/lib/ai/agent/intake/intake-progress-event";

export type IntakeFlowExecutedResponse = AiAgentTaskInjectionExecutedResponse;

export interface IntakeFlow {
  execute(): Promise<IntakeFlowExecutedResponse>;
}

export type IntakeFlowDeps = {
  onEvent?: (event: IntakeProgressEvent) => void;
};
