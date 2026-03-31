"use client";

import { useState } from "react";
import AiAgentPanel from "@/components/admin/agent-panel/AiAgentPanel";
import mockData from "@/mock-data/ai-agent-panel.json";
import type { AiAgentOverviewSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import type { AiAgentConfigSnapshot } from "@/lib/ai/agent/config/agent-config";

type MockState = "default" | "empty";

function buildEmptyConfig(): AiAgentConfigSnapshot {
  return {
    entries: {
      orchestrator_cooldown_minutes: {
        key: "orchestrator_cooldown_minutes",
        value: "0",
        description: "cooldown",
        updatedAt: null,
      },
      max_comments_per_cycle: {
        key: "max_comments_per_cycle",
        value: "0",
        description: "max comments",
        updatedAt: null,
      },
      max_posts_per_cycle: {
        key: "max_posts_per_cycle",
        value: "0",
        description: "max posts",
        updatedAt: null,
      },
      selector_reference_batch_size: {
        key: "selector_reference_batch_size",
        value: "0",
        description: "batch size",
        updatedAt: null,
      },
      llm_daily_token_quota: {
        key: "llm_daily_token_quota",
        value: "0",
        description: "token quota",
        updatedAt: null,
      },
      llm_daily_image_quota: {
        key: "llm_daily_image_quota",
        value: "0",
        description: "image quota",
        updatedAt: null,
      },
      usage_reset_timezone: {
        key: "usage_reset_timezone",
        value: "UTC",
        description: "tz",
        updatedAt: null,
      },
      usage_reset_hour_local: {
        key: "usage_reset_hour_local",
        value: "0",
        description: "hour",
        updatedAt: null,
      },
      usage_reset_minute_local: {
        key: "usage_reset_minute_local",
        value: "0",
        description: "minute",
        updatedAt: null,
      },
      telegram_bot_token: {
        key: "telegram_bot_token",
        value: "",
        description: "bot",
        updatedAt: null,
      },
      telegram_alert_chat_id: {
        key: "telegram_alert_chat_id",
        value: "",
        description: "chat",
        updatedAt: null,
      },
      memory_compress_interval_hours: {
        key: "memory_compress_interval_hours",
        value: "0",
        description: "compress interval",
        updatedAt: null,
      },
      memory_compress_token_threshold: {
        key: "memory_compress_token_threshold",
        value: "0",
        description: "compress threshold",
        updatedAt: null,
      },
      comment_opportunity_cooldown_minutes: {
        key: "comment_opportunity_cooldown_minutes",
        value: "0",
        description: "comment cooldown",
        updatedAt: null,
      },
      post_opportunity_cooldown_minutes: {
        key: "post_opportunity_cooldown_minutes",
        value: "0",
        description: "post cooldown",
        updatedAt: null,
      },
    },
    values: {
      orchestratorCooldownMinutes: 0,
      maxCommentsPerCycle: 0,
      maxPostsPerCycle: 0,
      selectorReferenceBatchSize: 0,
      llmDailyTokenQuota: 0,
      llmDailyImageQuota: 0,
      usageResetTimezone: "UTC",
      usageResetHourLocal: 0,
      usageResetMinuteLocal: 0,
      telegramBotToken: "",
      telegramAlertChatId: "",
      memoryCompressIntervalHours: 0,
      memoryCompressTokenThreshold: 0,
      commentOpportunityCooldownMinutes: 0,
      postOpportunityCooldownMinutes: 0,
    },
  };
}

function buildEmptySnapshot(): AiAgentOverviewSnapshot {
  return {
    config: buildEmptyConfig(),
    queue: { pending: 0, running: 0, inReview: 0, done: 0, failed: 0, skipped: 0, total: 0 },
    usage: {
      windowStart: "2026-03-29T00:00:00.000Z",
      windowEnd: null,
      textPromptTokens: 0,
      textCompletionTokens: 0,
      imageGenerationCount: 0,
      updatedAt: "2026-03-29T01:00:00.000Z",
    },
    checkpoints: [],
    latestRun: null,
    recentTasks: [],
    recentRuns: [],
    recentMediaJobs: [],
    runtimeState: {
      available: false,
      statusLabel: "Unavailable",
      detail: "No runtime state available.",
      paused: null,
      leaseOwner: null,
      leaseUntil: null,
      cooldownUntil: null,
      lastStartedAt: null,
      lastFinishedAt: null,
    },
  };
}

export default function PreviewAiAgentPanelPage() {
  const [mockState, setMockState] = useState<MockState>("default");

  const snapshot: AiAgentOverviewSnapshot =
    mockState === "empty" ? buildEmptySnapshot() : (mockData as unknown as AiAgentOverviewSnapshot);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-base-content/50 text-sm font-semibold tracking-[0.24em] uppercase">
          Mock State
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className={`btn btn-sm ${mockState === "default" ? "btn-neutral" : "btn-outline"}`}
            onClick={() => setMockState("default")}
          >
            Default
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mockState === "empty" ? "btn-neutral" : "btn-outline"}`}
            onClick={() => setMockState("empty")}
          >
            Empty
          </button>
        </div>
      </div>

      <AiAgentPanel
        initialSnapshot={snapshot}
        runtimePreviews={null}
        runtimeMemoryPreviews={null}
      />
    </div>
  );
}
