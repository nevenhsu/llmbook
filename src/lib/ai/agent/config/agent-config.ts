import { createAdminClient } from "@/lib/supabase/admin";

export const AI_AGENT_CONFIG_KEYS = [
  "orchestrator_cooldown_minutes",
  "max_comments_per_cycle",
  "max_posts_per_cycle",
  "selector_reference_batch_size",
  "public_opportunity_cycle_limit",
  "public_opportunity_persona_limit",
  "llm_daily_token_quota",
  "llm_daily_image_quota",
  "usage_reset_timezone",
  "usage_reset_hour_local",
  "usage_reset_minute_local",
  "telegram_bot_token",
  "telegram_alert_chat_id",
  "memory_compress_interval_hours",
  "memory_compress_token_threshold",
  "comment_opportunity_cooldown_minutes",
  "post_opportunity_cooldown_minutes",
] as const;

export type AiAgentConfigKey = (typeof AI_AGENT_CONFIG_KEYS)[number];

export type AiAgentConfigRow = {
  key: string;
  value: string;
  description?: string | null;
  updated_at?: string | null;
};

export type AiAgentConfigEntry = {
  key: AiAgentConfigKey;
  value: string;
  description: string | null;
  updatedAt: string | null;
};

export type AiAgentConfig = {
  orchestratorCooldownMinutes: number;
  maxCommentsPerCycle: number;
  maxPostsPerCycle: number;
  selectorReferenceBatchSize: number;
  publicOpportunityCycleLimit: number;
  publicOpportunityPersonaLimit: number;
  llmDailyTokenQuota: number;
  llmDailyImageQuota: number;
  usageResetTimezone: string;
  usageResetHourLocal: number;
  usageResetMinuteLocal: number;
  telegramBotToken: string;
  telegramAlertChatId: string;
  memoryCompressIntervalHours: number;
  memoryCompressTokenThreshold: number;
  commentOpportunityCooldownMinutes: number;
  postOpportunityCooldownMinutes: number;
};

export type AiAgentConfigSnapshot = {
  values: AiAgentConfig;
  entries: Record<AiAgentConfigKey, AiAgentConfigEntry>;
};

const DEFAULT_AI_AGENT_CONFIG_ENTRIES: Record<
  AiAgentConfigKey,
  { value: string; description: string }
> = {
  orchestrator_cooldown_minutes: {
    value: "5",
    description: "每輪 Orchestrator 結束後的冷卻時間",
  },
  max_comments_per_cycle: {
    value: "5",
    description: "單次最多 comment selections",
  },
  max_posts_per_cycle: {
    value: "2",
    description: "單次最多 post selections",
  },
  selector_reference_batch_size: {
    value: "100",
    description: "每輪提供給 Selector 的 reference names 數量",
  },
  public_opportunity_cycle_limit: {
    value: "100",
    description: "Runtime 每輪 public/notification opportunities 最多處理的 opportunities 數量",
  },
  public_opportunity_persona_limit: {
    value: "3",
    description: "單一 public opportunity 累計可配對的 persona 上限",
  },
  llm_daily_token_quota: {
    value: "500000",
    description: "全局每日 text token 上限",
  },
  llm_daily_image_quota: {
    value: "50",
    description: "全局每日圖片生成次數上限",
  },
  usage_reset_timezone: {
    value: "Asia/Taipei",
    description: "每日 usage 重置所使用的時區",
  },
  usage_reset_hour_local: {
    value: "0",
    description: "每日 usage 重置的小時（local time）",
  },
  usage_reset_minute_local: {
    value: "0",
    description: "每日 usage 重置的分鐘（local time）",
  },
  telegram_bot_token: {
    value: "",
    description: "Telegram Bot Token（未建立時留空）",
  },
  telegram_alert_chat_id: {
    value: "",
    description: "Telegram alert chat ID",
  },
  memory_compress_interval_hours: {
    value: "6",
    description: "Memory compressor 執行週期",
  },
  memory_compress_token_threshold: {
    value: "2500",
    description: "壓縮觸發 token 上限",
  },
  comment_opportunity_cooldown_minutes: {
    value: "30",
    description: "同一 persona 對同一 comment/public thread 機會的冷卻時間",
  },
  post_opportunity_cooldown_minutes: {
    value: "360",
    description: "同一 persona 對同一 board 主動發文機會的冷卻時間",
  },
};

function isAiAgentConfigKey(value: string): value is AiAgentConfigKey {
  return (AI_AGENT_CONFIG_KEYS as readonly string[]).includes(value);
}

function normalizeIsoString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return new Date(timestamp).toISOString();
}

function readPositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function readNonNegativeInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function readHour(value: string, fallback: number): number {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 23) {
    return fallback;
  }
  return parsed;
}

function readMinute(value: string, fallback: number): number {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 59) {
    return fallback;
  }
  return parsed;
}

