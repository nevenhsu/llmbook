import {
  AiAgentPersonaTaskPersistenceService,
  type AiAgentTextExecutionPersistedResult,
} from "@/lib/ai/agent/execution/persona-task-persistence-service";
import { AiAgentPersonaTaskStore } from "@/lib/ai/agent/execution/persona-task-store";
import {
  AiAgentJobPermanentSkipError,
  AiAgentPersonaTaskGenerator,
  type AiAgentPersonaTaskGenerationResult,
} from "@/lib/ai/agent/execution/persona-task-generator";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";

type PersonaTaskExecutorDeps = {
  loadTaskById: (taskId: string) => Promise<AiAgentRecentTaskSnapshot | null>;
  generateTaskContent: (input: {
    task: AiAgentRecentTaskSnapshot;
    mode: "runtime";
  }) => Promise<AiAgentPersonaTaskGenerationResult>;
  persistGeneratedTaskResult: (input: {
    generated: AiAgentPersonaTaskGenerationResult;
    sourceRuntime: string;
    jobTaskId?: string | null;
    createdBy?: string | null;
  }) => Promise<AiAgentTextExecutionPersistedResult>;
};

export type { AiAgentTextExecutionPersistedResult };

export class AiAgentPersonaTaskExecutor {
  private readonly deps: PersonaTaskExecutorDeps;

  public constructor(options?: { deps?: Partial<PersonaTaskExecutorDeps> }) {
    const taskStore = new AiAgentPersonaTaskStore();
    const personaTaskGenerator = new AiAgentPersonaTaskGenerator();
    const persistenceService = new AiAgentPersonaTaskPersistenceService();
    this.deps = {
      loadTaskById: options?.deps?.loadTaskById ?? ((taskId) => taskStore.loadTaskById(taskId)),
      generateTaskContent:
        options?.deps?.generateTaskContent ??
        ((input) =>
          personaTaskGenerator.generateFromTask({
            task: input.task,
            mode: input.mode,
          })),
      persistGeneratedTaskResult:
        options?.deps?.persistGeneratedTaskResult ??
        ((input) => persistenceService.persistGeneratedResult(input)),
    };
  }

  public async executeTask(input: {
    taskId?: string;
    task?: AiAgentRecentTaskSnapshot;
    sourceRuntime: string;
    jobTaskId?: string | null;
    createdBy?: string | null;
  }): Promise<AiAgentTextExecutionPersistedResult> {
    const task = input.task ?? (input.taskId ? await this.deps.loadTaskById(input.taskId) : null);

    if (!task) {
      throw new AiAgentJobPermanentSkipError("persona_task not found");
    }

    const generated = await this.deps.generateTaskContent({
      task,
      mode: "runtime",
    });
    return this.deps.persistGeneratedTaskResult({
      generated,
      sourceRuntime: input.sourceRuntime,
      jobTaskId: input.jobTaskId ?? null,
      createdBy: input.createdBy ?? null,
    });
  }
}
