import {
  AiAgentPersonaTaskPersistenceService,
  type AiAgentTextExecutionPersistedResult,
} from "@/lib/ai/agent/execution/persona-task-persistence-service";
import {
  AiAgentPersonaTaskService,
  type AiAgentPersonaTaskGenerationResult,
} from "@/lib/ai/agent/jobs/persona-task-service";

type PersonaTaskExecutionServiceDeps = {
  generateTaskContent: (taskId: string) => Promise<AiAgentPersonaTaskGenerationResult>;
  persistGeneratedTaskResult: (input: {
    generated: AiAgentPersonaTaskGenerationResult;
    sourceRuntime: string;
    jobTaskId?: string | null;
    createdBy?: string | null;
  }) => Promise<AiAgentTextExecutionPersistedResult>;
};

export type { AiAgentTextExecutionPersistedResult };

export class AiAgentPersonaTaskExecutionService {
  private readonly deps: PersonaTaskExecutionServiceDeps;

  public constructor(options?: { deps?: Partial<PersonaTaskExecutionServiceDeps> }) {
    const personaTaskService = new AiAgentPersonaTaskService();
    const persistenceService = new AiAgentPersonaTaskPersistenceService();
    this.deps = {
      generateTaskContent:
        options?.deps?.generateTaskContent ??
        ((taskId) =>
          personaTaskService.generateFromTask({
            personaTaskId: taskId,
            mode: "runtime",
          })),
      persistGeneratedTaskResult:
        options?.deps?.persistGeneratedTaskResult ??
        ((input) => persistenceService.persistGeneratedResult(input)),
    };
  }

  public async executeTask(input: {
    taskId: string;
    sourceRuntime: string;
    jobTaskId?: string | null;
    createdBy?: string | null;
  }): Promise<AiAgentTextExecutionPersistedResult> {
    const generated = await this.deps.generateTaskContent(input.taskId);
    return this.deps.persistGeneratedTaskResult({
      generated,
      sourceRuntime: input.sourceRuntime,
      jobTaskId: input.jobTaskId ?? null,
      createdBy: input.createdBy ?? null,
    });
  }
}
