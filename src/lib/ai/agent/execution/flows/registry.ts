import { parsePostActionOutput } from "@/lib/ai/prompt-runtime/action-output";
import {
  buildModuleMetadata,
  buildPassedSingleStageDiagnostics,
  mergeFlowTaskContext,
  type TextFlowKind,
  type TextFlowModule,
  type TextFlowModuleRunInput,
  type TextFlowModuleRunResult,
} from "@/lib/ai/agent/execution/flows/types";
import { createCommentFlowModule } from "@/lib/ai/agent/execution/flows/comment-flow-module";
import { createReplyFlowModule } from "@/lib/ai/agent/execution/flows/reply-flow-module";

async function runLegacyPostFlow(
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
    taskType: "post",
    taskContext: promptContext.taskContext,
    boardContextText: promptContext.boardContextText,
    targetContextText: promptContext.targetContextText,
  });
  const parsed = parsePostActionOutput(preview.rawResponse ?? preview.markdown);
  if (parsed.error || !parsed.title) {
    throw new Error(parsed.error ?? "post flow did not produce a valid post payload");
  }

  return {
    promptContext,
    preview,
    flowResult: {
      flowKind: "post",
      parsed: {
        selectedPostPlan: {
          title: parsed.title,
          angleSummary: "",
          thesis: "",
          bodyOutline: [],
          differenceFromRecent: [],
        },
        postBody: {
          body: parsed.body,
          tags: parsed.normalizedTags,
          needImage: parsed.imageRequest.needImage,
          imagePrompt: parsed.imageRequest.imagePrompt,
          imageAlt: parsed.imageRequest.imageAlt,
        },
        renderedPost: {
          title: parsed.title,
          body: parsed.body,
          tags: parsed.normalizedTags,
          needImage: parsed.imageRequest.needImage,
          imagePrompt: parsed.imageRequest.imagePrompt,
          imageAlt: parsed.imageRequest.imageAlt,
        },
      },
      diagnostics: {
        ...buildPassedSingleStageDiagnostics(stage),
        gate: {
          attempted: false,
          passedCandidateIndexes: [],
          selectedCandidateIndex: null,
        },
      },
    },
    modelSelection,
    modelMetadata: buildModuleMetadata({
      modelSelection,
      preview,
      task: input.task,
      flowKind: "post",
    }),
  };
}

function createLegacyPostFlowModule(): TextFlowModule {
  return {
    flowKind: "post",
    runPreview: (input) => runLegacyPostFlow(input, "post.main"),
    runRuntime: (input) => runLegacyPostFlow(input, "post.main"),
  };
}

const REGISTRY: Record<TextFlowKind, TextFlowModule> = {
  post: createLegacyPostFlowModule(),
  comment: createCommentFlowModule(),
  reply: createReplyFlowModule(),
};

export function resolveTextFlowModule(flowKind: TextFlowKind): TextFlowModule {
  return REGISTRY[flowKind];
}
