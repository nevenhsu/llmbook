import { AdminAiControlPlaneStore, type PreviewResult } from "@/lib/ai/admin/control-plane-store";
import { getActiveOrderedModels } from "@/lib/ai/admin/active-model-order";
import type { TaskSnapshot } from "@/lib/ai/agent/read-models/task-snapshot";
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
import { parsePersonaCoreV2 } from "@/lib/ai/core/persona-core-v2";
import type { PersonaInteractionFlow, PersonaInteractionStage } from "@/lib/ai/core/persona-core-v2";
import type { PromptPersonaEvidence } from "@/lib/ai/prompt-runtime/persona-audit-shared";

type PersonaTaskGeneratorDeps = {
  buildPromptContext: (input: { task: TaskSnapshot }) => Promise<AiAgentPersonaTaskPromptContext>;
  loadPreferredTextModel: () => Promise<PreferredTextModel>;
  runPersonaInteractionStage: (input: {
    personaId: string;
    modelId: string;
    flow: PersonaInteractionFlow;
    stage: PersonaInteractionStage;
    stagePurpose: "main";
    taskContext: string;
    boardContextText?: string;
    targetContextText?: string;
  }) => Promise<PreviewResult>;
  loadPersonaEvidence: (personaId: string) => Promise<PromptPersonaEvidence>;
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
    }
  | {
      kind: "reply";
      body: string;
    };

export type AiAgentPersonaTaskGenerationResult = {
  task: TaskSnapshot;
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
      runPersonaInteractionStage:
        options?.deps?.runPersonaInteractionStage ??
        (async (input) => {
          const controlPlaneStore = new AdminAiControlPlaneStore();
          return controlPlaneStore.runPersonaInteractionStage(input);
        }),
      loadPersonaEvidence:
        options?.deps?.loadPersonaEvidence ??
        (async (personaId) => {
          const controlPlaneStore = new AdminAiControlPlaneStore();
          const profile = await controlPlaneStore.getPersonaProfile(personaId);
          const personaCoreRaw = profile.personaCore as Record<string, unknown>;
          const { core } = parsePersonaCoreV2(personaCoreRaw);
          return {
            displayName: profile.persona.display_name,
            identity: core.identity.archetype,
            referenceSourceNames: core.reference_style.reference_names,
            doctrine: {
              valueFit: core.taste.values,
              reasoningFit: [
                core.mind.reasoning_style,
                ...core.mind.thinking_procedure.salience_rules.slice(0, 2),
              ],
              discourseFit: [
                core.forum.participation_mode,
                ...core.forum.preferred_comment_intents.slice(0, 2),
              ],
              expressionFit: [core.voice.register, core.voice.rhythm],
            },
          };
        }),
      resolveFlowModule:
        options?.deps?.resolveFlowModule ?? ((flowKind) => resolveTextFlowModule(flowKind)),
    };
  }

  public async generateFromTask(input: {
    task: TaskSnapshot;
    mode?: AiAgentPersonaTaskExecutionMode;
    extraInstructions?: string | null;
  }): Promise<AiAgentPersonaTaskGenerationResult> {
    const mode = input.mode ?? "preview";
    const promptContext = await this.deps.buildPromptContext({ task: input.task });
    const flowModule = this.deps.resolveFlowModule(promptContext.flowKind);
    const personaEvidence = await this.deps.loadPersonaEvidence(input.task.personaId);
    const executionResult =
      mode === "runtime"
        ? await flowModule.runRuntime({
            task: input.task,
            promptContext,
            extraInstructions: input.extraInstructions,
            loadPreferredTextModel: this.deps.loadPreferredTextModel,
            runPersonaInteractionStage: this.deps.runPersonaInteractionStage,
            personaEvidence,
          })
        : await flowModule.runPreview({
            task: input.task,
            promptContext,
            extraInstructions: input.extraInstructions,
            loadPreferredTextModel: this.deps.loadPreferredTextModel,
            runPersonaInteractionStage: this.deps.runPersonaInteractionStage,
            personaEvidence,
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
    kind: "reply",
    body: flowResult.parsed.reply.markdown,
  };
}
