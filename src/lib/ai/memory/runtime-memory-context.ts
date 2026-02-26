import { MemoryReasonCode } from "@/lib/ai/reason-codes";
import { createAdminClient } from "@/lib/supabase/admin";

export type RuntimeTaskType = "reply" | "vote" | "post" | "comment" | "image_post" | "poll_post";

export type BuildRuntimeMemoryContextInput = {
  personaId: string;
  threadId?: string;
  boardId?: string;
  taskType: RuntimeTaskType;
  now?: Date;
  threadWindowSeconds?: number;
  tolerateFailure?: boolean;
};

export type RuntimePolicyRefs = {
  policyVersion: number | null;
};

export type RuntimeMemoryRefs = {
  communityMemoryVersion: string | null;
  safetyMemoryVersion: string | null;
};

export type RuntimePersonaLongMemory = {
  id: string;
  content: string;
  updatedAt: string;
};

export type RuntimeThreadMemoryEntry = {
  id: string;
  key: string;
  value: string;
  metadata: Record<string, unknown>;
  ttlSeconds: number;
  maxItems: number;
  expiresAt: string;
  updatedAt: string;
};

export type RuntimeMemoryContext = {
  policyRefs: RuntimePolicyRefs;
  memoryRefs: RuntimeMemoryRefs;
  personaLongMemory: RuntimePersonaLongMemory | null;
  threadShortMemory: {
    threadId: string | null;
    boardId: string | null;
    taskType: RuntimeTaskType;
    ttlSeconds: number;
    maxItems: number;
    entries: RuntimeThreadMemoryEntry[];
  };
};

export type RuntimeMemoryLayer = "global" | "persona" | "thread";

export type RuntimeMemoryOperation =
  | "LOAD_SUCCESS"
  | "CACHE_HIT"
  | "TRIM"
  | "FALLBACK"
  | "LOAD_FAILED";

export type RuntimeMemoryReasonCodeValue = (typeof MemoryReasonCode)[keyof typeof MemoryReasonCode];

export type RuntimeMemoryAuditEvent = {
  layer: RuntimeMemoryLayer;
  operation: RuntimeMemoryOperation;
  reasonCode: RuntimeMemoryReasonCodeValue;
  entityId: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
};

export interface RuntimeMemoryEventSink {
  record(event: RuntimeMemoryAuditEvent): Promise<void>;
}

export class InMemoryRuntimeMemoryEventSink implements RuntimeMemoryEventSink {
  public readonly events: RuntimeMemoryAuditEvent[] = [];

