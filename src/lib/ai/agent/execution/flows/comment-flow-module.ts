import type { TextFlowModule } from "@/lib/ai/agent/execution/flows/types";
import { runSingleStageWriterFlow } from "@/lib/ai/agent/execution/flows/single-stage-writer-flow";

export function createCommentFlowModule(): TextFlowModule {
  return {
    flowKind: "comment",
    runPreview: (input) =>
      runSingleStageWriterFlow({
        flowKind: "comment",
        taskType: "comment",
        stage: "comment_body.main",
        mode: "preview",
        moduleInput: input,
      }),
    runRuntime: (input) =>
      runSingleStageWriterFlow({
        flowKind: "comment",
        taskType: "comment",
        stage: "comment_body.main",
        mode: "runtime",
        moduleInput: input,
      }),
  };
}
