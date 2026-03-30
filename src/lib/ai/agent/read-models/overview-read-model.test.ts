import { describe, expect, it } from "vitest";
import {
  AiAgentOverviewStore,
  type AiAgentCheckpointSnapshot,
  type AiAgentLatestRunSnapshot,
  type AiAgentUsageSnapshot,
} from "@/lib/ai/agent/read-models/overview-read-model";
import type { AiAgentConfigSnapshot } from "@/lib/ai/agent/config/agent-config";

function buildConfigSnapshot(
  overrides: Partial<AiAgentConfigSnapshot["values"]> = {},
): AiAgentConfigSnapshot {
  return {
    entries: {
      orchestrator_cooldown_minutes: {
        key: "orchestrator_cooldown_minutes",
        value: "5",
        description: "cooldown",
        updatedAt: null,
      },
      max_comments_per_cycle: {
        key: "max_comments_per_cycle",
        value: "5",
        description: "max comments",
        updatedAt: null,
      },
      max_posts_per_cycle: {
        key: "max_posts_per_cycle",
        value: "2",
        description: "max posts",
        updatedAt: null,
      },
      selector_reference_batch_size: {
        key: "selector_reference_batch_size",
        value: "100",
        description: "batch size",
        updatedAt: null,
      },
      llm_daily_token_quota: {
        key: "llm_daily_token_quota",
        value: "500000",
        description: "token quota",
        updatedAt: null,
      },
      llm_daily_image_quota: {
        key: "llm_daily_image_quota",
        value: "50",
        description: "image quota",
        updatedAt: null,
      },
      usage_reset_timezone: {
        key: "usage_reset_timezone",
        value: "Asia/Taipei",
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
        value: "6",
        description: "compress interval",
        updatedAt: null,
      },
      memory_compress_token_threshold: {
        key: "memory_compress_token_threshold",
        value: "2500",
        description: "compress threshold",
        updatedAt: null,
      },
      comment_opportunity_cooldown_minutes: {
        key: "comment_opportunity_cooldown_minutes",
        value: "30",
        description: "comment cooldown",
        updatedAt: null,
      },
      post_opportunity_cooldown_minutes: {
        key: "post_opportunity_cooldown_minutes",
        value: "360",
        description: "post cooldown",
        updatedAt: null,
      },
    },
    values: {
      orchestratorCooldownMinutes: 5,
      maxCommentsPerCycle: 5,
      maxPostsPerCycle: 2,
      selectorReferenceBatchSize: 100,
      llmDailyTokenQuota: 500000,
      llmDailyImageQuota: 50,
      usageResetTimezone: "Asia/Taipei",
      usageResetHourLocal: 0,
      usageResetMinuteLocal: 0,
      telegramBotToken: "",
      telegramAlertChatId: "",
      memoryCompressIntervalHours: 6,
      memoryCompressTokenThreshold: 2500,
      commentOpportunityCooldownMinutes: 30,
      postOpportunityCooldownMinutes: 360,
      ...overrides,
    },
  };
}

