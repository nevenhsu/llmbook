import { SoulReasonCode } from "@/lib/ai/reason-codes";
import { createAdminClient } from "@/lib/supabase/admin";

type SoulValuePriority = 1 | 2 | 3;

export type RuntimeSoulProfile = {
  identityCore: string;
  valueHierarchy: Array<{ value: string; priority: SoulValuePriority }>;
  decisionPolicy: {
    evidenceStandard: string;
    tradeoffStyle: string;
    uncertaintyHandling: string;
    antiPatterns: string[];
    riskPreference: "conservative" | "balanced" | "progressive";
  };
  interactionDoctrine: {
    askVsTellRatio: string;
    feedbackPrinciples: string[];
    collaborationStance: string;
  };
  languageSignature: {
    rhythm: string;
    preferredStructures: string[];
    lexicalTaboos: string[];
  };
  guardrails: {
    hardNo: string[];
    deescalationRules: string[];
  };
};

export type RuntimeSoulSummary = {
  identity: string;
  topValues: string[];
  tradeoffStyle: string;
  riskPreference: "conservative" | "balanced" | "progressive";
  collaborationStance: string;
  rhythm: string;
  guardrailCount: number;
};

export type RuntimeSoulContext = {
  profile: RuntimeSoulProfile;
  summary: RuntimeSoulSummary;
  normalized: boolean;
  source: "db" | "fallback_empty";
};

export type RuntimeSoulReasonCodeValue = (typeof SoulReasonCode)[keyof typeof SoulReasonCode];

export type RuntimeSoulAuditEvent = {
  layer: "soul_runtime" | "generation" | "dispatch_precheck";
  operation: "LOAD" | "FALLBACK" | "APPLY";
  reasonCode: RuntimeSoulReasonCodeValue;
  entityId: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
};

export interface RuntimeSoulEventSink {
  record(event: RuntimeSoulAuditEvent): Promise<void>;
}

export class InMemoryRuntimeSoulEventSink implements RuntimeSoulEventSink {
  public readonly events: RuntimeSoulAuditEvent[] = [];

  public async record(event: RuntimeSoulAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

type RuntimeSoulDeps = {
  getSoulProfile: (input: { personaId: string }) => Promise<unknown>;
  eventSink?: RuntimeSoulEventSink;
};

type CacheEntry<T> = {
  value: T;
  expiresAtMs: number;
};

type PersonaSoulRow = {
  soul_profile: unknown;
};

export type RuntimeSoulProviderStatus = {
  ttlMs: number;
  personas: Record<string, RuntimeSoulPersonaStatus>;
  lastFallbackEvent: RuntimeSoulAuditEvent | null;
  lastAppliedEvent: RuntimeSoulAuditEvent | null;
};

export type RuntimeSoulPersonaStatus = {
  cacheExpiresAt: string | null;
  lastReasonCode: RuntimeSoulReasonCodeValue | null;
  lastLoadError: string | null;
  lastOccurredAt: string | null;
  lastSummary: RuntimeSoulSummary | null;
};

const DEFAULT_TTL_MS = 30_000;
const DEFAULT_SOUL_PROFILE: RuntimeSoulProfile = {
  identityCore: "A pragmatic collaborator who keeps discussion constructive and useful.",
  valueHierarchy: [
    { value: "clarity", priority: 1 },
    { value: "accuracy", priority: 2 },
    { value: "forward progress", priority: 3 },
  ],
  decisionPolicy: {
    evidenceStandard: "medium",
    tradeoffStyle: "balanced",
    uncertaintyHandling: "state assumptions and suggest a safe next step",
    antiPatterns: ["overconfident claims", "false certainty"],
    riskPreference: "balanced",
  },
  interactionDoctrine: {
    askVsTellRatio: "balanced",
    feedbackPrinciples: ["identify assumptions", "compare trade-offs", "propose next step"],
    collaborationStance: "coach",
  },
  languageSignature: {
    rhythm: "concise",
    preferredStructures: ["context", "analysis", "next step"],
    lexicalTaboos: [],
  },
  guardrails: {
    hardNo: ["fabricate facts", "unsafe instructions"],
    deescalationRules: ["acknowledge uncertainty and reduce risk"],
  },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = item.replace(/\s+/g, " ").trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(normalized);
  }

  return unique.length > 0 ? unique : fallback;
}

function normalizePriority(value: unknown): SoulValuePriority | null {
  if (value === 1 || value === 2 || value === 3) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 1) return 1;
    if (value >= 3) return 3;
    return 2;
  }
  return null;
}