  public async record(event: RuntimeMemoryAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

export type RuntimeMemoryGovernance = {
  threadMaxItems?: number;
  personaTokenBudget?: number;
  dedupe?: {
    enabled?: boolean;
    minValueLength?: number;
  };
};

export type RuntimeMemoryProviderStatus = {
  ttlMs: number;
  activeRefs: {
    policyVersion: number | null;
    communityMemoryVersion: string | null;
    safetyMemoryVersion: string | null;
  };
  layers: {
    global: RuntimeMemoryLayerStatus;
    persona: RuntimeMemoryLayerStatus;
    thread: RuntimeMemoryLayerStatus;
  };
  lastTrimEvent: RuntimeMemoryAuditEvent | null;
  lastFallbackEvent: RuntimeMemoryAuditEvent | null;
};

export type RuntimeMemoryLayerStatus = {
  cacheExpiresAt: string | null;
  lastReasonCode: RuntimeMemoryReasonCodeValue | null;
  lastOperation: RuntimeMemoryOperation | null;
  lastLoadError: string | null;
  lastOccurredAt: string | null;
};

type RuntimeMemoryDeps = {
  getPolicyRefs: () => Promise<unknown>;
  getMemoryRefs: () => Promise<unknown>;
  getPersonaCanonicalLongMemory: (input: { personaId: string }) => Promise<unknown>;
  getThreadShortMemoryEntries: (input: {
    personaId: string;
    threadId: string;
    taskType: RuntimeTaskType;
    boardId?: string;
    now: Date;
  }) => Promise<unknown>;
  eventSink?: RuntimeMemoryEventSink;
};

type PolicyReleaseRow = { version: number };
type EngineConfigRow = { key: string; value: string };
type LongMemoryRow = { id: string; content: string; updated_at: string };
type ThreadMemoryRow = {
  id: string;
  memory_key: string;
  memory_value: string;
  metadata: Record<string, unknown> | null;
  ttl_seconds: number;
  max_items: number;
  expires_at: string;
  updated_at: string;
};

type CacheEntry<T> = {
  value: T;
  expiresAtMs: number;
};

const DEFAULT_TTL_MS = 30_000;
const DEFAULT_THREAD_MAX_ITEMS = 20;
const DEFAULT_PERSONA_TOKEN_BUDGET = 1_200;
const DEFAULT_DEDUPE_MIN_LENGTH = 8;

function normalizeHintText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizePositiveNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.floor(value);
}

function normalizeIsoString(value: unknown): string | null {
  const raw = normalizeString(value);
  if (!raw) {
    return null;
  }
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) {
    return null;
  }
  return new Date(ms).toISOString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function approximateTokenCount(input: string): number {
  const normalized = normalizeHintText(input);
  if (!normalized) {
    return 0;
  }
  return normalized.split(" ").length;
}

function trimByTokenBudget(input: string, budget: number): string {
  const normalized = normalizeHintText(input);
  if (!normalized || budget <= 0) {
    return "";
  }
  const tokens = normalized.split(" ");
  if (tokens.length <= budget) {
    return normalized;
  }
  return tokens.slice(0, budget).join(" ");
}

function emptyContext(input: BuildRuntimeMemoryContextInput): RuntimeMemoryContext {
  return {
    policyRefs: {
      policyVersion: null,
    },
    memoryRefs: {
      communityMemoryVersion: null,
      safetyMemoryVersion: null,
    },
    personaLongMemory: null,
    threadShortMemory: {
      threadId: input.threadId ?? null,
      boardId: input.boardId ?? null,
      taskType: input.taskType,
      ttlSeconds: 0,
      maxItems: 0,
      entries: [],
    },
  };
}

function byUpdatedAtDesc(a: RuntimeThreadMemoryEntry, b: RuntimeThreadMemoryEntry): number {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

function normalizePolicyRefs(input: unknown): {
  refs: RuntimePolicyRefs;
  normalized: boolean;
} {
  const record = asRecord(input);
  if (!record) {
    return { refs: { policyVersion: null }, normalized: true };
  }

  const rawPolicyVersion = record.policyVersion;
  const policyVersion =
    typeof rawPolicyVersion === "number" && Number.isFinite(rawPolicyVersion)
      ? Math.floor(rawPolicyVersion)
      : null;

  return {
    refs: { policyVersion },
    normalized:
      policyVersion === null && rawPolicyVersion !== null && rawPolicyVersion !== undefined,
  };
}

function normalizeMemoryRefs(input: unknown): {
  refs: RuntimeMemoryRefs;
  normalized: boolean;
} {
  const record = asRecord(input);
  if (!record) {
    return {
      refs: { communityMemoryVersion: null, safetyMemoryVersion: null },
      normalized: true,
    };
  }

  const communityMemoryVersion = normalizeString(record.communityMemoryVersion);
  const safetyMemoryVersion = normalizeString(record.safetyMemoryVersion);

  return {
    refs: {
      communityMemoryVersion,
      safetyMemoryVersion,
    },
    normalized:
      (record.communityMemoryVersion !== undefined && communityMemoryVersion === null) ||
      (record.safetyMemoryVersion !== undefined && safetyMemoryVersion === null),
  };
}

function normalizePersonaLongMemory(input: unknown): {
  memory: RuntimePersonaLongMemory | null;
  normalized: boolean;
} {
  if (!input) {
    return { memory: null, normalized: false };
  }

  const record = asRecord(input);
  if (!record) {
    return { memory: null, normalized: true };
  }

  const id = normalizeString(record.id);
  const content = normalizeString(record.content);
  const updatedAt = normalizeIsoString(record.updatedAt);

  if (!id || !content || !updatedAt) {
    return { memory: null, normalized: true };
  }

  return {
    memory: { id, content, updatedAt },
    normalized: false,
  };
}

function normalizeThreadEntries(input: {
  entries: unknown;
  now: Date;
  threadWindowSeconds?: number;
}): {
  entries: RuntimeThreadMemoryEntry[];
  droppedCount: number;
  normalizedCount: number;
} {
  const thresholdMs =
    typeof input.threadWindowSeconds === "number" && input.threadWindowSeconds > 0
      ? input.now.getTime() - input.threadWindowSeconds * 1000
      : null;

  const source = Array.isArray(input.entries) ? input.entries : [];
  const normalized: RuntimeThreadMemoryEntry[] = [];
  let droppedCount = 0;
  let normalizedCount = 0;

  for (let index = 0; index < source.length; index += 1) {
    const row = source[index];
    const record = asRecord(row);
    if (!record) {
      droppedCount += 1;
      normalizedCount += 1;
      continue;
    }

    const id = normalizeString(record.id) ?? `memory-${index}`;
    const key = normalizeString(record.key) ?? "default";
    const value = normalizeString(record.value);
    const ttlSeconds = normalizePositiveNumber(record.ttlSeconds) ?? 0;
    const maxItems = normalizePositiveNumber(record.maxItems) ?? DEFAULT_THREAD_MAX_ITEMS;
    const expiresAt = normalizeIsoString(record.expiresAt);
    const updatedAt = normalizeIsoString(record.updatedAt);
    const metadata = asRecord(record.metadata) ?? {};

    if (!value || !expiresAt || !updatedAt || ttlSeconds <= 0) {
      droppedCount += 1;
      normalizedCount += 1;
      continue;
    }

    const expiresAtMs = Date.parse(expiresAt);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= input.now.getTime()) {
      droppedCount += 1;
      continue;
    }

    if (thresholdMs != null) {
      const updatedAtMs = Date.parse(updatedAt);
      if (!Number.isFinite(updatedAtMs) || updatedAtMs < thresholdMs) {
        droppedCount += 1;
        continue;
      }
    }

    normalized.push({
      id,
      key,
      value,
      metadata,
      ttlSeconds,
      maxItems,
      expiresAt,
      updatedAt,
    });
  }

  return {
    entries: normalized.sort(byUpdatedAtDesc),
    droppedCount,
    normalizedCount,
  };
}

function createSupabaseRuntimeMemoryDeps(): RuntimeMemoryDeps {
  return {
    getPolicyRefs: async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("ai_policy_releases")
        .select("version")
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle<PolicyReleaseRow>();

      if (error) {
        throw new Error(`load active policy refs failed: ${error.message}`);
      }

      return {
        policyVersion: data?.version ?? null,
      } satisfies RuntimePolicyRefs;
    },

    getMemoryRefs: async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("persona_engine_config")
        .select("key, value")
        .in("key", ["community_memory_version", "safety_memory_version"])
        .returns<EngineConfigRow[]>();

      if (error) {
        throw new Error(`load memory config refs failed: ${error.message}`);
      }

      const configMap = new Map((data ?? []).map((row) => [row.key, row.value]));
      return {
        communityMemoryVersion: configMap.get("community_memory_version") ?? null,
        safetyMemoryVersion: configMap.get("safety_memory_version") ?? null,
      } satisfies RuntimeMemoryRefs;
    },

