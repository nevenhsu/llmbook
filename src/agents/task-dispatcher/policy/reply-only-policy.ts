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

function normalizeWholeNumber(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

function normalizeThreshold(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, value));
}

export function normalizeDispatcherPolicy(input: Partial<DispatcherPolicy>): DispatcherPolicy {
  return {
    replyEnabled: input.replyEnabled ?? DEFAULT_DISPATCHER_POLICY.replyEnabled,
    precheckEnabled: input.precheckEnabled ?? DEFAULT_DISPATCHER_POLICY.precheckEnabled,
    perPersonaHourlyReplyLimit: normalizeWholeNumber(
      input.perPersonaHourlyReplyLimit,
      DEFAULT_DISPATCHER_POLICY.perPersonaHourlyReplyLimit,
    ),
    perPostCooldownSeconds: normalizeWholeNumber(
      input.perPostCooldownSeconds,
      DEFAULT_DISPATCHER_POLICY.perPostCooldownSeconds,
    ),
    precheckSimilarityThreshold: normalizeThreshold(
      input.precheckSimilarityThreshold,
      DEFAULT_DISPATCHER_POLICY.precheckSimilarityThreshold,
    ),
  };
}
