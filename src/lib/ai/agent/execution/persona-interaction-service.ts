import type {
  AiControlPlaneDocument,
  AiModelConfig,
  AiProviderConfig,
  PersonaProfile,
  PreviewResult,
  PromptBoardContext,
  PromptTargetContext,
} from "@/lib/ai/admin/control-plane-contract";
import type { PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";
import type { ContentMode } from "@/lib/ai/core/persona-core-v2";
import { parsePersonaCoreV2 } from "@/lib/ai/core/persona-core-v2";
import type { PromptPersonaEvidence } from "@/lib/ai/prompt-runtime/persona-audit-shared";
import { runPersonaInteractionStage } from "@/lib/ai/agent/execution/persona-interaction-stage-service";
import { resolveTextFlowModule } from "@/lib/ai/agent/execution/flows/registry";
import type { AiAgentPersonaTaskPromptContext } from "@/lib/ai/agent/execution/persona-task-context-builder";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import { formatBoardContext, formatTargetContext } from "@/lib/ai/admin/control-plane-shared";
import { markdownToEditorHtml } from "@/lib/tiptap-markdown";
import { TextFlowExecutionError } from "@/lib/ai/agent/execution/flows/types";

export type AiAgentPersonaInteractionInput = {
  personaId: string;
  modelId: string;
  taskType: PromptActionType;
  taskContext: string;
  boardContext?: PromptBoardContext;
  targetContext?: PromptTargetContext;
  boardContextText?: string;
  targetContextText?: string;
  document: AiControlPlaneDocument;
  providers: AiProviderConfig[];
  models: AiModelConfig[];
  getPersonaProfile: (personaId: string) => Promise<PersonaProfile>;
  recordLlmInvocationError: (input: {
    providerKey: string;
    modelKey: string;
    error: string;
    errorDetails?: {
      statusCode?: number;
      code?: string;
      type?: string;
      body?: string;
    };
  }) => Promise<void>;
  debug?: boolean;
  contentMode?: ContentMode;
};

type UserFacingInteractionTaskType = "post" | "comment" | "reply";

function isUserFacingInteractionTaskType(
  taskType: PromptActionType,
): taskType is UserFacingInteractionTaskType {
  return taskType === "post" || taskType === "comment" || taskType === "reply";
}

function buildPreviewTask(input: {
  personaId: string;
  taskType: "post" | "comment" | "reply";
  profile: PersonaProfile;
  payload: Record<string, unknown>;
}): AiAgentRecentTaskSnapshot {
  const now = new Date().toISOString();
  return {
    id: "interaction-preview",
    personaId: input.personaId,
    personaUsername: input.profile.persona.username,
    personaDisplayName: input.profile.persona.display_name,
    taskType: input.taskType,
    dispatchKind: "preview",
    sourceTable: null,
    sourceId: null,
    dedupeKey: null,
    cooldownUntil: null,
    payload: input.payload,
    status: "PENDING",
    scheduledAt: now,
    startedAt: null,
    completedAt: null,
    retryCount: 0,
    maxRetries: 0,
    leaseOwner: null,
    leaseUntil: null,
    resultId: null,
    resultType: null,
    errorMessage: null,
    createdAt: now,
  };
}

function buildPreviewPersonaEvidence(profile: PersonaProfile): PromptPersonaEvidence {
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
}

function renderFlowMarkdown(
  flowResult: Awaited<
    ReturnType<ReturnType<typeof resolveTextFlowModule>["runPreview"]>
  >["flowResult"],
): string {
  if (flowResult.flowKind === "post") {
    const post = flowResult.parsed.renderedPost;
    return [
      post.title ? `# ${post.title}` : null,
      post.tags.join(" ").trim() || null,
      post.body.trim(),
    ]
      .filter((part): part is string => Boolean(part))
      .join("\n\n")
      .trim();
  }

  if (flowResult.flowKind === "comment") {
    return flowResult.parsed.comment.markdown.trim();
  }

  return flowResult.parsed.reply.markdown.trim();
}

export class AiAgentPersonaInteractionService {
  public async run(input: AiAgentPersonaInteractionInput): Promise<PreviewResult> {
    if (isUserFacingInteractionTaskType(input.taskType)) {
      const profile = await input.getPersonaProfile(input.personaId);
      const model = input.models.find((item) => item.id === input.modelId);
      if (!model) {
        throw new Error("model not found");
      }
      const provider = input.providers.find((item) => item.id === model.providerId);
      if (!provider) {
        throw new Error("provider not found");
      }

      const promptContext: AiAgentPersonaTaskPromptContext = {
        flowKind: input.taskType,
        taskType: input.taskType === "post" ? "post" : "comment",
        taskContext: input.taskContext,
        boardContextText: input.boardContextText ?? formatBoardContext(input.boardContext),
        targetContextText:
          input.targetContextText ??
          formatTargetContext({
            taskType: input.taskType,
            targetContext: input.targetContext,
          }),
      };
      const task = buildPreviewTask({
        personaId: input.personaId,
        taskType: input.taskType,
        profile,
        payload: {
          taskContext: input.taskContext,
          boardContext: input.boardContext,
          targetContext: input.targetContext,
          boardContextText: input.boardContextText,
          targetContextText: input.targetContextText,
        },
      });
      const flowModule = resolveTextFlowModule(input.taskType);
      let result;
      try {
        result = await flowModule.runPreview({
          task,
          promptContext,
          loadPreferredTextModel: async () => ({
            modelId: model.id,
            providerKey: provider.providerKey,
            modelKey: model.modelKey,
          }),
          runPersonaInteractionStage: async (stageInput) =>
            runPersonaInteractionStage({
              ...stageInput,
              document: input.document,
              providers: input.providers,
              models: input.models,
              getPersonaProfile: input.getPersonaProfile,
              recordLlmInvocationError: input.recordLlmInvocationError,
            }),
          personaEvidence: buildPreviewPersonaEvidence(profile),
          debug: input.debug,
        });
      } catch (error) {
        if (error instanceof TextFlowExecutionError) {
          return {
            assembledPrompt: "",
            markdown: "",
            rawResponse: null,
            renderOk: false,
            renderError: error.message,
            tokenBudget: {
              estimatedInputTokens: 0,
              maxInputTokens: 0,
              maxOutputTokens: 0,
              blockStats: [],
              compressedStages: [],
              exceeded: false,
              message: null,
            },
            stageDebugRecords: error.stageDebugRecords,
          };
        }
        throw error;
      }

      const markdown = renderFlowMarkdown(result.flowResult);

      try {
        markdownToEditorHtml(markdown);
        return {
          ...result.preview,
          assembledPrompt: "",
          markdown,
          stageDebugRecords: result.stageDebugRecords,
          renderOk: true,
          renderError: null,
        };
      } catch (error) {
        return {
          ...result.preview,
          assembledPrompt: "",
          markdown,
          stageDebugRecords: result.stageDebugRecords,
          renderOk: false,
          renderError: error instanceof Error ? error.message : "render validation failed",
        };
      }
    }

    const preview = await runPersonaInteractionStage({
      personaId: input.personaId,
      modelId: input.modelId,
      taskType: input.taskType,
      stagePurpose: "main",
      taskContext: input.taskContext,
      boardContext: input.boardContext,
      targetContext: input.targetContext,
      boardContextText: input.boardContextText,
      targetContextText: input.targetContextText,
      document: input.document,
      providers: input.providers,
      models: input.models,
      getPersonaProfile: input.getPersonaProfile,
      recordLlmInvocationError: input.recordLlmInvocationError,
      debug: input.debug,
      attemptLabel: `${input.taskType}.main`,
      contentMode: input.contentMode,
    });
    const markdown = renderRawStagePreviewMarkdown(preview.rawResponse ?? preview.markdown);

    try {
      markdownToEditorHtml(markdown);
      return {
        ...preview,
        markdown,
        renderOk: true,
        renderError: null,
      };
    } catch (error) {
      return {
        ...preview,
        markdown,
        renderOk: false,
        renderError: error instanceof Error ? error.message : "render validation failed",
      };
    }
  }
}

function renderRawStagePreviewMarkdown(rawText: string): string {
  return rawText.trim();
}

export async function runPersonaInteraction(
  input: AiAgentPersonaInteractionInput,
): Promise<PreviewResult> {
  return new AiAgentPersonaInteractionService().run(input);
}
