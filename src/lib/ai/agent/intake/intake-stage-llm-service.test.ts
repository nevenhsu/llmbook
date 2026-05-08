import { describe, expect, it, vi } from "vitest";
import type { AiOppRow } from "@/lib/ai/agent/intake/opportunity-store";
import { AiAgentIntakeStageLlmService } from "@/lib/ai/agent/intake/intake-stage-llm-service";

function buildOpp(overrides: Partial<AiOppRow> = {}): AiOppRow {
  return {
    id: "opp-1",
    kind: "public",
    source_table: "posts",
    source_id: "post-1",
    board_id: "board-1",
    board_slug: "creative-lab",
    post_id: "post-1",
    comment_id: null,
    parent_comment_id: null,
    notification_id: null,
    recipient_persona_id: null,
    content_type: "post",
    summary: "Board: Creative Lab | Recent post title: Best prompting workflows this week",
    probability: null,
    selected: null,
    matched_persona_count: 0,
    notification_context: null,
    notification_type: null,
    notification_processed_at: null,
    probability_model_key: null,
    probability_prompt_version: null,
    probability_evaluated_at: null,
    source_created_at: "2026-04-03T10:00:00.000Z",
    created_at: "2026-04-03T10:00:00.000Z",
    updated_at: "2026-04-03T10:00:00.000Z",
    ...overrides,
  };
}

const makeAuditPass = () =>
  vi.fn().mockResolvedValue({
    text: JSON.stringify({ pass: true, issues: [], repair_instructions: [] }),
    finishReason: "stop" as const,
    providerId: "mock",
    modelId: "mock-fallback",
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, normalized: false },
    usedFallback: false,
    attempts: 1,
    path: ["mock:mock-fallback"],
  });

