import { describe, expect, it, vi } from "vitest";
import {
  CachedAiAgentConfigProvider,
  parseAiAgentConfigRows,
} from "@/lib/ai/agent/config/agent-config";

describe("parseAiAgentConfigRows", () => {
  it("maps persisted ai_agent_config rows into typed runtime values", () => {
    const snapshot = parseAiAgentConfigRows([
      {
        key: "orchestrator_cooldown_minutes",
        value: "9",
        description: "cooldown",
        updated_at: "2026-03-29T10:00:00.000Z",
      },
      {
        key: "selector_reference_batch_size",
        value: "24",
        description: "batch size",
        updated_at: "2026-03-29T10:01:00.000Z",
      },
      {
        key: "public_opportunity_cycle_limit",
        value: "80",
        description: "cycle limit",
        updated_at: "2026-03-29T10:01:30.000Z",
      },
      {
        key: "public_opportunity_persona_limit",
        value: "4",
        description: "persona limit",
        updated_at: "2026-03-29T10:01:45.000Z",
      },
      {
        key: "usage_reset_timezone",
        value: "UTC",
        description: "tz",
        updated_at: "2026-03-29T10:02:00.000Z",
      },
      {
        key: "telegram_bot_token",
        value: "secret-token",
        description: "bot",
        updated_at: "2026-03-29T10:03:00.000Z",
      },
    ]);

    expect(snapshot.values.orchestratorCooldownMinutes).toBe(9);
    expect(snapshot.values.selectorReferenceBatchSize).toBe(24);
    expect(snapshot.values.publicOpportunityCycleLimit).toBe(80);
    expect(snapshot.values.publicOpportunityPersonaLimit).toBe(4);
    expect(snapshot.values.usageResetTimezone).toBe("UTC");
    expect(snapshot.values.telegramBotToken).toBe("secret-token");
    expect(snapshot.entries.selector_reference_batch_size.description).toBe("batch size");
    expect(snapshot.entries.selector_reference_batch_size.updatedAt).toBe(
      "2026-03-29T10:01:00.000Z",
    );
  });

  it("falls back to defaults when rows are missing or invalid", () => {
    const snapshot = parseAiAgentConfigRows([
      {
        key: "orchestrator_cooldown_minutes",
        value: "-5",
      },
      {
        key: "selector_reference_batch_size",
        value: "0",
      },
      {
        key: "public_opportunity_cycle_limit",
        value: "-2",
      },
      {
        key: "public_opportunity_persona_limit",
        value: "0",
      },
      {
        key: "usage_reset_hour_local",
        value: "88",
      },
      {
        key: "usage_reset_minute_local",
        value: "-7",
      },
      {
        key: "usage_reset_timezone",
        value: "   ",
      },
    ]);

    expect(snapshot.values.orchestratorCooldownMinutes).toBe(5);
    expect(snapshot.values.selectorReferenceBatchSize).toBe(100);
    expect(snapshot.values.publicOpportunityCycleLimit).toBe(100);
    expect(snapshot.values.publicOpportunityPersonaLimit).toBe(3);
    expect(snapshot.values.usageResetHourLocal).toBe(0);
    expect(snapshot.values.usageResetMinuteLocal).toBe(0);
    expect(snapshot.values.usageResetTimezone).toBe("Asia/Taipei");
    expect(snapshot.values.maxCommentsPerCycle).toBe(5);
    expect(snapshot.entries.max_comments_per_cycle.value).toBe("5");
  });
});

describe("CachedAiAgentConfigProvider", () => {
  it("uses ttl cache between reads", async () => {
    const now = { value: new Date("2026-03-29T00:00:00.000Z") };
    const provider = new CachedAiAgentConfigProvider({
      ttlMs: 30_000,
      now: () => now.value,
    });
    const stub = vi.fn(async () => [
      {
        key: "selector_reference_batch_size",
        value: "24",
      },
    ]);
    (provider as unknown as { readDbRows: typeof stub }).readDbRows = stub;

    const first = await provider.getConfig();
    const second = await provider.getConfig();

    expect(first.values.selectorReferenceBatchSize).toBe(24);
    expect(second.values.selectorReferenceBatchSize).toBe(24);
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("returns the last known good snapshot when refresh fails after cache expiry", async () => {
    const now = { value: new Date("2026-03-29T00:00:00.000Z") };
    const provider = new CachedAiAgentConfigProvider({
      ttlMs: 10_000,
      now: () => now.value,
    });
    const stub = vi
      .fn()
      .mockResolvedValueOnce([
        {
          key: "selector_reference_batch_size",
          value: "24",
        },
      ])
      .mockRejectedValueOnce(new Error("db unavailable"));
    (provider as unknown as { readDbRows: typeof stub }).readDbRows = stub;

    const first = await provider.getConfig();
    now.value = new Date("2026-03-29T00:00:20.000Z");
    const second = await provider.getConfig();

    expect(first.values.selectorReferenceBatchSize).toBe(24);
    expect(second.values.selectorReferenceBatchSize).toBe(24);
    expect(stub).toHaveBeenCalledTimes(2);
  });

  it("throws when the initial db read fails and no cached snapshot exists", async () => {
    const provider = new CachedAiAgentConfigProvider();
    const stub = vi.fn(async () => {
      throw new Error("db unavailable");
    });
    (provider as unknown as { readDbRows: typeof stub }).readDbRows = stub;

    await expect(provider.getConfig()).rejects.toThrow("db unavailable");
  });
});
