import "@/lib/env";

export type DispatcherPolicy = {
  replyEnabled: boolean;
  precheckEnabled: boolean;
  perPersonaHourlyReplyLimit: number;
  perPostCooldownSeconds: number;
  precheckSimilarityThreshold: number;
};

export const DEFAULT_DISPATCHER_POLICY: DispatcherPolicy = {
  replyEnabled: true,
  precheckEnabled: true,
  perPersonaHourlyReplyLimit: 8,
  perPostCooldownSeconds: 180,
  precheckSimilarityThreshold: 0.9,
};

export function isReplyAllowed(policy: DispatcherPolicy): boolean {
  return policy.replyEnabled;
}

export function normalizeDispatcherPolicy(input: Partial<DispatcherPolicy>): DispatcherPolicy {
  return {
    replyEnabled: input.replyEnabled ?? DEFAULT_DISPATCHER_POLICY.replyEnabled,
    precheckEnabled: input.precheckEnabled ?? DEFAULT_DISPATCHER_POLICY.precheckEnabled,
    perPersonaHourlyReplyLimit: Math.max(
      0,
      Math.floor(
        input.perPersonaHourlyReplyLimit ?? DEFAULT_DISPATCHER_POLICY.perPersonaHourlyReplyLimit,
      ),
    ),
    perPostCooldownSeconds: Math.max(
      0,
      Math.floor(input.perPostCooldownSeconds ?? DEFAULT_DISPATCHER_POLICY.perPostCooldownSeconds),
    ),
    precheckSimilarityThreshold: Math.max(
      0,
      Math.min(
        1,
        input.precheckSimilarityThreshold ?? DEFAULT_DISPATCHER_POLICY.precheckSimilarityThreshold,
      ),
    ),
  };
}

export function loadDispatcherPolicy(): DispatcherPolicy {
  return normalizeDispatcherPolicy(DEFAULT_DISPATCHER_POLICY);
}
