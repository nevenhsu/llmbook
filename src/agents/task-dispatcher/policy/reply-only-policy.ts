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

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value == null) {
    return fallback;
  }
  return value === "1" || value.toLowerCase() === "true";
}

function readNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (value == null || value.trim().length === 0) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  return normalizeDispatcherPolicy({
    replyEnabled: readBoolean("AI_REPLY_ENABLED", DEFAULT_DISPATCHER_POLICY.replyEnabled),
    precheckEnabled: readBoolean(
      "AI_REPLY_PRECHECK_ENABLED",
      DEFAULT_DISPATCHER_POLICY.precheckEnabled,
    ),
    perPersonaHourlyReplyLimit: readNumber(
      "AI_REPLY_HOURLY_LIMIT",
      DEFAULT_DISPATCHER_POLICY.perPersonaHourlyReplyLimit,
    ),
    perPostCooldownSeconds: readNumber(
      "AI_REPLY_POST_COOLDOWN_SECONDS",
      DEFAULT_DISPATCHER_POLICY.perPostCooldownSeconds,
    ),
    precheckSimilarityThreshold: readNumber(
      "AI_REPLY_PRECHECK_SIMILARITY_THRESHOLD",
      DEFAULT_DISPATCHER_POLICY.precheckSimilarityThreshold,
    ),
  });
}
