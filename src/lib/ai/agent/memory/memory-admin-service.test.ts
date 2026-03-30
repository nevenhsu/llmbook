import { describe, expect, it } from "vitest";
import { AiAgentMemoryAdminService } from "@/lib/ai/agent/memory";
import { buildMockMemoryPreviewSet } from "@/lib/ai/agent/testing/mock-memory-preview";

describe("AiAgentMemoryAdminService", () => {
  it("returns persona-scoped memory preview artifacts", async () => {
    const mock = buildMockMemoryPreviewSet();
    const service = new AiAgentMemoryAdminService({
      getRuntimePreviewSet: async () => mock,
    } as any);

    const preview = await service.getPersonaPreview("persona-1");

    expect(preview.persona.username).toBe("ai_orchid");
    expect(preview.latestWritePreview.path).toBe("deterministic_comment");
  });

  it("throws when the requested persona preview is missing", async () => {
    const mock = buildMockMemoryPreviewSet();
    const service = new AiAgentMemoryAdminService({
      getRuntimePreviewSet: async () => mock,
    } as any);

    await expect(service.getPersonaPreview("persona-x")).rejects.toThrow(
      "persona preview not found",
    );
  });

  it("persists compression artifacts and returns the refreshed preview", async () => {
    const mock = buildMockMemoryPreviewSet();
    const deleteCanonicalLongMemories = async () => {};
    const insertCanonicalLongMemory = async () => ({
      id: "long-memory-2",
      updated_at: "2026-03-29T12:00:00.000Z",
    });
    const deleteShortMemories = async () => {};
    const service = new AiAgentMemoryAdminService(
      {
        getRuntimePreviewSet: async () => mock,
      } as any,
      {
        deleteCanonicalLongMemories,
        insertCanonicalLongMemory,
        deleteShortMemories,
      },
    );

    const result = await service.compressPersona("persona-1");

    expect(result.mode).toBe("persisted");
    if (result.mode !== "persisted") {
      throw new Error("expected persisted result");
    }
    expect(result.personaId).toBe("persona-1");
    expect(result.compressionPreview.renderedLongMemory).toContain("Canonical Memory");
    expect(result.persistedLongMemoryId).toBe("long-memory-2");
    expect(result.deletedShortMemoryIds.length).toBeGreaterThan(0);
    expect(result.preview.persona.personaId).toBe("persona-1");
    expect(result.verificationTrace.persistedLongMemoryId).toBe("long-memory-2");
    expect(result.verificationTrace.cleanup.deletedShortMemoryIds).toEqual(
      result.deletedShortMemoryIds,
    );
    expect(result.verificationTrace.cleanup.protectedShortMemoryIds).toEqual(
      result.protectedShortMemoryIds,
    );
    expect(result.verificationTrace.persistedLongMemory?.content).toContain("Canonical Memory");
  });

  it("persists latest-write artifacts and returns the refreshed preview", async () => {
    const mock = buildMockMemoryPreviewSet();
    const insertShortMemory = async () => ({
      id: "memory-write-1",
      updated_at: "2026-03-29T12:10:00.000Z",
    });
    const service = new AiAgentMemoryAdminService(
      {
        getRuntimePreviewSet: async () => mock,
      } as any,
      {
        insertShortMemory,
      },
    );

    const result = await service.persistLatestWrite("persona-1");

    expect(result.mode).toBe("persisted");
    if (result.mode !== "persisted") {
      throw new Error("expected persisted result");
    }
    expect(result.persistedMemoryId).toBe("memory-write-1");
    expect(result.latestWritePreview.path).toBe("deterministic_comment");
    expect(result.verificationTrace.persistedMemoryId).toBe("memory-write-1");
    expect(result.verificationTrace.selectedTaskId).toBe("task-1");
    expect(result.verificationTrace.persistedMemory?.content).toContain("Thread memory for Orchid");
  });
});
