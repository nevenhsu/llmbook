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
import { runPersonaInteractionStage } from "@/lib/ai/agent/execution/persona-interaction-stage-service";
import {
  parseMarkdownActionOutput,
  parsePostActionOutput,
  parsePostBodyActionOutput,
} from "@/lib/ai/prompt-runtime/action-output";
import { markdownToEditorHtml } from "@/lib/tiptap-markdown";

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
};

export class AiAgentPersonaInteractionService {
  public async run(input: AiAgentPersonaInteractionInput): Promise<PreviewResult> {
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
    });
    const markdown = renderInteractionPreviewMarkdown(
      input.taskType,
      preview.rawResponse ?? preview.markdown,
    );

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

function renderInteractionPreviewMarkdown(taskType: PromptActionType, rawText: string): string {
  if (taskType === "comment" || taskType === "reply") {
    const parsed = parseMarkdownActionOutput(rawText);
    return parsed.output?.markdown?.trim() || rawText.trim();
  }

  if (taskType === "post") {
    const parsed = parsePostActionOutput(rawText);
    if (!parsed.error) {
      return [
        parsed.title ? `# ${parsed.title}` : null,
        parsed.tags.join(" ").trim() || null,
        parsed.body.trim(),
      ]
        .filter((part): part is string => Boolean(part))
        .join("\n\n")
        .trim();
    }
  }

  if (taskType === "post_body") {
    const parsed = parsePostBodyActionOutput(rawText);
    if (!parsed.error) {
      return [parsed.tags.join(" ").trim() || null, parsed.body.trim()]
        .filter((part): part is string => Boolean(part))
        .join("\n\n")
        .trim();
    }
  }

  return rawText.trim();
}

export async function runPersonaInteraction(
  input: AiAgentPersonaInteractionInput,
): Promise<PreviewResult> {
  return new AiAgentPersonaInteractionService().run(input);
}
