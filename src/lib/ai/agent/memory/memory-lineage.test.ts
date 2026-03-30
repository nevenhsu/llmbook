import { describe, expect, it } from "vitest";
import {
  buildMemoryLineageSummary,
  buildMemoryOutcomeTrace,
} from "@/lib/ai/agent/memory/memory-lineage";
import { buildMockMemoryPreviewSet } from "@/lib/ai/agent/testing/mock-memory-preview";
import { buildMockAiAgentOverviewSnapshot } from "@/lib/ai/agent/testing/mock-overview-snapshot";

describe("memory-lineage", () => {
  it("builds task-to-memory lineage from selected task, latest write preview, and persisted traces", () => {
    const preview = buildMockMemoryPreviewSet().previews[0];
    const task = buildMockAiAgentOverviewSnapshot().recentTasks[0];

    const summary = buildMemoryLineageSummary({
      selectedTask: task,
      activeMemoryPreview: preview,
      latestWriteResult: {
        mode: "persisted",
        personaId: "persona-1",
        summary: "Persisted latest memory write for persona-1.",
        persistedMemoryId: "memory-write-1",
        latestWritePreview: preview.latestWritePreview,
        verificationTrace: {
          persistedMemoryId: "memory-write-1",
          selectedTaskId: "task-1",
          persistedMemory: null,
        },
        preview,
      },
      compressionResult: {
        mode: "persisted",
        personaId: "persona-1",
        summary: "Persisted canonical long memory.",
        compressionPreview: preview.compressionPreview,
        persistedLongMemoryId: "long-memory-1",
        deletedShortMemoryIds: ["memory-board-1"],
        protectedShortMemoryIds: ["memory-thread-1"],
        verificationTrace: {
          persistedLongMemoryId: "long-memory-1",
          persistedLongMemory: null,
          cleanup: {
            deletedShortMemoryIds: ["memory-board-1"],
            protectedShortMemoryIds: ["memory-thread-1"],
          },
        },
        preview,
      },
    });

    expect(summary?.selectedTaskId).toBe("task-1");
    expect(summary?.latestWriteSelectedTaskId).toBe("task-1");
    expect(summary?.latestWriteMatchesSelectedTask).toBe(true);
    expect(summary?.latestWritePersistMatchesSelectedTask).toBe(true);
    expect(summary?.latestWritePersistedMemoryId).toBe("memory-write-1");
    expect(summary?.compressionPersistedLongMemoryId).toBe("long-memory-1");
  });

  it("builds an operator-friendly outcome trace across task, latest-write, and compression stages", () => {
    const preview = buildMockMemoryPreviewSet().previews[0];
    const task = buildMockAiAgentOverviewSnapshot().recentTasks[0];

    const trace = buildMemoryOutcomeTrace({
      selectedTask: task,
      activeMemoryPreview: preview,
      latestWriteResult: {
        mode: "persisted",
        personaId: "persona-1",
        summary: "Persisted latest memory write for persona-1.",
        persistedMemoryId: "memory-write-1",
        latestWritePreview: preview.latestWritePreview,
        verificationTrace: {
          persistedMemoryId: "memory-write-1",
          selectedTaskId: "task-1",
          persistedMemory: null,
        },
        preview,
      },
      compressionResult: {
        mode: "persisted",
        personaId: "persona-1",
        summary: "Persisted canonical long memory.",
        compressionPreview: preview.compressionPreview,
        persistedLongMemoryId: "long-memory-1",
        deletedShortMemoryIds: ["memory-board-1"],
        protectedShortMemoryIds: ["memory-thread-1"],
        verificationTrace: {
          persistedLongMemoryId: "long-memory-1",
          persistedLongMemory: null,
          cleanup: {
            deletedShortMemoryIds: ["memory-board-1"],
            protectedShortMemoryIds: ["memory-thread-1"],
          },
        },
        preview,
      },
    });

    expect(trace).toMatchObject({
      selectedTaskId: "task-1",
      latestWriteCandidateTaskId: "task-1",
      latestWritePersistedMemoryId: "memory-write-1",
      compressionPersistedLongMemoryId: "long-memory-1",
      allStagesSharePersona: true,
      latestWriteCandidateMatchesSelectedTask: true,
      latestWritePersistMatchesSelectedTask: true,
      stageStatus: {
        taskSelected: true,
        latestWriteCandidateReady: true,
        latestWritePersisted: true,
        compressionPersisted: true,
      },
    });
  });
});
