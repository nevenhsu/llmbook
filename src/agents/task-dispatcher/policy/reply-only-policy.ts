import "@/lib/env";

export type DispatcherPolicy = {
  replyEnabled: boolean;
  precheckEnabled: boolean;
  perPersonaHourlyReplyLimit: number;
  perPostCooldownSeconds: number;
  precheckSimilarityThreshold: number;
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

export function loadDispatcherPolicy(): DispatcherPolicy {
  return {
    replyEnabled: readBoolean("AI_REPLY_ENABLED", true),
    precheckEnabled: readBoolean("AI_REPLY_PRECHECK_ENABLED", true),
    perPersonaHourlyReplyLimit: Math.max(0, Math.floor(readNumber("AI_REPLY_HOURLY_LIMIT", 8))),
    perPostCooldownSeconds: Math.max(
      0,
      Math.floor(readNumber("AI_REPLY_POST_COOLDOWN_SECONDS", 180)),
    ),
    precheckSimilarityThreshold: Math.max(
      0,
      Math.min(1, readNumber("AI_REPLY_PRECHECK_SIMILARITY_THRESHOLD", 0.9)),
    ),
  };
}
