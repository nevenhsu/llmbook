import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadDispatcherPolicy,
  normalizeDispatcherPolicy,
  type DispatcherPolicy,
} from "@/agents/task-dispatcher/policy/reply-only-policy";

export type ReplyPolicyScope = {
  personaId?: string;
  boardId?: string;
};

type ReplyPolicyPatch = Partial<DispatcherPolicy>;

export type PolicyControlPlaneDocument = {
  global?: ReplyPolicyPatch;
  capabilities?: Record<string, ReplyPolicyPatch>;
  personas?: Record<string, ReplyPolicyPatch>;
  boards?: Record<string, ReplyPolicyPatch>;
};

export type PolicyRelease = {
  version: number;
  policy: PolicyControlPlaneDocument;
  createdAt: string;
};

export interface PolicyReleaseStore {
  fetchLatestActive(): Promise<PolicyRelease | null>;
}

export interface ReplyPolicyProvider {
  getReplyPolicy(scope?: ReplyPolicyScope): Promise<DispatcherPolicy>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toPatch(value: unknown): ReplyPolicyPatch {
  const record = asRecord(value);
  if (!record) {
    return {};
  }

  const patch: ReplyPolicyPatch = {};

  const replyEnabled = readBoolean(record.replyEnabled);
  if (replyEnabled !== undefined) {
    patch.replyEnabled = replyEnabled;
  }

  const precheckEnabled = readBoolean(record.precheckEnabled);
  if (precheckEnabled !== undefined) {
    patch.precheckEnabled = precheckEnabled;
  }

  const perPersonaHourlyReplyLimit = readNumber(record.perPersonaHourlyReplyLimit);
  if (perPersonaHourlyReplyLimit !== undefined) {
    patch.perPersonaHourlyReplyLimit = perPersonaHourlyReplyLimit;
  }

  const perPostCooldownSeconds = readNumber(record.perPostCooldownSeconds);
  if (perPostCooldownSeconds !== undefined) {
    patch.perPostCooldownSeconds = perPostCooldownSeconds;
  }

  const precheckSimilarityThreshold = readNumber(record.precheckSimilarityThreshold);
  if (precheckSimilarityThreshold !== undefined) {
    patch.precheckSimilarityThreshold = precheckSimilarityThreshold;
  }

  return patch;
}

export function resolveReplyPolicy(input: {
  document?: PolicyControlPlaneDocument | null;
  scope?: ReplyPolicyScope;
  fallback: DispatcherPolicy;
}): DispatcherPolicy {
  const document = input.document;
  if (!document) {
    return input.fallback;
  }

  const globalPatch = toPatch(document.global);
  const capabilityPatch = toPatch(document.capabilities?.reply);
  const personaPatch = input.scope?.personaId
    ? toPatch(document.personas?.[input.scope.personaId])
    : {};
  const boardPatch = input.scope?.boardId ? toPatch(document.boards?.[input.scope.boardId]) : {};

  return normalizeDispatcherPolicy({
    ...input.fallback,
    ...globalPatch,
    ...capabilityPatch,
    ...personaPatch,
    ...boardPatch,
  });
}

export class SupabasePolicyReleaseStore implements PolicyReleaseStore {
  public async fetchLatestActive(): Promise<PolicyRelease | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_policy_releases")
      .select("version, policy, created_at")
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`load policy release failed: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return {
      version: Number(data.version),
      policy: (asRecord(data.policy) ?? {}) as PolicyControlPlaneDocument,
      createdAt: String(data.created_at),
    };
  }
}

type CachedPolicyProviderOptions = {
  store?: PolicyReleaseStore;
  ttlMs?: number;
  now?: () => Date;
  fallbackPolicy?: DispatcherPolicy;
};

export class CachedReplyPolicyProvider implements ReplyPolicyProvider {
  private readonly store: PolicyReleaseStore;
  private readonly ttlMs: number;
  private readonly now: () => Date;
  private readonly fallbackPolicy: DispatcherPolicy;
  private cachedRelease: PolicyRelease | null = null;
  private lastKnownGood: PolicyRelease | null = null;
  private cacheExpiresAtMs = 0;

  public constructor(options?: CachedPolicyProviderOptions) {
    this.store = options?.store ?? new SupabasePolicyReleaseStore();
    this.ttlMs = Math.max(1_000, options?.ttlMs ?? 30_000);
    this.now = options?.now ?? (() => new Date());
    this.fallbackPolicy = options?.fallbackPolicy ?? loadDispatcherPolicy();
  }

  public async getReplyPolicy(scope?: ReplyPolicyScope): Promise<DispatcherPolicy> {
    const nowMs = this.now().getTime();
    if (this.cachedRelease && nowMs < this.cacheExpiresAtMs) {
      return resolveReplyPolicy({
        document: this.cachedRelease.policy,
        scope,
        fallback: this.fallbackPolicy,
      });
    }

    try {
      const latest = await this.store.fetchLatestActive();
      if (latest) {
        this.cachedRelease = latest;
        this.lastKnownGood = latest;
      } else if (this.lastKnownGood) {
        this.cachedRelease = this.lastKnownGood;
      } else {
        this.cachedRelease = null;
      }
    } catch {
      // On read failure, keep serving last known good release.
      this.cachedRelease = this.lastKnownGood;
    } finally {
      this.cacheExpiresAtMs = nowMs + this.ttlMs;
    }

    return resolveReplyPolicy({
      document: this.cachedRelease?.policy,
      scope,
      fallback: this.fallbackPolicy,
    });
  }
}