function deriveRiskPreference(input: {
  riskPreference?: unknown;
  tradeoffStyle: string;
}): "conservative" | "balanced" | "progressive" {
  const explicit =
    typeof input.riskPreference === "string" ? input.riskPreference.trim().toLowerCase() : "";
  if (explicit === "conservative" || explicit === "balanced" || explicit === "progressive") {
    return explicit;
  }

  const style = input.tradeoffStyle.toLowerCase();
  if (style.includes("safe") || style.includes("conservative") || style.includes("risk-averse")) {
    return "conservative";
  }
  if (style.includes("bold") || style.includes("aggressive") || style.includes("explore")) {
    return "progressive";
  }
  return "balanced";
}

export function normalizeSoulProfile(input: unknown): {
  profile: RuntimeSoulProfile;
  normalized: boolean;
} {
  const source = asRecord(input);
  if (!source) {
    return { profile: DEFAULT_SOUL_PROFILE, normalized: true };
  }

  const valueHierarchyRaw = Array.isArray(source.valueHierarchy) ? source.valueHierarchy : [];
  const valueHierarchy: Array<{ value: string; priority: SoulValuePriority }> = [];
  for (const item of valueHierarchyRaw) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }

    const value = typeof record.value === "string" ? record.value.replace(/\s+/g, " ").trim() : "";
    const priority = normalizePriority(record.priority);
    if (!value || !priority) {
      continue;
    }
    valueHierarchy.push({ value, priority });
  }

  valueHierarchy.sort((a, b) => a.priority - b.priority || a.value.localeCompare(b.value));

  const decisionPolicy = asRecord(source.decisionPolicy);
  const interactionDoctrine = asRecord(source.interactionDoctrine);
  const languageSignature = asRecord(source.languageSignature);
  const guardrails = asRecord(source.guardrails);

  const tradeoffStyle = normalizeText(
    decisionPolicy?.tradeoffStyle,
    DEFAULT_SOUL_PROFILE.decisionPolicy.tradeoffStyle,
  );

  const profile: RuntimeSoulProfile = {
    identityCore: normalizeText(source.identityCore, DEFAULT_SOUL_PROFILE.identityCore),
    valueHierarchy:
      valueHierarchy.length > 0 ? valueHierarchy.slice(0, 6) : DEFAULT_SOUL_PROFILE.valueHierarchy,
    decisionPolicy: {
      evidenceStandard: normalizeText(
        decisionPolicy?.evidenceStandard,
        DEFAULT_SOUL_PROFILE.decisionPolicy.evidenceStandard,
      ),
      tradeoffStyle,
      uncertaintyHandling: normalizeText(
        decisionPolicy?.uncertaintyHandling,
        DEFAULT_SOUL_PROFILE.decisionPolicy.uncertaintyHandling,
      ),
      antiPatterns: normalizeStringArray(
        decisionPolicy?.antiPatterns,
        DEFAULT_SOUL_PROFILE.decisionPolicy.antiPatterns,
      ),
      riskPreference: deriveRiskPreference({
        riskPreference: decisionPolicy?.riskPreference,
        tradeoffStyle,
      }),
    },
    interactionDoctrine: {
      askVsTellRatio: normalizeText(
        interactionDoctrine?.askVsTellRatio,
        DEFAULT_SOUL_PROFILE.interactionDoctrine.askVsTellRatio,
      ),
      feedbackPrinciples: normalizeStringArray(
        interactionDoctrine?.feedbackPrinciples,
        DEFAULT_SOUL_PROFILE.interactionDoctrine.feedbackPrinciples,
      ),
      collaborationStance: normalizeText(
        interactionDoctrine?.collaborationStance,
        DEFAULT_SOUL_PROFILE.interactionDoctrine.collaborationStance,
      ),
    },
    languageSignature: {
      rhythm: normalizeText(
        languageSignature?.rhythm,
        DEFAULT_SOUL_PROFILE.languageSignature.rhythm,
      ),
      preferredStructures: normalizeStringArray(
        languageSignature?.preferredStructures,
        DEFAULT_SOUL_PROFILE.languageSignature.preferredStructures,
      ),
      lexicalTaboos: normalizeStringArray(languageSignature?.lexicalTaboos, []),
    },
    guardrails: {
      hardNo: normalizeStringArray(guardrails?.hardNo, DEFAULT_SOUL_PROFILE.guardrails.hardNo),
      deescalationRules: normalizeStringArray(
        guardrails?.deescalationRules,
        DEFAULT_SOUL_PROFILE.guardrails.deescalationRules,
      ),
    },
  };

  const normalized = JSON.stringify(profile) !== JSON.stringify(source);
  return { profile, normalized };
}

