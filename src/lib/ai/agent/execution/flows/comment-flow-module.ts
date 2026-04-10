import { parseMarkdownActionOutput } from "@/lib/ai/prompt-runtime/action-output";
import type {
  TextFlowModule,
  TextFlowModuleRunInput,
  TextFlowModuleRunResult,
} from "@/lib/ai/agent/execution/flows/types";
import {
  buildModuleMetadata,
  buildPassedSingleStageDiagnostics,
  mergeFlowTaskContext,
} from "@/lib/ai/agent/execution/flows/types";

async function runCommentFlow(
  input: TextFlowModuleRunInput,
  stage: string,
): Promise<TextFlowModuleRunResult> {
  const promptContext = mergeFlowTaskContext({
    promptContext: input.promptContext,
    extraInstructions: input.extraInstructions,
  });
  const modelSelection = await input.loadPreferredTextModel();
  const preview = await input.runPersonaInteraction({
    personaId: input.task.personaId,
    modelId: modelSelection.modelId,
    taskType: "comment",
    taskContext: promptContext.taskContext,
    boardContextText: promptContext.boardContextText,
    targetContextText: promptContext.targetContextText,
  });
  const parsed = parseMarkdownActionOutput(preview.rawResponse ?? preview.markdown);
  if (!parsed.markdown.trim()) {
    throw new Error("comment flow did not produce a valid markdown body");
  }

  return {
    promptContext,
    preview,
    flowResult: {
      flowKind: "comment",
      parsed: {
        comment: {
          markdown: parsed.markdown,
          needImage: parsed.imageRequest.needImage,
          imagePrompt: parsed.imageRequest.imagePrompt,
          imageAlt: parsed.imageRequest.imageAlt,
        },
      },
      diagnostics: buildPassedSingleStageDiagnostics(stage),
    },
    modelSelection,
    modelMetadata: buildModuleMetadata({
      modelSelection,
      preview,
      task: input.task,
      flowKind: "comment",
    }),
  };
}

export function createCommentFlowModule(): TextFlowModule {
  return {
    flowKind: "comment",
    runPreview: (input) => runCommentFlow(input, "comment.main"),
    runRuntime: (input) => runCommentFlow(input, "comment.main"),
  };
}
