import { describe, expect, it } from "vitest";
import {
  buildCompressionBatchPreview,
  buildMemoryPersonaPreview,
  type AiAgentMemoryPersonaOption,
} from "@/lib/ai/agent/memory";
import { buildMockMemoryPreviewSet } from "@/lib/ai/agent/testing/mock-memory-preview";
import { buildMockAiAgentOverviewSnapshot } from "@/lib/ai/agent/testing/mock-overview-snapshot";

describe("memory-preview builders", () => {
  it("builds a latest write preview and compression artifacts from shared entries", () => {
    const mock = buildMockMemoryPreviewSet();
    const persona = mock.personas[0] as AiAgentMemoryPersonaOption;
    const preview = buildMemoryPersonaPreview({
      persona,
      entries: mock.previews[0].recentShortMemories.concat(
        mock.previews[0].canonicalLongMemory ? [mock.previews[0].canonicalLongMemory] : [],
      ),
      recentTasks: buildMockAiAgentOverviewSnapshot().recentTasks.map((task) => ({
        ...task,
        personaId: persona.personaId,
        status: "DONE",
      })),
    });

    expect(preview.latestWritePreview.path).toBe("deterministic_comment");
    expect(preview.compressionBatchPreview.selectedShortMemoryIds.length).toBeGreaterThan(0);
    expect(preview.compressionPreview.renderedLongMemory).toContain("Canonical Memory");
  });

  it("keeps open-loop rows protected in compression batch preview", () => {
    const mock = buildMockMemoryPreviewSet();
    const preview = buildCompressionBatchPreview({
      persona: mock.personas[0],
      recentShortMemories: mock.previews[0].recentShortMemories,
      canonicalLongMemory: mock.previews[0].canonicalLongMemory,
    });

    expect(preview.protectedRows.some((row) => row.reason === "unresolved_open_loop")).toBe(true);
  });
});
