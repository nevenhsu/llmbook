import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_DISPATCHER_POLICY,
  normalizeDispatcherPolicy,
  type DispatcherPolicy,
} from "@/agents/task-dispatcher/policy/reply-only-policy";
import { PolicyControlPlaneReasonCode } from "@/lib/ai/reason-codes";

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

export type PolicyReleaseMetadata = {
  version: number;
  isActive: boolean;
  createdAt: string;
  createdBy?: string;
  note?: string;
};

export type PolicyRelease = PolicyReleaseMetadata & {
  policy: PolicyControlPlaneDocument;
};

export interface PolicyReleaseStore {
  fetchLatestActive(): Promise<PolicyRelease | null>;
}

export interface ReplyPolicyProvider {
  getReplyPolicy(scope?: ReplyPolicyScope): Promise<DispatcherPolicy>;
}

export type PolicyControlPlaneReasonCodeValue =
  (typeof PolicyControlPlaneReasonCode)[keyof typeof PolicyControlPlaneReasonCode];

export type PolicyValidationIssue = {
  path: string;
  message: string;
};

export type ValidatePolicyControlPlaneResult = {
  document: PolicyControlPlaneDocument;
  issues: PolicyValidationIssue[];
};

export type PolicyDocumentDiff = {
  path: string;
  previous: boolean | number | undefined;
  next: boolean | number | undefined;
};

export type PolicyControlPlaneEvent = {
  reasonCode: PolicyControlPlaneReasonCodeValue;
  occurredAt: string;
  metadata?: Record<string, unknown>;
};

export interface PolicyControlPlaneEventSink {
  record(event: PolicyControlPlaneEvent): Promise<void>;
}

export type CachedReplyPolicyProviderStatus = {
  cachedVersion: number | null;
  lastKnownGoodVersion: number | null;
  cacheExpiresAt: string | null;
  ttlMs: number;
  lastReasonCode: PolicyControlPlaneReasonCodeValue | null;
  lastLoadError: string | null;
  lastFallbackReasonCode: PolicyControlPlaneReasonCodeValue | null;
  lastFallbackAt: string | null;
};

const PATCH_KEYS = [
  "replyEnabled",
  "precheckEnabled",
  "perPersonaHourlyReplyLimit",
  "perPostCooldownSeconds",
  "precheckSimilarityThreshold",
] as const;

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

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

