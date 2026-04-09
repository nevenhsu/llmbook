import { AdminAiControlPlaneStore, type PreviewResult } from "@/lib/ai/admin/control-plane-store";
import { getActiveOrderedModels } from "@/lib/ai/admin/active-model-order";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import {
  AiAgentPersonaTaskContextBuilder,
  type AiAgentPersonaTaskPromptContext,
} from "@/lib/ai/agent/execution/persona-task-context-builder";
import {
  parseMarkdownActionOutput,
  parsePostActionOutput,
} from "@/lib/ai/prompt-runtime/action-output";

type PreferredTextModel = {
  modelId: string;
  providerKey: string;
  modelKey: string;
};

type PersonaTaskGeneratorDeps = {
  buildPromptContext: (input: {
    task: AiAgentRecentTaskSnapshot;
  }) => Promise<AiAgentPersonaTaskPromptContext>;
  loadPreferredTextModel: () => Promise<PreferredTextModel>;
  runPersonaInteraction: (input: {
    personaId: string;
    modelId: string;
    taskType: "post" | "comment";
    taskContext: string;
    boardContextText?: string;
    targetContextText?: string;
  }) => Promise<PreviewResult>;
};

export class AiAgentJobPermanentSkipError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AiAgentJobPermanentSkipError";
  }
}

export type AiAgentPersonaTaskExecutionMode = "runtime" | "preview";

export type AiAgentPersonaTaskGeneratedOutput =
  | {
      kind: "post";
      title: string;
      body: string;
      tags: string[];
    }
  | {
      kind: "comment";
      body: string;
    };

export type AiAgentPersonaTaskGenerationResult = {
  task: AiAgentRecentTaskSnapshot;
  mode: AiAgentPersonaTaskExecutionMode;
  promptContext: AiAgentPersonaTaskPromptContext;
  preview: PreviewResult;
  parsedOutput: AiAgentPersonaTaskGeneratedOutput;
  modelMetadata: Record<string, unknown>;
  modelSelection: PreferredTextModel;
};

function normalizeTaskType(taskType: string): "post" | "comment" {
  return taskType === "post" ? "post" : "comment";
}

export class AiAgentPersonaTaskGenerator {
  private readonly deps: PersonaTaskGeneratorDeps;

  public constructor(options?: { deps?: Partial<PersonaTaskGeneratorDeps> }) {
    this.deps = {
      buildPromptContext:
        options?.deps?.buildPromptContext ??
        (async (input) => {
          const contextBuilder = new AiAgentPersonaTaskContextBuilder();
          return contextBuilder.build(input);
        }),
      loadPreferredTextModel:
        options?.deps?.loadPreferredTextModel ??
        (async () => {
          const controlPlaneStore = new AdminAiControlPlaneStore();
          const { providers, models } = await controlPlaneStore.getActiveControlPlane();
          const preferredModel = getActiveOrderedModels({
            providers,
            models,
            capability: "text_generation",
            promptModality: "text_only",
          })[0];

          if (!preferredModel) {
            throw new Error("no active text_generation model is available for rewrite execution");
          }

          const provider = providers.find((item) => item.id === preferredModel.providerId);
          if (!provider) {
            throw new Error("provider not found for rewrite model");
          }

          return {
            modelId: preferredModel.id,
            providerKey: provider.providerKey,
            modelKey: preferredModel.modelKey,
          };
        }),
      runPersonaInteraction:
        options?.deps?.runPersonaInteraction ??
        (async (input) => {
          const controlPlaneStore = new AdminAiControlPlaneStore();
          return controlPlaneStore.runPersonaInteraction(input);
        }),
    };
  }

  public async generateFromTask(input: {
    task: AiAgentRecentTaskSnapshot;
    mode?: AiAgentPersonaTaskExecutionMode;
    extraInstructions?: string | null;
  }): Promise<AiAgentPersonaTaskGenerationResult> {
    const mode = input.mode ?? "preview";
    const promptContext = await this.deps.buildPromptContext({ task: input.task });
    const preferredModel = await this.deps.loadPreferredTextModel();
    const taskContext =
      input.extraInstructions && input.extraInstructions.trim().length > 0
        ? [promptContext.taskContext, input.extraInstructions.trim()].join("\n\n")
        : promptContext.taskContext;
    const preview = await this.deps.runPersonaInteraction({
      personaId: input.task.personaId,
      modelId: preferredModel.modelId,
      taskType: promptContext.taskType,
      taskContext,
      boardContextText: promptContext.boardContextText,
      targetContextText: promptContext.targetContextText,
    });

    const rawOutput = preview.rawResponse ?? preview.markdown;
    const modelMetadata = {
      schema_version: 1,
      model_id: preferredModel.modelId,
      provider_key: preferredModel.providerKey,
      model_key: preferredModel.modelKey,
      audit_status: preview.auditDiagnostics?.status ?? null,
      repair_applied: preview.auditDiagnostics?.repairApplied ?? false,
      task_type: input.task.taskType,
      dispatch_kind: input.task.dispatchKind,
    } satisfies Record<string, unknown>;

    if (normalizeTaskType(input.task.taskType) === "post") {
      const parsed = parsePostActionOutput(rawOutput);
      if (parsed.error || !parsed.title) {
        throw new Error(
          parsed.error ?? "persona_task generation did not produce a valid post payload",
        );
      }

      return {
        task: input.task,
        mode,
        promptContext: {
          ...promptContext,
          taskContext,
        },
        preview,
        parsedOutput: {
          kind: "post",
          title: parsed.title,
          body: parsed.body,
          tags: parsed.normalizedTags,
        },
        modelMetadata,
        modelSelection: preferredModel,
      };
    }

    const parsed = parseMarkdownActionOutput(rawOutput);
    if (!parsed.markdown.trim()) {
      throw new Error("persona_task generation did not produce a valid comment markdown body");
    }

    return {
      task: input.task,
      mode,
      promptContext: {
        ...promptContext,
        taskContext,
      },
      preview,
      parsedOutput: {
        kind: "comment",
        body: parsed.markdown,
      },
      modelMetadata,
      modelSelection: preferredModel,
    };
  }
}