function readText(value: string, fallback: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function readOptionalText(value: string): string {
  return value.trim();
}

function buildEntry(
  key: AiAgentConfigKey,
  rowsByKey: Map<AiAgentConfigKey, AiAgentConfigRow>,
): AiAgentConfigEntry {
  const fallback = DEFAULT_AI_AGENT_CONFIG_ENTRIES[key];
  const row = rowsByKey.get(key);

  return {
    key,
    value: typeof row?.value === "string" ? row.value : fallback.value,
    description:
      typeof row?.description === "string" && row.description.trim().length > 0
        ? row.description
        : fallback.description,
    updatedAt: normalizeIsoString(row?.updated_at),
  };
}

export function parseAiAgentConfigRows(rows: AiAgentConfigRow[]): AiAgentConfigSnapshot {
  const rowsByKey = new Map<AiAgentConfigKey, AiAgentConfigRow>();
  for (const row of rows) {
    if (typeof row?.key === "string" && isAiAgentConfigKey(row.key)) {
      rowsByKey.set(row.key, row);
    }
  }

  const entries = {
    orchestrator_cooldown_minutes: buildEntry("orchestrator_cooldown_minutes", rowsByKey),
    max_comments_per_cycle: buildEntry("max_comments_per_cycle", rowsByKey),
    max_posts_per_cycle: buildEntry("max_posts_per_cycle", rowsByKey),
    selector_reference_batch_size: buildEntry("selector_reference_batch_size", rowsByKey),
    public_opportunity_cycle_limit: buildEntry("public_opportunity_cycle_limit", rowsByKey),
    public_opportunity_persona_limit: buildEntry("public_opportunity_persona_limit", rowsByKey),
    llm_daily_token_quota: buildEntry("llm_daily_token_quota", rowsByKey),
    llm_daily_image_quota: buildEntry("llm_daily_image_quota", rowsByKey),
    usage_reset_timezone: buildEntry("usage_reset_timezone", rowsByKey),
    usage_reset_hour_local: buildEntry("usage_reset_hour_local", rowsByKey),
    usage_reset_minute_local: buildEntry("usage_reset_minute_local", rowsByKey),
    telegram_bot_token: buildEntry("telegram_bot_token", rowsByKey),
    telegram_alert_chat_id: buildEntry("telegram_alert_chat_id", rowsByKey),
    memory_compress_interval_hours: buildEntry("memory_compress_interval_hours", rowsByKey),
    memory_compress_token_threshold: buildEntry("memory_compress_token_threshold", rowsByKey),
    comment_opportunity_cooldown_minutes: buildEntry(
      "comment_opportunity_cooldown_minutes",
      rowsByKey,
    ),
    post_opportunity_cooldown_minutes: buildEntry("post_opportunity_cooldown_minutes", rowsByKey),
  } satisfies Record<AiAgentConfigKey, AiAgentConfigEntry>;

  return {
    entries,
    values: {
      orchestratorCooldownMinutes: readNonNegativeInt(
        entries.orchestrator_cooldown_minutes.value,
        5,
      ),
      maxCommentsPerCycle: readNonNegativeInt(entries.max_comments_per_cycle.value, 5),
      maxPostsPerCycle: readNonNegativeInt(entries.max_posts_per_cycle.value, 2),
      selectorReferenceBatchSize: readPositiveInt(entries.selector_reference_batch_size.value, 100),
      publicOpportunityCycleLimit: readPositiveInt(
        entries.public_opportunity_cycle_limit.value,
        100,
      ),
      publicOpportunityPersonaLimit: readPositiveInt(
        entries.public_opportunity_persona_limit.value,
        3,
      ),
      llmDailyTokenQuota: readNonNegativeInt(entries.llm_daily_token_quota.value, 500_000),
      llmDailyImageQuota: readNonNegativeInt(entries.llm_daily_image_quota.value, 50),
      usageResetTimezone: readText(entries.usage_reset_timezone.value, "Asia/Taipei"),
      usageResetHourLocal: readHour(entries.usage_reset_hour_local.value, 0),
      usageResetMinuteLocal: readMinute(entries.usage_reset_minute_local.value, 0),
      telegramBotToken: readOptionalText(entries.telegram_bot_token.value),
      telegramAlertChatId: readOptionalText(entries.telegram_alert_chat_id.value),
      memoryCompressIntervalHours: readPositiveInt(entries.memory_compress_interval_hours.value, 6),
      memoryCompressTokenThreshold: readNonNegativeInt(
        entries.memory_compress_token_threshold.value,
        2_500,
      ),
      commentOpportunityCooldownMinutes: readNonNegativeInt(
        entries.comment_opportunity_cooldown_minutes.value,
        30,
      ),
      postOpportunityCooldownMinutes: readNonNegativeInt(
        entries.post_opportunity_cooldown_minutes.value,
        360,
      ),
    },
  };
}

type CachedAiAgentConfigProviderOptions = {
  ttlMs?: number;
  now?: () => Date;
};

export class CachedAiAgentConfigProvider {
  private readonly ttlMs: number;
  private readonly now: () => Date;
  private cacheExpiresAtMs = 0;
  private cachedSnapshot: AiAgentConfigSnapshot | null = null;

  public constructor(options?: CachedAiAgentConfigProviderOptions) {
    this.ttlMs = Math.max(1_000, options?.ttlMs ?? 30_000);
    this.now = options?.now ?? (() => new Date());
  }

  public async getConfig(): Promise<AiAgentConfigSnapshot> {
    const nowMs = this.now().getTime();
    if (this.cachedSnapshot && nowMs < this.cacheExpiresAtMs) {
      return this.cachedSnapshot;
    }

    try {
      const snapshot = parseAiAgentConfigRows(await this.readDbRows());
      this.cachedSnapshot = snapshot;
      this.cacheExpiresAtMs = nowMs + this.ttlMs;
      return snapshot;
    } catch (error) {
      if (this.cachedSnapshot) {
        return this.cachedSnapshot;
      }
      throw error;
    }
  }

  private async readDbRows(): Promise<AiAgentConfigRow[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_agent_config")
      .select("key, value, description, updated_at")
      .returns<AiAgentConfigRow[]>();

    if (error) {
      throw new Error(`load ai_agent_config failed: ${error.message}`);
    }

    return data ?? [];
  }
}

export async function loadAiAgentConfig(input?: {
  provider?: Pick<CachedAiAgentConfigProvider, "getConfig">;
}): Promise<AiAgentConfigSnapshot> {
  return (input?.provider ?? new CachedAiAgentConfigProvider()).getConfig();
}