export function summarizeSoulProfile(profile: RuntimeSoulProfile): RuntimeSoulSummary {
  return {
    identity: profile.identityCore,
    topValues: profile.valueHierarchy
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 3)
      .map((entry) => entry.value),
    tradeoffStyle: profile.decisionPolicy.tradeoffStyle,
    riskPreference: profile.decisionPolicy.riskPreference,
    collaborationStance: profile.interactionDoctrine.collaborationStance,
    rhythm: profile.languageSignature.rhythm,
    guardrailCount: profile.guardrails.hardNo.length + profile.guardrails.deescalationRules.length,
  };
}

function createSupabaseRuntimeSoulDeps(): RuntimeSoulDeps {
  return {
    getSoulProfile: async ({ personaId }) => {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("persona_souls")
        .select("soul_profile")
        .eq("persona_id", personaId)
        .limit(1)
        .maybeSingle<PersonaSoulRow>();

      if (error) {
        throw new Error(`load persona soul failed: ${error.message}`);
      }

      return data?.soul_profile ?? null;
    },
  };
}

export class CachedRuntimeSoulProvider {
  private readonly deps: RuntimeSoulDeps;
  private readonly ttlMs: number;
  private readonly now: () => Date;

  private cache = new Map<string, CacheEntry<RuntimeSoulContext>>();

  private personaStatus = new Map<string, RuntimeSoulPersonaStatus>();
  private lastFallbackEvent: RuntimeSoulAuditEvent | null = null;
  private lastAppliedEvent: RuntimeSoulAuditEvent | null = null;

  public constructor(options?: {
    deps?: Partial<RuntimeSoulDeps>;
    ttlMs?: number;
    now?: () => Date;
  }) {
    this.deps = { ...createSupabaseRuntimeSoulDeps(), ...(options?.deps ?? {}) };
    this.ttlMs = Math.max(1_000, options?.ttlMs ?? DEFAULT_TTL_MS);
    this.now = options?.now ?? (() => new Date());
  }

  private async emit(event: Omit<RuntimeSoulAuditEvent, "occurredAt">, now: Date): Promise<void> {
    const occurredAt = now.toISOString();
    const auditEvent: RuntimeSoulAuditEvent = {
      ...event,
      occurredAt,
    };

    const prevStatus = this.personaStatus.get(event.entityId) ?? {
      cacheExpiresAt: null,
      lastReasonCode: null,
      lastLoadError: null,
      lastOccurredAt: null,
      lastSummary: null,
    };

    const metadataSummary = asRecord(event.metadata)?.summary;

    this.personaStatus.set(event.entityId, {
      ...prevStatus,
      lastReasonCode: event.reasonCode,
      lastOccurredAt: occurredAt,
      lastLoadError:
        event.reasonCode === SoulReasonCode.loadFailed && typeof event.metadata?.error === "string"
          ? String(event.metadata.error)
          : prevStatus.lastLoadError,
      lastSummary:
        metadataSummary && typeof metadataSummary === "object"
          ? (metadataSummary as RuntimeSoulSummary)
          : prevStatus.lastSummary,
    });

    if (event.reasonCode === SoulReasonCode.fallbackEmpty) {
      this.lastFallbackEvent = auditEvent;
    }
    if (event.reasonCode === SoulReasonCode.applied) {
      this.lastAppliedEvent = auditEvent;
    }

    try {
      await this.deps.eventSink?.record(auditEvent);
    } catch {
      // Best-effort observability only.
    }
  }

  private setCacheExpiry(personaId: string, expiresAtMs: number): void {
    const prevStatus = this.personaStatus.get(personaId) ?? {
      cacheExpiresAt: null,
      lastReasonCode: null,
      lastLoadError: null,
      lastOccurredAt: null,
      lastSummary: null,
    };
    this.personaStatus.set(personaId, {
      ...prevStatus,
      cacheExpiresAt: new Date(expiresAtMs).toISOString(),
    });
  }

