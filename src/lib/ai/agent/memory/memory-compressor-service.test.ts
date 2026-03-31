import { describe, expect, it, vi } from "vitest";
import {
  AiAgentMemoryCompressorService,
  buildMemoryCompressionSelection,
} from "@/lib/ai/agent/memory/memory-compressor-service";
import { buildMockMemoryPreviewSet } from "@/lib/ai/agent/testing/mock-memory-preview";

const COOLING_RUNTIME_STATE = {
  available: true,
  statusLabel: "Cooling Down",
  detail: "Runtime cooldown is active until 2026-04-10T06:00:00.000Z.",
  paused: false,
  leaseOwner: null,
  leaseUntil: null,
  cooldownUntil: "2026-04-10T06:00:00.000Z",
  lastStartedAt: "2026-04-10T05:00:00.000Z",
  lastFinishedAt: "2026-04-10T05:05:00.000Z",
} as const;

describe("AiAgentMemoryCompressorService", () => {
  it("prioritizes personas with open loops when the queue is rebuilt", () => {
    const previewSet = buildMockMemoryPreviewSet();
    const selection = buildMemoryCompressionSelection({
      previews: previewSet.previews,
      compressionStates: new Map(),
      config: {
        memoryCompressIntervalHours: 6,
        memoryCompressTokenThreshold: 10_000,
      },
      now: new Date("2026-04-10T05:10:00.000Z"),
    });

    expect(selection.queue[0]?.personaId).toBe("persona-1");
    expect(selection.queue[0]?.queueReason).toBe("oldest_memory_threshold");
    expect(selection.queue[0]?.priorityScore).toBeGreaterThan(
      selection.queue[1]?.priorityScore ?? 0,
    );
  });

  it("skips personas with an active defer marker when the memory fingerprint is unchanged", () => {
    const previewSet = buildMockMemoryPreviewSet();
    const personaOnePreview = previewSet.previews.find(
      (preview) => preview.persona.personaId === "persona-1",
    );
    if (!personaOnePreview) {
      throw new Error("missing persona-1 preview");
    }

    const selection = buildMemoryCompressionSelection({
      previews: previewSet.previews,
      compressionStates: new Map([
        [
          "persona-1",
          {
            lastEvaluatedAt: "2026-04-10T04:00:00.000Z",
            lastDecision: "deferred",
            deferUntil: "2026-04-10T07:00:00.000Z",
            reasonCode: "below_threshold",
            priorityScore: 12,
            queueReason: null,
            selectedShortMemoryIds: [],
            inputFingerprint: [
              "persona-1",
              personaOnePreview.persona.shortMemoryCount,
              personaOnePreview.persona.compressibleCount,
              personaOnePreview.persona.openLoopCount,
              personaOnePreview.recentShortMemories[0]?.updatedAt ?? "none",
              personaOnePreview.canonicalLongMemory?.updatedAt ?? "none",
            ].join(":"),
          },
        ],
      ]),
      config: {
        memoryCompressIntervalHours: 6,
        memoryCompressTokenThreshold: 10_000,
      },
      now: new Date("2026-04-10T05:10:00.000Z"),
    });

    expect(selection.activeDeferrals).toContain("persona-1");
    expect(selection.queue.some((item) => item.personaId === "persona-1")).toBe(false);
  });

  it("blocks while text tasks are still pending or running", async () => {
    const service = new AiAgentMemoryCompressorService({
      deps: {
        loadRuntimeState: async () => COOLING_RUNTIME_STATE,
        countActiveTextTasks: async () => 2,
        getRuntimePreviewSet: async () => buildMockMemoryPreviewSet(),
        loadConfig: async () => ({
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
        }),
      },
    });

    await expect(service.runNext()).resolves.toMatchObject({
      mode: "blocked",
      reasonCode: "text_lane_busy",
      activeTextTasks: 2,
    });
  });

  it("persists defer markers for personas that were evaluated but do not need compression yet", async () => {
    const persistedStates: Array<{ personaId: string; state: Record<string, unknown> }> = [];
    const service = new AiAgentMemoryCompressorService({
      deps: {
        loadRuntimeState: async () => ({
          ...COOLING_RUNTIME_STATE,
          cooldownUntil: "2026-03-30T06:00:00.000Z",
        }),
        countActiveTextTasks: async () => 0,
        getRuntimePreviewSet: async () => buildMockMemoryPreviewSet(),
        loadCompressionStates: async () => new Map(),
        persistCompressionState: async (personaId, state) => {
          persistedStates.push({ personaId, state });
        },
        compressPersona: vi.fn(),
        loadConfig: async () => ({
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
          memoryCompressTokenThreshold: 10_000,
          commentOpportunityCooldownMinutes: 30,
          postOpportunityCooldownMinutes: 360,
        }),
        now: () => new Date("2026-03-30T05:10:00.000Z"),
      },
    });

    await expect(service.runNext()).resolves.toMatchObject({
      mode: "idle",
      queueLength: 0,
    });
    expect(persistedStates.length).toBe(2);
    expect(persistedStates.every((item) => item.state.reasonCode === "below_threshold")).toBe(true);
  });

  it("compresses the highest-priority persona and persists a compressed marker", async () => {
    const persistedStates: Array<{ personaId: string; state: Record<string, unknown> }> = [];
    const compressPersona = vi.fn(async (personaId: string) => ({
      mode: "persisted" as const,
      personaId,
      summary: `Persisted compression for ${personaId}.`,
      compressionPreview: buildMockMemoryPreviewSet().previews[0].compressionPreview,
      persistedLongMemoryId: "long-memory-9",
      deletedShortMemoryIds: ["memory-board-1"],
      protectedShortMemoryIds: ["memory-thread-1"],
      verificationTrace: {
        persistedLongMemoryId: "long-memory-9",
        persistedLongMemory: buildMockMemoryPreviewSet().previews[0].canonicalLongMemory,
        cleanup: {
          deletedShortMemoryIds: ["memory-board-1"],
          protectedShortMemoryIds: ["memory-thread-1"],
        },
      },
      preview: buildMockMemoryPreviewSet().previews[0],
    }));
    const service = new AiAgentMemoryCompressorService({
      deps: {
        loadRuntimeState: async () => COOLING_RUNTIME_STATE,
        countActiveTextTasks: async () => 0,
        getRuntimePreviewSet: async () => buildMockMemoryPreviewSet(),
        loadCompressionStates: async () => new Map(),
        persistCompressionState: async (personaId, state) => {
          persistedStates.push({ personaId, state });
        },
        compressPersona,
        loadConfig: async () => ({
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
          memoryCompressTokenThreshold: 10_000,
          commentOpportunityCooldownMinutes: 30,
          postOpportunityCooldownMinutes: 360,
        }),
        now: () => new Date("2026-04-10T05:10:00.000Z"),
      },
    });

    await expect(service.runNext()).resolves.toMatchObject({
      mode: "executed",
      selected: {
        personaId: "persona-1",
        queueReason: "oldest_memory_threshold",
      },
      compressionResult: {
        personaId: "persona-1",
      },
    });
    expect(compressPersona).toHaveBeenCalledWith("persona-1");
    expect(
      persistedStates.some(
        (item) => item.personaId === "persona-1" && item.state.lastDecision === "compressed",
      ),
    ).toBe(true);
  });
});
