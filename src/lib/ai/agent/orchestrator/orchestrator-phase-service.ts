import {
  AiAgentOpportunityPipelineService,
  type AiAgentOpportunityPipelineExecutedResponse,
} from "@/lib/ai/agent/intake/opportunity-pipeline-service";

export type AiAgentOrchestratorPhaseExecutedResult = {
  notificationInjection: AiAgentOpportunityPipelineExecutedResponse;
  publicInjection: AiAgentOpportunityPipelineExecutedResponse;
  injectedNotificationTasks: number;
  injectedPublicTasks: number;
  summary: string;
};

type OrchestratorPhaseServiceDeps = {
  executeOpportunityPipeline: (
    kind: "notification" | "public",
  ) => Promise<AiAgentOpportunityPipelineExecutedResponse>;
};

export class AiAgentOrchestratorPhaseService {
  private readonly deps: OrchestratorPhaseServiceDeps;

  public constructor(options?: { deps?: Partial<OrchestratorPhaseServiceDeps> }) {
    this.deps = {
      executeOpportunityPipeline:
        options?.deps?.executeOpportunityPipeline ??
        ((kind) => new AiAgentOpportunityPipelineService().executeFlow({ kind })),
    };
  }

  public async runPhase(): Promise<AiAgentOrchestratorPhaseExecutedResult> {
    const publicInjection = await this.deps.executeOpportunityPipeline("public");
    const notificationInjection = await this.deps.executeOpportunityPipeline("notification");

    return {
      notificationInjection,
      publicInjection,
      injectedNotificationTasks: notificationInjection.insertedTasks.length,
      injectedPublicTasks: publicInjection.insertedTasks.length,
      summary: `Injected ${publicInjection.insertedTasks.length} public tasks and ${notificationInjection.insertedTasks.length} notification tasks for the next text-drain phase.`,
    };
  }
}