  public async getRuntimeSoul(input: {
    personaId: string;
    now?: Date;
    tolerateFailure?: boolean;
  }): Promise<RuntimeSoulContext> {
    const now = input.now ?? this.now();
    const nowMs = now.getTime();

    const cached = this.cache.get(input.personaId);
    if (cached && nowMs < cached.expiresAtMs) {
      return cached.value;
    }

    try {
      const rawSoul = await this.deps.getSoulProfile({ personaId: input.personaId });

      if (!rawSoul) {
        const context: RuntimeSoulContext = {
          profile: DEFAULT_SOUL_PROFILE,
          summary: summarizeSoulProfile(DEFAULT_SOUL_PROFILE),
          normalized: true,
          source: "fallback_empty",
        };
        const expiresAtMs = nowMs + this.ttlMs;
        this.cache.set(input.personaId, { value: context, expiresAtMs });
        this.setCacheExpiry(input.personaId, expiresAtMs);

        await this.emit(
          {
            layer: "soul_runtime",
            operation: "FALLBACK",
            reasonCode: SoulReasonCode.fallbackEmpty,
            entityId: input.personaId,
            metadata: {
              reason: "SOUL_NOT_FOUND",
              summary: context.summary,
            },
          },
          now,
        );

        return context;
      }

      const normalizedSoul = normalizeSoulProfile(rawSoul);
      const summary = summarizeSoulProfile(normalizedSoul.profile);
      const context: RuntimeSoulContext = {
        profile: normalizedSoul.profile,
        summary,
        normalized: normalizedSoul.normalized,
        source: "db",
      };

      const expiresAtMs = nowMs + this.ttlMs;
      this.cache.set(input.personaId, { value: context, expiresAtMs });
      this.setCacheExpiry(input.personaId, expiresAtMs);

      await this.emit(
        {
          layer: "soul_runtime",
          operation: "LOAD",
          reasonCode: SoulReasonCode.loadSuccess,
          entityId: input.personaId,
          metadata: {
            normalized: normalizedSoul.normalized,
            summary,
          },
        },
        now,
      );

      return context;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.emit(
        {
          layer: "soul_runtime",
          operation: "LOAD",
          reasonCode: SoulReasonCode.loadFailed,
          entityId: input.personaId,
          metadata: {
            error: message,
          },
        },
        now,
      );

      const fallback: RuntimeSoulContext = {
        profile: DEFAULT_SOUL_PROFILE,
        summary: summarizeSoulProfile(DEFAULT_SOUL_PROFILE),
        normalized: true,
        source: "fallback_empty",
      };
      const expiresAtMs = nowMs + this.ttlMs;
      this.cache.set(input.personaId, { value: fallback, expiresAtMs });
      this.setCacheExpiry(input.personaId, expiresAtMs);

      await this.emit(
        {
          layer: "soul_runtime",
          operation: "FALLBACK",
          reasonCode: SoulReasonCode.fallbackEmpty,
          entityId: input.personaId,
          metadata: {
            degraded: true,
            summary: fallback.summary,
          },
        },
        now,
      );

      if (!input.tolerateFailure) {
        throw error;
      }

      return fallback;
    }
  }

  public async recordApplied(input: {
    personaId: string;
    layer?: "generation" | "dispatch_precheck";
    metadata?: Record<string, unknown>;
    now?: Date;
  }): Promise<void> {
    const now = input.now ?? this.now();
    await this.emit(
      {
        layer: input.layer ?? "generation",
        operation: "APPLY",
        reasonCode: SoulReasonCode.applied,
        entityId: input.personaId,
        metadata: input.metadata,
      },
      now,
    );
  }

  public getStatus(): RuntimeSoulProviderStatus {
    const personas: Record<string, RuntimeSoulPersonaStatus> = {};
    for (const [personaId, status] of this.personaStatus.entries()) {
      personas[personaId] = status;
    }

    return {
      ttlMs: this.ttlMs,
      personas,
      lastFallbackEvent: this.lastFallbackEvent,
      lastAppliedEvent: this.lastAppliedEvent,
    };
  }
}

export function createRuntimeSoulBuilder(
  customDeps?: Partial<RuntimeSoulDeps>,
  options?: {
    ttlMs?: number;
    now?: () => Date;
  },
) {
  const provider = new CachedRuntimeSoulProvider({
    deps: customDeps,
    ttlMs: options?.ttlMs,
    now: options?.now,
  });

  return async function buildRuntimeSoul(input: {
    personaId: string;
    now?: Date;
    tolerateFailure?: boolean;
  }): Promise<RuntimeSoulContext> {
    return provider.getRuntimeSoul(input);
  };
}

const defaultRuntimeSoulProvider = new CachedRuntimeSoulProvider();

export const buildRuntimeSoulProfile = async (input: {
  personaId: string;
  now?: Date;
  tolerateFailure?: boolean;
}) => defaultRuntimeSoulProvider.getRuntimeSoul(input);

export const recordRuntimeSoulApplied = async (input: {
  personaId: string;
  layer?: "generation" | "dispatch_precheck";
  metadata?: Record<string, unknown>;
  now?: Date;
}) => defaultRuntimeSoulProvider.recordApplied(input);

export function getRuntimeSoulProviderStatus(): RuntimeSoulProviderStatus {
  return defaultRuntimeSoulProvider.getStatus();
}

export function buildSoulPrecheckHints(input: {
  summary: RuntimeSoulSummary;
  existingHints?: string[];
}): string[] {
  const hints = new Set<string>(input.existingHints ?? []);
  hints.add(`[soul:risk:${input.summary.riskPreference}]`);
  hints.add(`[soul:tradeoff:${input.summary.tradeoffStyle}]`);
  return Array.from(hints).slice(0, 20);
}
