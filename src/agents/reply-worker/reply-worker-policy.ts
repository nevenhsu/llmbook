export type ReplyWorkerPolicy = {
  replyEnabled: boolean;
};

export const DEFAULT_REPLY_WORKER_POLICY: ReplyWorkerPolicy = {
  replyEnabled: true,
};

export function normalizeReplyWorkerPolicy(input: Partial<ReplyWorkerPolicy>): ReplyWorkerPolicy {
  return {
    replyEnabled: input.replyEnabled ?? DEFAULT_REPLY_WORKER_POLICY.replyEnabled,
  };
}
