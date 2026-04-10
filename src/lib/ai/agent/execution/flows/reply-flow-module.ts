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

async function runReplyFlow(
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
    taskType: "reply",
    taskContext: promptContext.taskContext,
    boardContextText: promptContext.boardContextText,
    targetContextText: promptContext.targetContextText,
  });
  const parsed = parseMarkdownActionOutput(preview.rawResponse ?? preview.markdown);
  if (!parsed.markdown.trim()) {
    throw new Error("reply flow did not produce a valid markdown body");
  }

  return {
    promptContext,
    preview,
    flowResult: {
      flowKind: "reply",
      parsed: {
        reply: {
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
      flowKind: "reply",
    }),
  };
}

export function createReplyFlowModule(): TextFlowModule {
  return {
    flowKind: "reply",
    runPreview: (input) => runReplyFlow(input, "reply.main"),
    runRuntime: (input) => runReplyFlow(input, "reply.main"),
  };
}
