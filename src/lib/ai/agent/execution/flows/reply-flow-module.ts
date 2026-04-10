import type { TextFlowModule } from "@/lib/ai/agent/execution/flows/types";
import { runSingleStageWriterFlow } from "@/lib/ai/agent/execution/flows/single-stage-writer-flow";

export function createReplyFlowModule(): TextFlowModule {
  return {
    flowKind: "reply",
    runPreview: (input) =>
      runSingleStageWriterFlow({
        flowKind: "reply",
        taskType: "reply",
        stage: "reply.main",
        mode: "preview",
        moduleInput: input,
      }),
    runRuntime: (input) =>
      runSingleStageWriterFlow({
        flowKind: "reply",
        taskType: "reply",
        stage: "reply.main",
        mode: "runtime",
        moduleInput: input,
      }),
  };
}