    getPersonaCanonicalLongMemory: async ({ personaId }) => {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("persona_long_memories")
        .select("id, content, updated_at")
        .eq("persona_id", personaId)
        .eq("is_canonical", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle<LongMemoryRow>();

      if (error) {
        throw new Error(`load persona canonical memory failed: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        content: data.content,
        updatedAt: data.updated_at,
      };
    },

    getThreadShortMemoryEntries: async ({ personaId, threadId, taskType, boardId, now }) => {
      const supabase = createAdminClient();
      let query = supabase
        .from("ai_thread_memories")
        .select(
          "id, memory_key, memory_value, metadata, ttl_seconds, max_items, expires_at, updated_at",
        )
        .eq("persona_id", personaId)
        .eq("thread_id", threadId)
        .eq("task_type", taskType)
        .gt("expires_at", now.toISOString())
        .order("updated_at", { ascending: false })
        .limit(200);

      if (boardId) {
        query = query.eq("board_id", boardId);
      }

      const { data, error } = await query.returns<ThreadMemoryRow[]>();
      if (error) {
        throw new Error(`load thread short memory failed: ${error.message}`);
      }

      return (data ?? []).map((row) => ({
        id: row.id,
        key: row.memory_key,
        value: row.memory_value,
        metadata: row.metadata ?? {},
        ttlSeconds: row.ttl_seconds,
        maxItems: row.max_items,
        expiresAt: row.expires_at,
        updatedAt: row.updated_at,
      }));
    },
  };
}

export class CachedRuntimeMemoryProvider {
  private readonly deps: RuntimeMemoryDeps;
  private readonly ttlMs: number;
  private readonly now: () => Date;
  private readonly governance: Required<RuntimeMemoryGovernance>;

  private globalCache: CacheEntry<{
    policyRefs: RuntimePolicyRefs;
    memoryRefs: RuntimeMemoryRefs;
  }> | null = null;
  private personaCache = new Map<string, CacheEntry<RuntimePersonaLongMemory | null>>();
  private threadCache = new Map<string, CacheEntry<RuntimeThreadMemoryEntry[]>>();

  private lastKnownGoodGlobal: {
    policyRefs: RuntimePolicyRefs;
    memoryRefs: RuntimeMemoryRefs;
  } | null = null;
  private lastKnownGoodPersona = new Map<string, RuntimePersonaLongMemory | null>();

  private layerStatus: RuntimeMemoryProviderStatus["layers"] = {
    global: {
      cacheExpiresAt: null,
      lastReasonCode: null,
      lastOperation: null,
      lastLoadError: null,
      lastOccurredAt: null,
    },
    persona: {
      cacheExpiresAt: null,
      lastReasonCode: null,
      lastOperation: null,
      lastLoadError: null,
      lastOccurredAt: null,
    },
    thread: {
      cacheExpiresAt: null,
      lastReasonCode: null,
      lastOperation: null,
      lastLoadError: null,
      lastOccurredAt: null,
    },
  };

  private lastTrimEvent: RuntimeMemoryAuditEvent | null = null;
  private lastFallbackEvent: RuntimeMemoryAuditEvent | null = null;

  public constructor(options?: {
    deps?: Partial<RuntimeMemoryDeps>;
    ttlMs?: number;
    now?: () => Date;
    governance?: RuntimeMemoryGovernance;
  }) {
    this.deps = { ...createSupabaseRuntimeMemoryDeps(), ...(options?.deps ?? {}) };
    this.ttlMs = Math.max(1_000, options?.ttlMs ?? DEFAULT_TTL_MS);
    this.now = options?.now ?? (() => new Date());

    this.governance = {
      threadMaxItems: Math.max(1, options?.governance?.threadMaxItems ?? DEFAULT_THREAD_MAX_ITEMS),
      personaTokenBudget: Math.max(
        10,
        options?.governance?.personaTokenBudget ?? DEFAULT_PERSONA_TOKEN_BUDGET,
      ),
      dedupe: {
        enabled: options?.governance?.dedupe?.enabled ?? true,
        minValueLength: Math.max(
          1,
          options?.governance?.dedupe?.minValueLength ?? DEFAULT_DEDUPE_MIN_LENGTH,
        ),
      },
    };
  }

  private async emit(event: Omit<RuntimeMemoryAuditEvent, "occurredAt">, now: Date): Promise<void> {
    const auditEvent: RuntimeMemoryAuditEvent = {
      ...event,
      occurredAt: now.toISOString(),
    };

    this.layerStatus[event.layer] = {
      ...this.layerStatus[event.layer],
      lastOperation: event.operation,
      lastReasonCode: event.reasonCode,
      lastOccurredAt: auditEvent.occurredAt,
      lastLoadError:
        event.operation === "LOAD_FAILED" && typeof event.metadata?.error === "string"
          ? String(event.metadata.error)
          : this.layerStatus[event.layer].lastLoadError,
    };

    if (event.operation === "TRIM") {
      this.lastTrimEvent = auditEvent;
    }
    if (event.operation === "FALLBACK") {
      this.lastFallbackEvent = auditEvent;
    }

    try {
      await this.deps.eventSink?.record(auditEvent);
    } catch {
      // Best-effort observability only.
    }
  }

  private setCacheExpiresAt(layer: RuntimeMemoryLayer, expiresAtMs: number): void {
    this.layerStatus[layer] = {
      ...this.layerStatus[layer],
      cacheExpiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  private async loadGlobal(
    now: Date,
    tolerateFailure: boolean,
  ): Promise<{
    policyRefs: RuntimePolicyRefs;
    memoryRefs: RuntimeMemoryRefs;
  }> {
    const nowMs = now.getTime();
    if (this.globalCache && nowMs < this.globalCache.expiresAtMs) {
      await this.emit(
        {
          layer: "global",
          operation: "CACHE_HIT",
          reasonCode: MemoryReasonCode.cacheHit,
          entityId: "global",
          metadata: {
            cacheExpiresAt: new Date(this.globalCache.expiresAtMs).toISOString(),
          },
        },
        now,
      );
      return this.globalCache.value;
    }

    try {
      const [rawPolicyRefs, rawMemoryRefs] = await Promise.all([
        this.deps.getPolicyRefs(),
        this.deps.getMemoryRefs(),
      ]);

      const normalizedPolicy = normalizePolicyRefs(rawPolicyRefs);
      const normalizedMemory = normalizeMemoryRefs(rawMemoryRefs);

      const value = {
        policyRefs: normalizedPolicy.refs,
        memoryRefs: normalizedMemory.refs,
      };
      const expiresAtMs = nowMs + this.ttlMs;
      this.globalCache = { value, expiresAtMs };
      this.lastKnownGoodGlobal = value;
      this.setCacheExpiresAt("global", expiresAtMs);

      await this.emit(
        {
          layer: "global",
          operation: "LOAD_SUCCESS",
          reasonCode: MemoryReasonCode.cacheRefresh,
          entityId: "global",
          metadata: {
            normalized: normalizedPolicy.normalized || normalizedMemory.normalized,
          },
        },
        now,
      );

      if (normalizedPolicy.normalized || normalizedMemory.normalized) {
        await this.emit(
          {
            layer: "global",
            operation: "TRIM",
            reasonCode: MemoryReasonCode.schemaNormalized,
            entityId: "global",
          },
          now,
        );
      }

      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.emit(
        {
          layer: "global",
          operation: "LOAD_FAILED",
          reasonCode: MemoryReasonCode.loadFailed,
          entityId: "global",
          metadata: { error: message },
        },
        now,
      );

      if (this.lastKnownGoodGlobal) {
        const expiresAtMs = nowMs + this.ttlMs;
        this.globalCache = { value: this.lastKnownGoodGlobal, expiresAtMs };
        this.setCacheExpiresAt("global", expiresAtMs);
        await this.emit(
          {
            layer: "global",
            operation: "FALLBACK",
            reasonCode: MemoryReasonCode.fallbackLastKnownGood,
            entityId: "global",
          },
          now,
        );
        return this.lastKnownGoodGlobal;
      }

      await this.emit(
        {
          layer: "global",
          operation: "FALLBACK",
          reasonCode: MemoryReasonCode.fallbackEmpty,
          entityId: "global",
        },
        now,
      );

      if (!tolerateFailure) {
        throw error;
      }

      return {
        policyRefs: { policyVersion: null },
        memoryRefs: { communityMemoryVersion: null, safetyMemoryVersion: null },
      };
    }
  }

  private async loadPersona(input: {
    personaId: string;
    now: Date;
    tolerateFailure: boolean;
  }): Promise<RuntimePersonaLongMemory | null> {
    const { personaId, now, tolerateFailure } = input;
    const nowMs = now.getTime();
    const cache = this.personaCache.get(personaId);
    if (cache && nowMs < cache.expiresAtMs) {
      await this.emit(
        {
          layer: "persona",
          operation: "CACHE_HIT",
          reasonCode: MemoryReasonCode.cacheHit,
          entityId: personaId,
        },
        now,
      );
      return cache.value;
    }

    try {
      const rawPersonaMemory = await this.deps.getPersonaCanonicalLongMemory({ personaId });
      const normalized = normalizePersonaLongMemory(rawPersonaMemory);
      let memory = normalized.memory;

      if (memory) {
        const beforeTokens = approximateTokenCount(memory.content);
        const trimmed = trimByTokenBudget(memory.content, this.governance.personaTokenBudget);
        const afterTokens = approximateTokenCount(trimmed);
        if (afterTokens < beforeTokens) {
          memory = { ...memory, content: trimmed };
          await this.emit(
            {
              layer: "persona",
              operation: "TRIM",
              reasonCode: MemoryReasonCode.trimApplied,
              entityId: personaId,
              metadata: {
                rule: "PERSONA_TOKEN_BUDGET",
                beforeTokens,
                afterTokens,
                tokenBudget: this.governance.personaTokenBudget,
              },
            },
            now,
          );
        }
      }

      const expiresAtMs = nowMs + this.ttlMs;
      this.personaCache.set(personaId, { value: memory, expiresAtMs });
      this.lastKnownGoodPersona.set(personaId, memory);
      this.setCacheExpiresAt("persona", expiresAtMs);

      await this.emit(
        {
          layer: "persona",
          operation: "LOAD_SUCCESS",
          reasonCode: MemoryReasonCode.cacheRefresh,
          entityId: personaId,
          metadata: {
            normalized: normalized.normalized,
          },
        },
        now,
      );

      if (normalized.normalized) {
        await this.emit(
          {
            layer: "persona",
            operation: "TRIM",
            reasonCode: MemoryReasonCode.schemaNormalized,
            entityId: personaId,
          },
          now,
        );
      }

      return memory;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.emit(
        {
          layer: "persona",
          operation: "LOAD_FAILED",
          reasonCode: MemoryReasonCode.loadFailed,
          entityId: personaId,
          metadata: { error: message },
        },
        now,
      );

      if (this.lastKnownGoodPersona.has(personaId)) {
        const fallback = this.lastKnownGoodPersona.get(personaId) ?? null;
        const expiresAtMs = nowMs + this.ttlMs;
        this.personaCache.set(personaId, { value: fallback, expiresAtMs });
        this.setCacheExpiresAt("persona", expiresAtMs);
        await this.emit(
          {
            layer: "persona",
            operation: "FALLBACK",
            reasonCode: MemoryReasonCode.fallbackLastKnownGood,
            entityId: personaId,
          },
          now,
        );
        return fallback;
      }

      await this.emit(
        {
          layer: "persona",
          operation: "FALLBACK",
          reasonCode: MemoryReasonCode.fallbackEmpty,
          entityId: personaId,
        },
        now,
      );

      if (!tolerateFailure) {
        throw error;
      }

      return null;
    }
  }

  private applyThreadGovernance(input: {
    entries: RuntimeThreadMemoryEntry[];
    now: Date;
    threadWindowSeconds?: number;
    entityId: string;
  }): Promise<RuntimeThreadMemoryEntry[]> {
    const normalized = normalizeThreadEntries({
      entries: input.entries,
      now: input.now,
      threadWindowSeconds: input.threadWindowSeconds,
    });

    return (async () => {
      let entries = normalized.entries;
      if (normalized.droppedCount > 0) {
        await this.emit(
          {
            layer: "thread",
            operation: "TRIM",
            reasonCode: MemoryReasonCode.trimApplied,
            entityId: input.entityId,
            metadata: {
              rule: "THREAD_TTL_WINDOW",
              droppedCount: normalized.droppedCount,
            },
          },
          input.now,
        );
      }
      if (normalized.normalizedCount > 0) {
        await this.emit(
          {
            layer: "thread",
            operation: "TRIM",
            reasonCode: MemoryReasonCode.schemaNormalized,
            entityId: input.entityId,
            metadata: {
              normalizedCount: normalized.normalizedCount,
            },
          },
          input.now,
        );
      }

      const dedupeEnabled = this.governance.dedupe.enabled;
      const minLength = this.governance.dedupe.minValueLength;
      if (dedupeEnabled) {
        const seen = new Set<string>();
        const deduped: RuntimeThreadMemoryEntry[] = [];
        let dropped = 0;

        for (const entry of entries) {
          const normalizedValue = normalizeHintText(entry.value).toLowerCase();
          if (normalizedValue.length < minLength) {
            dropped += 1;
            continue;
          }
          if (seen.has(normalizedValue)) {
            dropped += 1;
            continue;
          }
          seen.add(normalizedValue);
          deduped.push(entry);
        }

        if (dropped > 0) {
          await this.emit(
            {
              layer: "thread",
              operation: "TRIM",
              reasonCode: MemoryReasonCode.trimApplied,
              entityId: input.entityId,
              metadata: {
                rule: "THREAD_DEDUPE_LOW_VALUE",
                droppedCount: dropped,
                minValueLength: minLength,
              },
            },
            input.now,
          );
        }

        entries = deduped;
      }

      const requestedMaxItems = entries[0]?.maxItems ?? this.governance.threadMaxItems;
      const cap = Math.max(1, Math.min(this.governance.threadMaxItems, requestedMaxItems));
      if (entries.length > cap) {
        await this.emit(
          {
            layer: "thread",
            operation: "TRIM",
            reasonCode: MemoryReasonCode.trimApplied,
            entityId: input.entityId,
            metadata: {
              rule: "THREAD_MAX_ITEMS",
              before: entries.length,
              after: cap,
            },
          },
          input.now,
        );
      }
      return entries.slice(0, cap);
    })();
  }

  private threadScopeKey(input: BuildRuntimeMemoryContextInput): string {
    return [input.personaId, input.threadId ?? "", input.boardId ?? "", input.taskType].join(":");
  }

  private async loadThread(
    input: BuildRuntimeMemoryContextInput,
    now: Date,
  ): Promise<RuntimeThreadMemoryEntry[]> {
    if (!input.threadId) {
      return [];
    }

    const scopeKey = this.threadScopeKey(input);
    const nowMs = now.getTime();
    const cache = this.threadCache.get(scopeKey);
    if (cache && nowMs < cache.expiresAtMs) {
      await this.emit(
        {
          layer: "thread",
          operation: "CACHE_HIT",
          reasonCode: MemoryReasonCode.cacheHit,
          entityId: scopeKey,
        },
        now,
      );
      return cache.value;
    }

    try {
      const rawEntries = await this.deps.getThreadShortMemoryEntries({
        personaId: input.personaId,
        threadId: input.threadId,
        boardId: input.boardId,
        taskType: input.taskType,
        now,
      });

      const entries = await this.applyThreadGovernance({
        entries: Array.isArray(rawEntries) ? (rawEntries as RuntimeThreadMemoryEntry[]) : [],
        now,
        threadWindowSeconds: input.threadWindowSeconds,
        entityId: scopeKey,
      });

      const expiresAtMs = nowMs + this.ttlMs;
      this.threadCache.set(scopeKey, { value: entries, expiresAtMs });
      this.setCacheExpiresAt("thread", expiresAtMs);

      await this.emit(
        {
          layer: "thread",
          operation: "LOAD_SUCCESS",
          reasonCode: MemoryReasonCode.cacheRefresh,
          entityId: scopeKey,
        },
        now,
      );

      return entries;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.emit(
        {
          layer: "thread",
          operation: "LOAD_FAILED",
          reasonCode: MemoryReasonCode.loadFailed,
          entityId: scopeKey,
          metadata: { error: message },
        },
        now,
      );

      if (cache) {
        await this.emit(
          {
            layer: "thread",
            operation: "FALLBACK",
            reasonCode: MemoryReasonCode.fallbackLastKnownGood,
            entityId: scopeKey,
          },
          now,
        );
        return cache.value;
      }

      await this.emit(
        {
          layer: "thread",
          operation: "FALLBACK",
          reasonCode: MemoryReasonCode.threadMissing,
          entityId: scopeKey,
          metadata: {
            degraded: true,
          },
        },
        now,
      );

      return [];
    }
  }

  public getStatus(): RuntimeMemoryProviderStatus {
    const globalValue = this.globalCache?.value ?? this.lastKnownGoodGlobal;
    return {
      ttlMs: this.ttlMs,
      activeRefs: {
        policyVersion: globalValue?.policyRefs.policyVersion ?? null,
        communityMemoryVersion: globalValue?.memoryRefs.communityMemoryVersion ?? null,
        safetyMemoryVersion: globalValue?.memoryRefs.safetyMemoryVersion ?? null,
      },
      layers: this.layerStatus,
      lastTrimEvent: this.lastTrimEvent,
      lastFallbackEvent: this.lastFallbackEvent,
    };
  }

  public async getRuntimeMemoryContext(
    input: BuildRuntimeMemoryContextInput,
  ): Promise<RuntimeMemoryContext> {
    const now = input.now ?? this.now();

    try {
      const [global, personaMemory, threadEntries] = await Promise.all([
        this.loadGlobal(now, input.tolerateFailure === true),
        this.loadPersona({
          personaId: input.personaId,
          now,
          tolerateFailure: input.tolerateFailure === true,
        }),
        this.loadThread(input, now),
      ]);

      return {
        policyRefs: global.policyRefs,
        memoryRefs: global.memoryRefs,
        personaLongMemory: personaMemory,
        threadShortMemory: {
          threadId: input.threadId ?? null,
          boardId: input.boardId ?? null,
          taskType: input.taskType,
          ttlSeconds: threadEntries[0]?.ttlSeconds ?? 0,
          maxItems: threadEntries[0]?.maxItems ?? 0,
          entries: threadEntries,
        },
      };
    } catch (error) {
      await this.emit(
        {
          layer: "global",
          operation: "FALLBACK",
          reasonCode: MemoryReasonCode.readFailed,
          entityId: input.personaId,
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
        now,
      );

      if (!input.tolerateFailure) {
        throw error;
      }

      return emptyContext(input);
    }
  }
}

export function createRuntimeMemoryContextBuilder(
  customDeps?: Partial<RuntimeMemoryDeps>,
  options?: {
    ttlMs?: number;
    now?: () => Date;
    governance?: RuntimeMemoryGovernance;
  },
) {
  const provider = new CachedRuntimeMemoryProvider({
    deps: customDeps,
    ttlMs: options?.ttlMs,
    now: options?.now,
    governance: options?.governance,
  });

  return async function buildRuntimeMemoryContext(
    input: BuildRuntimeMemoryContextInput,
  ): Promise<RuntimeMemoryContext> {
    return provider.getRuntimeMemoryContext(input);
  };
}

const defaultRuntimeMemoryProvider = new CachedRuntimeMemoryProvider();

export const buildRuntimeMemoryContext = async (input: BuildRuntimeMemoryContextInput) =>
  defaultRuntimeMemoryProvider.getRuntimeMemoryContext(input);

export function getRuntimeMemoryProviderStatus(): RuntimeMemoryProviderStatus {
  return defaultRuntimeMemoryProvider.getStatus();
}

export function buildSafetyMemoryHints(input: {
  context: RuntimeMemoryContext;
  existingHints?: string[];
  maxItems?: number;
}): string[] {
  const values: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string | null | undefined) => {
    if (!raw) return;
    const normalized = normalizeHintText(raw);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    values.push(normalized);
  };

  for (const entry of input.context.threadShortMemory.entries) {
    push(entry.value);
  }
  push(input.context.personaLongMemory?.content);

  if (input.context.policyRefs.policyVersion != null) {
    push(`[policy:v${input.context.policyRefs.policyVersion}]`);
  }
  if (input.context.memoryRefs.communityMemoryVersion) {
    push(`[community:${input.context.memoryRefs.communityMemoryVersion}]`);
  }
  if (input.context.memoryRefs.safetyMemoryVersion) {
    push(`[safety:${input.context.memoryRefs.safetyMemoryVersion}]`);
  }

  for (const existing of input.existingHints ?? []) {
    push(existing);
  }

  const maxItems = input.maxItems && input.maxItems > 0 ? input.maxItems : 20;
  return values.slice(0, maxItems);
}