function addIssue(issues: PolicyValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

function toPatchWithIssues(
  value: unknown,
  path: string,
  issues: PolicyValidationIssue[],
): ReplyPolicyPatch {
  const record = asRecord(value);
  if (!record) {
    addIssue(issues, path, "policy patch must be an object");
    return {};
  }

  const patch = toPatch(record);
  for (const key of PATCH_KEYS) {
    if (key in record && !(key in patch)) {
      addIssue(issues, `${path}.${key}`, `invalid value type for ${key}`);
    }
  }
  return patch;
}

export function validatePolicyControlPlaneDocument(
  input: unknown,
): ValidatePolicyControlPlaneResult {
  const issues: PolicyValidationIssue[] = [];
  const root = asRecord(input);
  if (!root) {
    addIssue(issues, "root", "policy document must be an object");
    return {
      document: { global: {}, capabilities: {}, personas: {}, boards: {} },
      issues,
    };
  }

  const global = toPatchWithIssues(root.global, "global", issues);
  const capabilitiesInput = asRecord(root.capabilities);
  const personasInput = asRecord(root.personas);
  const boardsInput = asRecord(root.boards);

  if (!capabilitiesInput && root.capabilities !== undefined) {
    addIssue(issues, "capabilities", "capabilities must be an object");
  }
  if (!personasInput && root.personas !== undefined) {
    addIssue(issues, "personas", "personas must be an object");
  }
  if (!boardsInput && root.boards !== undefined) {
    addIssue(issues, "boards", "boards must be an object");
  }

  const capabilities: Record<string, ReplyPolicyPatch> = {};
  for (const [capability, value] of Object.entries(capabilitiesInput ?? {})) {
    if (capability !== "reply") {
      addIssue(issues, `capabilities.${capability}`, "unsupported capability key");
      continue;
    }
    capabilities[capability] = toPatchWithIssues(value, `capabilities.${capability}`, issues);
  }

  const personas: Record<string, ReplyPolicyPatch> = {};
  for (const [personaId, value] of Object.entries(personasInput ?? {})) {
    personas[personaId] = toPatchWithIssues(value, `personas.${personaId}`, issues);
  }

  const boards: Record<string, ReplyPolicyPatch> = {};
  for (const [boardId, value] of Object.entries(boardsInput ?? {})) {
    boards[boardId] = toPatchWithIssues(value, `boards.${boardId}`, issues);
  }

  return {
    document: { global, capabilities, personas, boards },
    issues,
  };
}

function flattenPolicyDocument(
  document: PolicyControlPlaneDocument,
): Map<string, boolean | number> {
  const map = new Map<string, boolean | number>();
  const normalized = validatePolicyControlPlaneDocument(document).document;
  const append = (prefix: string, patch: ReplyPolicyPatch | undefined) => {
    const record = patch ?? {};
    for (const key of PATCH_KEYS) {
      const value = record[key];
      if (value !== undefined) {
        map.set(`${prefix}.${key}`, value);
      }
    }
  };

  append("global", normalized.global);
  append("capabilities.reply", normalized.capabilities?.reply);

  for (const key of Object.keys(normalized.personas ?? {}).sort()) {
    append(`personas.${key}`, normalized.personas?.[key]);
  }

  for (const key of Object.keys(normalized.boards ?? {}).sort()) {
    append(`boards.${key}`, normalized.boards?.[key]);
  }

  return map;
}

export function diffPolicyDocuments(
  previous: PolicyControlPlaneDocument | null | undefined,
  next: PolicyControlPlaneDocument | null | undefined,
): PolicyDocumentDiff[] {
  const prevMap = flattenPolicyDocument(previous ?? {});
  const nextMap = flattenPolicyDocument(next ?? {});
  const keys = Array.from(new Set([...prevMap.keys(), ...nextMap.keys()])).sort();
  const diff: PolicyDocumentDiff[] = [];

  for (const key of keys) {
    const prevValue = prevMap.get(key);
    const nextValue = nextMap.get(key);
    if (!Object.is(prevValue, nextValue)) {
      diff.push({ path: key, previous: prevValue, next: nextValue });
    }
  }

  return diff;
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

  const validated = validatePolicyControlPlaneDocument(document).document;
  const globalPatch = toPatch(validated.global);
  const capabilityPatch = toPatch(validated.capabilities?.reply);
  const personaPatch = input.scope?.personaId
    ? toPatch(validated.personas?.[input.scope.personaId])
    : {};
  const boardPatch = input.scope?.boardId ? toPatch(validated.boards?.[input.scope.boardId]) : {};

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
      .select("version, policy, created_at, is_active, created_by, change_note")
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
      isActive: data.is_active === true,
      policy: validatePolicyControlPlaneDocument(data.policy).document,
      createdAt: String(data.created_at),
      createdBy: readString(data.created_by),
      note: readString(data.change_note),
    };
  }
}

type CachedPolicyProviderOptions = {
  store?: PolicyReleaseStore;
  ttlMs?: number;
  now?: () => Date;
  fallbackPolicy?: DispatcherPolicy;
  eventSink?: PolicyControlPlaneEventSink;
};

