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

export type RuntimeGlobalPolicyRefs = {
  policyVersion: number | null;
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
  globalPolicyRefs: RuntimeGlobalPolicyRefs;
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

type RuntimeMemoryDeps = {
  getGlobalPolicyRefs: () => Promise<RuntimeGlobalPolicyRefs>;
  getPersonaCanonicalLongMemory: (input: {
    personaId: string;
  }) => Promise<RuntimePersonaLongMemory | null>;
  getThreadShortMemoryEntries: (input: {
    personaId: string;
    threadId: string;
    taskType: RuntimeTaskType;
    boardId?: string;
    now: Date;
  }) => Promise<RuntimeThreadMemoryEntry[]>;
  onFallback?: (input: { error: unknown; at: string; personaId: string }) => void | Promise<void>;
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

function normalizeHintText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function emptyContext(input: BuildRuntimeMemoryContextInput): RuntimeMemoryContext {
  return {
    globalPolicyRefs: {
      policyVersion: null,
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

function normalizeThreadEntries(input: {
  entries: RuntimeThreadMemoryEntry[];
  now: Date;
  threadWindowSeconds?: number;
}): RuntimeThreadMemoryEntry[] {
  const thresholdMs =
    typeof input.threadWindowSeconds === "number" && input.threadWindowSeconds > 0
      ? input.now.getTime() - input.threadWindowSeconds * 1000
      : null;

  return input.entries
    .filter((entry) => {
      const expiresAtMs = Date.parse(entry.expiresAt);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= input.now.getTime()) {
        return false;
      }
      if (thresholdMs == null) {
        return true;
      }
      const updatedAtMs = Date.parse(entry.updatedAt);
      return Number.isFinite(updatedAtMs) && updatedAtMs >= thresholdMs;
    })
    .sort(byUpdatedAtDesc);
}

function createSupabaseRuntimeMemoryDeps(): RuntimeMemoryDeps {
  return {
    getGlobalPolicyRefs: async () => {
      const supabase = createAdminClient();
      const [{ data: policy, error: policyError }, { data: configs, error: configError }] =
        await Promise.all([
          supabase
            .from("ai_policy_releases")
            .select("version")
            .eq("is_active", true)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle<PolicyReleaseRow>(),
          supabase
            .from("persona_engine_config")
            .select("key, value")
            .in("key", ["community_memory_version", "safety_memory_version"])
            .returns<EngineConfigRow[]>(),
        ]);

      if (policyError) {
        throw new Error(`load active policy refs failed: ${policyError.message}`);
      }
      if (configError) {
        throw new Error(`load memory config refs failed: ${configError.message}`);
      }

      const configMap = new Map((configs ?? []).map((row) => [row.key, row.value]));
      return {
        policyVersion: policy?.version ?? null,
        communityMemoryVersion: configMap.get("community_memory_version") ?? null,
        safetyMemoryVersion: configMap.get("safety_memory_version") ?? null,
      };
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

export function createRuntimeMemoryContextBuilder(customDeps?: Partial<RuntimeMemoryDeps>) {
  const deps: RuntimeMemoryDeps = { ...createSupabaseRuntimeMemoryDeps(), ...(customDeps ?? {}) };

  return async function buildRuntimeMemoryContext(
    input: BuildRuntimeMemoryContextInput,
  ): Promise<RuntimeMemoryContext> {
    const now = input.now ?? new Date();
    try {
      const [globalPolicyRefs, personaLongMemory, rawThreadEntries] = await Promise.all([
        deps.getGlobalPolicyRefs(),
        deps.getPersonaCanonicalLongMemory({ personaId: input.personaId }),
        input.threadId
          ? deps.getThreadShortMemoryEntries({
              personaId: input.personaId,
              threadId: input.threadId,
              boardId: input.boardId,
              taskType: input.taskType,
              now,
            })
          : Promise.resolve([]),
      ]);

      const validThreadEntries = normalizeThreadEntries({
        entries: rawThreadEntries,
        now,
        threadWindowSeconds: input.threadWindowSeconds,
      });
      const maxItems = validThreadEntries[0]?.maxItems ?? 0;
      const ttlSeconds = validThreadEntries[0]?.ttlSeconds ?? 0;

      return {
        globalPolicyRefs,
        personaLongMemory,
        threadShortMemory: {
          threadId: input.threadId ?? null,
          boardId: input.boardId ?? null,
          taskType: input.taskType,
          ttlSeconds,
          maxItems,
          entries: maxItems > 0 ? validThreadEntries.slice(0, maxItems) : validThreadEntries,
        },
      };
    } catch (error) {
      await deps.onFallback?.({
        error,
        at: now.toISOString(),
        personaId: input.personaId,
      });
      if (!input.tolerateFailure) {
        throw error;
      }
      return emptyContext(input);
    }
  };
}

export const buildRuntimeMemoryContext = createRuntimeMemoryContextBuilder();

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
  if (input.context.globalPolicyRefs.policyVersion != null) {
    push(`[policy:v${input.context.globalPolicyRefs.policyVersion}]`);
  }
  if (input.context.globalPolicyRefs.communityMemoryVersion) {
    push(`[community:${input.context.globalPolicyRefs.communityMemoryVersion}]`);
  }
  if (input.context.globalPolicyRefs.safetyMemoryVersion) {
    push(`[safety:${input.context.globalPolicyRefs.safetyMemoryVersion}]`);
  }
  for (const existing of input.existingHints ?? []) {
    push(existing);
  }

  const maxItems = input.maxItems && input.maxItems > 0 ? input.maxItems : 20;
  return values.slice(0, maxItems);
}
