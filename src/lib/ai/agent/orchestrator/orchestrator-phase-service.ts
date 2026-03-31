import {
  AiAgentTaskInjectionService,
  type AiAgentTaskInjectionExecutedResponse,
} from "@/lib/ai/agent/intake/task-injection-service";

export type AiAgentOrchestratorPhaseExecutedResult = {
  notificationInjection: AiAgentTaskInjectionExecutedResponse;
  publicInjection: AiAgentTaskInjectionExecutedResponse;
  injectedNotificationTasks: number;
  injectedPublicTasks: number;
  summary: string;
};

type OrchestratorPhaseServiceDeps = {
  executeIntakeInjection: (
    kind: "notification" | "public",
  ) => Promise<AiAgentTaskInjectionExecutedResponse>;
};

export class AiAgentOrchestratorPhaseService {
  private readonly deps: OrchestratorPhaseServiceDeps;

  public constructor(options?: { deps?: Partial<OrchestratorPhaseServiceDeps> }) {
    this.deps = {
      executeIntakeInjection:
        options?.deps?.executeIntakeInjection ??
        ((kind) => new AiAgentTaskInjectionService().executeInjection({ kind })),
    };
  }

  public async runPhase(): Promise<AiAgentOrchestratorPhaseExecutedResult> {
    const notificationInjection = await this.deps.executeIntakeInjection("notification");
    const publicInjection = await this.deps.executeIntakeInjection("public");

    return {
      notificationInjection,
      publicInjection,
      injectedNotificationTasks: notificationInjection.insertedTasks.length,
      injectedPublicTasks: publicInjection.insertedTasks.length,
      summary: `Injected ${notificationInjection.insertedTasks.length} notification tasks and ${publicInjection.insertedTasks.length} public tasks for the next text-drain phase.`,
    };
  }
}