export class CachedReplyPolicyProvider implements ReplyPolicyProvider {
  private readonly store: PolicyReleaseStore;
  private readonly ttlMs: number;
  private readonly now: () => Date;
  private readonly fallbackPolicy: DispatcherPolicy;
  private readonly eventSink?: PolicyControlPlaneEventSink;
  private cachedRelease: PolicyRelease | null = null;
  private lastKnownGood: PolicyRelease | null = null;
  private cacheExpiresAtMs = 0;
  private lastReasonCode: PolicyControlPlaneReasonCodeValue | null = null;
  private lastLoadError: string | null = null;
  private lastFallbackReasonCode: PolicyControlPlaneReasonCodeValue | null = null;
  private lastFallbackAt: string | null = null;

  public constructor(options?: CachedPolicyProviderOptions) {
    this.store = options?.store ?? new SupabasePolicyReleaseStore();
    this.ttlMs = Math.max(1_000, options?.ttlMs ?? 30_000);
    this.now = options?.now ?? (() => new Date());
    this.fallbackPolicy = options?.fallbackPolicy ?? DEFAULT_DISPATCHER_POLICY;
    this.eventSink = options?.eventSink;
  }

  private async emit(
    reasonCode: PolicyControlPlaneReasonCodeValue,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const nowIso = this.now().toISOString();
    this.lastReasonCode = reasonCode;
    if (
      reasonCode === PolicyControlPlaneReasonCode.fallbackDefault ||
      reasonCode === PolicyControlPlaneReasonCode.fallbackLastKnownGood
    ) {
      this.lastFallbackReasonCode = reasonCode;
      this.lastFallbackAt = nowIso;
    }

    try {
      await this.eventSink?.record({
        reasonCode,
        occurredAt: nowIso,
        metadata,
      });
    } catch {
      // Best-effort observability only.
    }
  }

  public getStatus(): CachedReplyPolicyProviderStatus {
    return {
      cachedVersion: this.cachedRelease?.version ?? null,
      lastKnownGoodVersion: this.lastKnownGood?.version ?? null,
      cacheExpiresAt:
        this.cacheExpiresAtMs > 0 ? new Date(this.cacheExpiresAtMs).toISOString() : null,
      ttlMs: this.ttlMs,
      lastReasonCode: this.lastReasonCode,
      lastLoadError: this.lastLoadError,
      lastFallbackReasonCode: this.lastFallbackReasonCode,
      lastFallbackAt: this.lastFallbackAt,
    };
  }

  public async getReplyPolicy(scope?: ReplyPolicyScope): Promise<DispatcherPolicy> {
    const nowMs = this.now().getTime();
    if (this.cachedRelease && nowMs < this.cacheExpiresAtMs) {
      await this.emit(PolicyControlPlaneReasonCode.cacheHit, {
        version: this.cachedRelease.version,
        cacheExpiresAt: new Date(this.cacheExpiresAtMs).toISOString(),
      });
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
        this.lastLoadError = null;
        await this.emit(PolicyControlPlaneReasonCode.cacheRefresh, {
          version: latest.version,
          createdAt: latest.createdAt,
        });
      } else if (this.lastKnownGood) {
        this.cachedRelease = this.lastKnownGood;
        await this.emit(PolicyControlPlaneReasonCode.noActiveRelease);
        await this.emit(PolicyControlPlaneReasonCode.fallbackLastKnownGood, {
          version: this.lastKnownGood.version,
        });
      } else {
        await this.emit(PolicyControlPlaneReasonCode.noActiveRelease);
        this.cachedRelease = null;
        await this.emit(PolicyControlPlaneReasonCode.fallbackDefault);
      }
    } catch (error) {
      this.lastLoadError = error instanceof Error ? error.message : String(error);
      await this.emit(PolicyControlPlaneReasonCode.loadFailed, {
        error: this.lastLoadError,
      });
      // On read failure, keep serving last known good release.
      if (this.lastKnownGood) {
        this.cachedRelease = this.lastKnownGood;
        await this.emit(PolicyControlPlaneReasonCode.fallbackLastKnownGood, {
          version: this.lastKnownGood.version,
        });
      } else {
        this.cachedRelease = null;
        await this.emit(PolicyControlPlaneReasonCode.fallbackDefault);
      }
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
