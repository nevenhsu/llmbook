import { AdminAiControlPlaneStore, type PreviewResult } from "@/lib/ai/admin/control-plane-store";
import { getActiveOrderedModels } from "@/lib/ai/admin/active-model-order";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import {
  AiAgentPersonaTaskContextBuilder,
  type AiAgentPersonaTaskPromptContext,
} from "@/lib/ai/agent/execution/persona-task-context-builder";
import { resolveTextFlowModule } from "@/lib/ai/agent/execution/flows/registry";
import type {
  PreferredTextModel,
  TextFlowKind,
  TextFlowModule,
  TextFlowRunResult,
} from "@/lib/ai/agent/execution/flows/types";

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
  resolveFlowModule: (flowKind: TextFlowKind) => TextFlowModule;
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
  flowResult: TextFlowRunResult;
  parsedOutput: AiAgentPersonaTaskGeneratedOutput;
  modelMetadata: Record<string, unknown>;
  modelSelection: PreferredTextModel;
};

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
      resolveFlowModule:
        options?.deps?.resolveFlowModule ?? ((flowKind) => resolveTextFlowModule(flowKind)),
    };
  }

  public async generateFromTask(input: {
    task: AiAgentRecentTaskSnapshot;
    mode?: AiAgentPersonaTaskExecutionMode;
    extraInstructions?: string | null;
  }): Promise<AiAgentPersonaTaskGenerationResult> {
    const mode = input.mode ?? "preview";
    const promptContext = await this.deps.buildPromptContext({ task: input.task });
    const flowModule = this.deps.resolveFlowModule(promptContext.flowKind);
    const executionResult =
      mode === "runtime"
        ? await flowModule.runRuntime({
            task: input.task,
            promptContext,
            extraInstructions: input.extraInstructions,
            loadPreferredTextModel: this.deps.loadPreferredTextModel,
            runPersonaInteraction: this.deps.runPersonaInteraction,
          })
        : await flowModule.runPreview({
            task: input.task,
            promptContext,
            extraInstructions: input.extraInstructions,
            loadPreferredTextModel: this.deps.loadPreferredTextModel,
            runPersonaInteraction: this.deps.runPersonaInteraction,
          });

    const parsedOutput = mapFlowResultToLegacyOutput(executionResult.flowResult);

    return {
      task: input.task,
      mode,
      promptContext: executionResult.promptContext,
      preview: executionResult.preview,
      flowResult: executionResult.flowResult,
      parsedOutput,
      modelMetadata: executionResult.modelMetadata,
      modelSelection: executionResult.modelSelection,
    };
  }
}

function mapFlowResultToLegacyOutput(
  flowResult: TextFlowRunResult,
): AiAgentPersonaTaskGeneratedOutput {
  if (flowResult.flowKind === "post") {
    return {
      kind: "post",
      title: flowResult.parsed.renderedPost.title,
      body: flowResult.parsed.renderedPost.body,
      tags: flowResult.parsed.renderedPost.tags,
    };
  }

  if (flowResult.flowKind === "comment") {
    return {
      kind: "comment",
      body: flowResult.parsed.comment.markdown,
    };
  }

  return {
    kind: "comment",
    body: flowResult.parsed.reply.markdown,
  };
}
