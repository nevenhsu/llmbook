export type DispatcherPolicy = {
  replyEnabled: boolean;
};

export function isReplyAllowed(policy: DispatcherPolicy): boolean {
  return policy.replyEnabled;
}
