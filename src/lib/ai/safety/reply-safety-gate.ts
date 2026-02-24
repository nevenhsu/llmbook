export type SafetyGateResult = {
  allowed: boolean;
  reasonCode?: string;
  reason?: string;
};

export type ReplySafetyContext = {
  recentPersonaReplies?: string[];
};

export interface ReplySafetyGate {
  check(input: { text: string; context?: ReplySafetyContext }): Promise<SafetyGateResult>;
}

export class AllowAllReplySafetyGate implements ReplySafetyGate {
  public async check(): Promise<SafetyGateResult> {
    return { allowed: true };
  }
}

export const ReplySafetyReasonCode = {
  emptyText: "SAFETY_EMPTY_TEXT",
  tooLong: "SAFETY_TOO_LONG",
  spamPattern: "SAFETY_SPAM_PATTERN",
  similarToRecentReply: "SAFETY_SIMILAR_TO_RECENT_REPLY",
} as const;

type RuleBasedReplySafetyGateOptions = {
  maxLength?: number;
  similarityThreshold?: number;
};

function normalizeForSimilarity(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(input: string): Set<string> {
  const normalized = normalizeForSimilarity(input);
  if (!normalized) {
    return new Set<string>();
  }
  return new Set(normalized.split(" "));
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenSet(a);
  const setB = tokenSet(b);

  if (setA.size === 0 && setB.size === 0) {
    return 1;
  }
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export class RuleBasedReplySafetyGate implements ReplySafetyGate {
  private readonly maxLength: number;
  private readonly similarityThreshold: number;

  public constructor(options: RuleBasedReplySafetyGateOptions = {}) {
    this.maxLength = options.maxLength ?? 1800;
    this.similarityThreshold = options.similarityThreshold ?? 0.9;
  }

  public async check(input: {
    text: string;
    context?: ReplySafetyContext;
  }): Promise<SafetyGateResult> {
    const text = input.text.trim();

    if (!text) {
      return {
        allowed: false,
        reasonCode: ReplySafetyReasonCode.emptyText,
        reason: "reply text is empty",
      };
    }

    if (text.length > this.maxLength) {
      return {
        allowed: false,
        reasonCode: ReplySafetyReasonCode.tooLong,
        reason: `reply text exceeds ${this.maxLength} chars`,
      };
    }

    if (/(.)\1{11,}/.test(text)) {
      return {
        allowed: false,
        reasonCode: ReplySafetyReasonCode.spamPattern,
        reason: "detected repeated-character spam pattern",
      };
    }

    const recentReplies = input.context?.recentPersonaReplies ?? [];
    for (const candidate of recentReplies) {
      const similarity = jaccardSimilarity(text, candidate);
      if (similarity >= this.similarityThreshold) {
        return {
          allowed: false,
          reasonCode: ReplySafetyReasonCode.similarToRecentReply,
          reason: `similarity ${similarity.toFixed(2)} >= ${this.similarityThreshold}`,
        };
      }
    }

    return { allowed: true };
  }
}
