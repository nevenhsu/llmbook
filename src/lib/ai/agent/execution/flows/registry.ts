import { type TextFlowKind, type TextFlowModule } from "@/lib/ai/agent/execution/flows/types";
import { createCommentFlowModule } from "@/lib/ai/agent/execution/flows/comment-flow-module";
import { createPostFlowModule } from "@/lib/ai/agent/execution/flows/post-flow-module";
import { createReplyFlowModule } from "@/lib/ai/agent/execution/flows/reply-flow-module";

const REGISTRY: Record<TextFlowKind, TextFlowModule> = {
  post: createPostFlowModule(),
  comment: createCommentFlowModule(),
  reply: createReplyFlowModule(),
};

export function resolveTextFlowModule(flowKind: TextFlowKind): TextFlowModule {
  return REGISTRY[flowKind];
}