describe("AiAgentOverviewStore", () => {
  it("aggregates config, queue state, usage, checkpoints, and latest run", async () => {
    const usage: AiAgentUsageSnapshot = {
      windowStart: "2026-03-29T00:00:00.000Z",
      windowEnd: null,
      textPromptTokens: 1200,
      textCompletionTokens: 300,
      imageGenerationCount: 2,
      updatedAt: "2026-03-29T01:00:00.000Z",
    };
    const checkpoints: AiAgentCheckpointSnapshot[] = [
      {
        sourceName: "comments",
        lastCapturedAt: "2026-03-29T01:00:00.000Z",
        safetyOverlapSeconds: 10,
      },
      {
        sourceName: "notifications",
        lastCapturedAt: "2026-03-29T01:02:00.000Z",
        safetyOverlapSeconds: 10,
      },
    ];
    const latestRun: AiAgentLatestRunSnapshot = {
      runAt: "2026-03-29T01:05:00.000Z",
      snapshotFrom: "2026-03-29T01:00:00.000Z",
      snapshotTo: "2026-03-29T01:05:00.000Z",
      commentsInjected: 3,
      postsInjected: 1,
      skippedReason: null,
      metadata: {
        mode: "executed",
        selector: {
          candidates: 4,
        },
      },
    };
    const store = new AiAgentOverviewStore({
      deps: {
        loadConfig: async () => buildConfigSnapshot(),
        loadTaskStatuses: async () => [
          { status: "PENDING" },
          { status: "PENDING" },
          { status: "RUNNING" },
          { status: "FAILED" },
        ],
        loadUsage: async () => usage,
        loadCheckpoints: async () => checkpoints,
        loadLatestRun: async () => latestRun,
        loadRecentTasks: async () => [
          {
            id: "task-1",
            personaId: "persona-1",
            personaUsername: "ai_orchid",
            personaDisplayName: "Orchid",
            taskType: "comment",
            dispatchKind: "public",
            sourceTable: "comments",
            sourceId: "comment-1",
            dedupeKey: "ai_orchid:comment-1:comment",
            cooldownUntil: "2026-03-29T06:00:00.000Z",
            decisionReason: "high affinity",
            payload: { contentType: "comment" },
            status: "PENDING",
            scheduledAt: "2026-03-29T01:03:00.000Z",
            startedAt: null,
            completedAt: null,
            retryCount: 0,
            maxRetries: 3,
            leaseOwner: null,
            leaseUntil: null,
            resultId: null,
            resultType: null,
            errorMessage: null,
            createdAt: "2026-03-29T01:02:00.000Z",
          },
        ],
        loadRecentRuns: async () => [latestRun],
        loadRecentMediaJobs: async () => [
          {
            id: "media-1",
            personaId: "persona-1",
            personaUsername: "ai_orchid",
            personaDisplayName: "Orchid",
            postId: "post-1",
            commentId: null,
            status: "DONE",
            imagePrompt: "Cinematic cosmic scene",
            url: "https://cdn.test/media-1.png",
            mimeType: "image/png",
            width: 1024,
            height: 1024,
            sizeBytes: 4096,
            createdAt: "2026-03-29T01:06:00.000Z",
          },
        ],
        loadRuntimeState: async () => ({
          available: true,
          statusLabel: "Ready",
          detail: "Runtime state row is available.",
          paused: false,
          leaseOwner: null,
          leaseUntil: null,
          cooldownUntil: null,
          lastStartedAt: "2026-03-29T01:10:00.000Z",
          lastFinishedAt: "2026-03-29T01:11:00.000Z",
        }),
      },
    });

    const snapshot = await store.getSnapshot();

    expect(snapshot.queue.total).toBe(4);
    expect(snapshot.queue.pending).toBe(2);
    expect(snapshot.queue.running).toBe(1);
    expect(snapshot.queue.failed).toBe(1);
    expect(snapshot.config.values.selectorReferenceBatchSize).toBe(100);
    expect(snapshot.usage?.textPromptTokens).toBe(1200);
    expect(snapshot.checkpoints[0]?.sourceName).toBe("comments");
    expect(snapshot.latestRun?.commentsInjected).toBe(3);
    expect(snapshot.recentTasks[0]?.personaUsername).toBe("ai_orchid");
    expect(snapshot.recentTasks[0]?.dedupeKey).toBe("ai_orchid:comment-1:comment");
    expect(snapshot.recentRuns[0]?.postsInjected).toBe(1);
    expect(snapshot.recentRuns[0]?.metadata).toEqual({
      mode: "executed",
      selector: {
        candidates: 4,
      },
    });
    expect(snapshot.recentMediaJobs[0]?.status).toBe("DONE");
    expect(snapshot.recentMediaJobs[0]?.url).toBe("https://cdn.test/media-1.png");
    expect(snapshot.runtimeState.available).toBe(true);
    expect(snapshot.runtimeState.statusLabel).toBe("Ready");
  });

  it("returns empty-safe overview values when optional tables have no rows yet", async () => {
    const store = new AiAgentOverviewStore({
      deps: {
        loadConfig: async () => buildConfigSnapshot({ selectorReferenceBatchSize: 24 }),
        loadTaskStatuses: async () => [],
        loadUsage: async () => null,
        loadCheckpoints: async () => [],
        loadLatestRun: async () => null,
        loadRecentTasks: async () => [],
        loadRecentRuns: async () => [],
        loadRecentMediaJobs: async () => [],
        loadRuntimeState: async () => ({
          available: false,
          statusLabel: "Unavailable",
          detail: "orchestrator_runtime_state row is missing.",
          paused: null,
          leaseOwner: null,
          leaseUntil: null,
          cooldownUntil: null,
          lastStartedAt: null,
          lastFinishedAt: null,
        }),
      },
    });

    const snapshot = await store.getSnapshot();

    expect(snapshot.queue.total).toBe(0);
    expect(snapshot.usage).toBeNull();
    expect(snapshot.checkpoints).toEqual([]);
    expect(snapshot.latestRun).toBeNull();
    expect(snapshot.recentTasks).toEqual([]);
    expect(snapshot.recentRuns).toEqual([]);
    expect(snapshot.recentMediaJobs).toEqual([]);
    expect(snapshot.config.values.selectorReferenceBatchSize).toBe(24);
  });
});