describe("AiAgentIntakeStageLlmService", () => {
  it("returns probability updates from structured output", async () => {
    const invokeStage = vi
      .fn()
      .mockResolvedValueOnce({
        text: JSON.stringify({
          scores: [
            { opportunity_key: "O01", probability: 0.74 },
            { opportunity_key: "O02", probability: 0.43 },
          ],
        }),
        finishReason: "stop",
        providerId: "mock",
        modelId: "mock-fallback",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, normalized: false },
        usedFallback: false,
        attempts: 1,
        path: ["mock:mock-fallback"],
      })
      .mockImplementation(makeAuditPass());

    const service = new AiAgentIntakeStageLlmService({
      deps: {
        invokeStage,
        now: () => new Date("2026-04-03T12:00:00.000Z"),
      },
    });

    const result = await service.scoreOpportunities({
      kind: "public",
      rows: [
        buildOpp({ id: "opp-1" }),
        buildOpp({
          id: "opp-2",
          source_table: "comments",
          source_id: "comment-1",
          content_type: "comment",
          summary: "Board: Creative Lab | Recent comment: Strong point, but still needs examples.",
        }),
      ],
    });

    expect(result).toEqual([
      {
        opportunityId: "opp-1",
        probability: 0.74,
        probabilityModelKey: "mock:mock-fallback",
        probabilityPromptVersion: "runtime-opportunities-v2",
        evaluatedAt: "2026-04-03T12:00:00.000Z",
      },
      {
        opportunityId: "opp-2",
        probability: 0.43,
        probabilityModelKey: "mock:mock-fallback",
        probabilityPromptVersion: "runtime-opportunities-v2",
        evaluatedAt: "2026-04-03T12:00:00.000Z",
      },
    ]);
    expect(invokeStage).toHaveBeenCalledTimes(2);
    expect(invokeStage.mock.calls[0]?.[0]).toMatchObject({
      stageName: "opportunities",
      phase: "main",
    });
    expect(invokeStage.mock.calls[1]?.[0]).toMatchObject({
      stageName: "opportunities",
      phase: "quality_audit",
    });
  });

  it("runs quality repair when audit fails, returns repaired selected speakers", async () => {
    const invokeStage = vi
      .fn()
      .mockResolvedValueOnce({
        text: JSON.stringify({
          speaker_candidates: [
            {
              opportunity_key: "O01",
              selected_speakers: [{ name: "David Bowie", probability: 0.51 }],
            },
          ],
        }),
        finishReason: "stop",
        providerId: "mock",
        modelId: "mock-fallback",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, normalized: false },
        usedFallback: false,
        attempts: 1,
        path: ["mock:mock-fallback"],
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          pass: false,
          issues: ["Selected speakers are too narrow."],
          repair_instructions: ["Pick two stronger candidates."],
        }),
        finishReason: "stop",
        providerId: "mock",
        modelId: "mock-fallback",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, normalized: false },
        usedFallback: false,
        attempts: 1,
        path: ["mock:mock-fallback"],
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          speaker_candidates: [
            {
              opportunity_key: "O01",
              selected_speakers: [
                { name: "David Bowie", probability: 0.88 },
                { name: "Laurie Anderson", probability: 0.76 },
              ],
            },
          ],
        }),
        finishReason: "stop",
        providerId: "mock",
        modelId: "mock-fallback",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, normalized: false },
        usedFallback: false,
        attempts: 1,
        path: ["mock:mock-fallback"],
      })
      .mockImplementation(makeAuditPass());

    const service = new AiAgentIntakeStageLlmService({ deps: { invokeStage } });

    const result = await service.selectPublicSpeakerCandidates({
      rows: [buildOpp({ id: "opp-1" })],
      referenceBatch: ["David Bowie", "Laurie Anderson", "Grace Jones"],
    });

    expect(result).toEqual([
      {
        oppId: "opp-1",
        selectedSpeakers: [
          { name: "David Bowie", probability: 0.88 },
          { name: "Laurie Anderson", probability: 0.76 },
        ],
      },
    ]);
    expect(invokeStage).toHaveBeenCalledTimes(4);
    expect(invokeStage.mock.calls[0]?.[0]).toMatchObject({ phase: "main" });
    expect(invokeStage.mock.calls[1]?.[0]).toMatchObject({ phase: "quality_audit" });
    expect(invokeStage.mock.calls[2]?.[0]).toMatchObject({ phase: "quality_repair" });
    expect(invokeStage.mock.calls[3]?.[0]).toMatchObject({ phase: "quality_audit" });
  });

  it("throws when main output is unparseable and no quality repair can fix it", async () => {
    const invokeStage = vi.fn().mockResolvedValueOnce({
      text: "not valid json",
      finishReason: "stop",
      providerId: "mock",
      modelId: "mock-fallback",
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, normalized: false },
      usedFallback: false,
      attempts: 1,
      path: ["mock:mock-fallback"],
    });

    const service = new AiAgentIntakeStageLlmService({ deps: { invokeStage } });

    await expect(
      service.scoreOpportunities({
        kind: "public",
        rows: [buildOpp({ id: "opp-1" })],
      }),
    ).rejects.toThrow(/stage returned (invalid JSON|empty output)/);
    expect(invokeStage).toHaveBeenCalledTimes(1);
  });

  it("batches in groups of 10 without subset retry", async () => {
    const batchRows = Array.from({ length: 11 }, (_, index) =>
      buildOpp({
        id: `opp-${index + 1}`,
        source_id: `post-${index + 1}`,
        post_id: `post-${index + 1}`,
        summary: `Board: Creative Lab | Recent post title: Item ${index + 1}`,
      }),
    );

    const scores10 = JSON.stringify({
      scores: Array.from({ length: 10 }, (_, index) => ({
        opportunity_key: `O${String(index + 1).padStart(2, "0")}`,
        probability: 0.61,
      })),
    });
    const scores1 = JSON.stringify({
      scores: [{ opportunity_key: "O01", probability: 0.72 }],
    });
    const auditPass = JSON.stringify({ pass: true, issues: [], repair_instructions: [] });

    const invokeStage = vi
      .fn()
      .mockResolvedValueOnce({
        // batch 1 main
        text: scores10,
        finishReason: "stop",
        providerId: "mock",
        modelId: "mock-fallback",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, normalized: false },
        usedFallback: false,
        attempts: 1,
        path: ["mock:mock-fallback"],
      })
      .mockResolvedValueOnce({
        // batch 1 audit
        text: auditPass,
        finishReason: "stop",
        providerId: "mock",
        modelId: "mock-fallback",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, normalized: false },
        usedFallback: false,
        attempts: 1,
        path: ["mock:mock-fallback"],
      })
      .mockResolvedValueOnce({
        // batch 2 main
        text: scores1,
        finishReason: "stop",
        providerId: "mock",
        modelId: "mock-fallback",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, normalized: false },
        usedFallback: false,
        attempts: 1,
        path: ["mock:mock-fallback"],
      })
      .mockResolvedValueOnce({
        // batch 2 audit
        text: auditPass,
        finishReason: "stop",
        providerId: "mock",
        modelId: "mock-fallback",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, normalized: false },
        usedFallback: false,
        attempts: 1,
        path: ["mock:mock-fallback"],
      });

    const service = new AiAgentIntakeStageLlmService({
      deps: { invokeStage, now: () => new Date("2026-04-03T12:00:00.000Z") },
    });

    const result = await service.scoreOpportunities({ kind: "public", rows: batchRows });
    expect(result).toHaveLength(11);
    const mainCalls = invokeStage.mock.calls.filter((call) => call[0]?.phase === "main");
    expect(mainCalls).toHaveLength(2);
  });

  it("batches candidates in groups of 10", async () => {
    const batchRows = Array.from({ length: 11 }, (_, index) =>
      buildOpp({
        id: `opp-${index + 1}`,
        source_id: `post-${index + 1}`,
        post_id: `post-${index + 1}`,
        summary: `Board: Creative Lab | Recent post title: Item ${index + 1}`,
      }),
    );

    const candidates10 = JSON.stringify({
      speaker_candidates: Array.from({ length: 10 }, (_, index) => ({
        opportunity_key: `O${String(index + 1).padStart(2, "0")}`,
        selected_speakers: [{ name: "David Bowie", probability: 0.71 }],
      })),
    });
    const candidates1 = JSON.stringify({
      speaker_candidates: [
        {
          opportunity_key: "O01",
          selected_speakers: [{ name: "Laurie Anderson", probability: 0.83 }],
        },
      ],
    });
    const auditPass = JSON.stringify({ pass: true, issues: [], repair_instructions: [] });

    const invokeStage = vi
      .fn()
      .mockResolvedValueOnce({
        // batch 1 main
        text: candidates10,
        finishReason: "stop",
        providerId: "mock",
        modelId: "mock-fallback",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, normalized: false },
        usedFallback: false,
        attempts: 1,
        path: ["mock:mock-fallback"],
      })
      .mockResolvedValueOnce({
        // batch 1 audit
        text: auditPass,
        finishReason: "stop",
        providerId: "mock",
        modelId: "mock-fallback",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, normalized: false },
        usedFallback: false,
        attempts: 1,
        path: ["mock:mock-fallback"],
      })
      .mockResolvedValueOnce({
        // batch 2 main
        text: candidates1,
        finishReason: "stop",
        providerId: "mock",
        modelId: "mock-fallback",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, normalized: false },
        usedFallback: false,
        attempts: 1,
        path: ["mock:mock-fallback"],
      })
      .mockResolvedValueOnce({
        // batch 2 audit
        text: auditPass,
        finishReason: "stop",
        providerId: "mock",
        modelId: "mock-fallback",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, normalized: false },
        usedFallback: false,
        attempts: 1,
        path: ["mock:mock-fallback"],
      });

    const service = new AiAgentIntakeStageLlmService({ deps: { invokeStage } });

    const result = await service.selectPublicSpeakerCandidates({
      rows: batchRows,
      referenceBatch: ["David Bowie", "Laurie Anderson", "Grace Jones"],
    });

    expect(result).toHaveLength(11);
    const mainCalls = invokeStage.mock.calls.filter((call) => call[0]?.phase === "main");
    expect(mainCalls).toHaveLength(2);
  });
});
