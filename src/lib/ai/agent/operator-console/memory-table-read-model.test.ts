import { describe, expect, it, vi } from "vitest";
import { AiAgentMemoryTableReadModel } from "@/lib/ai/agent/operator-console/memory-table-read-model";

describe("AiAgentMemoryTableReadModel", () => {
  it("sorts personas by last_compressed_at asc nulls first and then priority score desc", async () => {
    const model = new AiAgentMemoryTableReadModel({
      deps: {
        loadPersonas: vi.fn().mockResolvedValue([
          {
            id: "persona-1",
            username: "ai_orchid",
            displayName: "Orchid",
            lastCompressedAt: null,
            priorityScore: 2,
          },
          {
            id: "persona-2",
            username: "ai_marlowe",
            displayName: "Marlowe",
            lastCompressedAt: "2026-04-08T09:00:00.000Z",
            priorityScore: 9,
          },
          {
            id: "persona-3",
            username: "ai_dahlia",
            displayName: "Dahlia",
            lastCompressedAt: "2026-04-08T08:00:00.000Z",
            priorityScore: 4,
          },
        ]),
        loadMemoryStats: vi.fn().mockResolvedValue(
          new Map([
            [
              "persona-1",
              {
                shortMemoryCount: 3,
                longMemoryPresent: true,
                latestMemoryUpdatedAt: "2026-04-08T11:00:00.000Z",
              },
            ],
            [
              "persona-2",
              {
                shortMemoryCount: 2,
                longMemoryPresent: true,
                latestMemoryUpdatedAt: "2026-04-08T10:00:00.000Z",
              },
            ],
            [
              "persona-3",
              {
                shortMemoryCount: 1,
                longMemoryPresent: false,
                latestMemoryUpdatedAt: "2026-04-08T09:30:00.000Z",
              },
            ],
          ]),
        ),
      },
    });

    const result = await model.list({ page: 1, pageSize: 10 });

    expect(result.rows.map((row) => row.persona.id)).toEqual([
      "persona-1",
      "persona-3",
      "persona-2",
    ]);
  });
});
