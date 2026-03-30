import { describe, expect, it } from "vitest";
import {
  buildReferenceWindow,
  buildResolvedPersonasPreview,
  buildSelectorInputPreview,
  buildSelectorOutputPreview,
  buildTaskCandidatePreview,
  buildTaskInjectionPreview,
  buildTaskWritePreview,
  resolvePersonasForReferences,
} from "@/lib/ai/agent/intake/intake-preview";

describe("intake preview builders", () => {
  it("builds selector input, output, resolved personas, and active task candidates", () => {
    const selectorInput = buildSelectorInputPreview({
      fixtureMode: "notification-intake",
      groupIndexOverride: 0,
      selectorReferenceBatchSize: 100,
      items: [
        {
          source: "notification",
          contentType: "mention",
          summary: "Unread mention",
        },
        {
          source: "notification",
          contentType: "reply",
          summary: "Reply notification",
        },
      ],
    });

    const selectorOutput = buildSelectorOutputPreview(selectorInput);
    const resolvedPersonas = buildResolvedPersonasPreview(selectorOutput);
    const candidates = buildTaskCandidatePreview({
      selectorInput,
      resolvedPersonas,
    });

    expect(selectorInput.referenceWindow.groupIndex).toBe(0);
    expect(selectorOutput.selectedReferences.length).toBeGreaterThanOrEqual(2);
    expect(selectorOutput.promptPreview).toContain("[system_baseline]");
    expect(selectorOutput.promptPreview).toContain("fixture_mode: notification-intake");
    expect(selectorOutput.actualModelPayload.compactContext.fixtureMode).toBe(
      "notification-intake",
    );
    expect(resolvedPersonas.some((persona) => persona.username === "ai_orchid")).toBe(true);
    expect(candidates.every((candidate) => candidate.dispatchKind === "notification")).toBe(true);
    expect(candidates[0]?.dedupeKey).toContain("ai_orchid");
    const writePreview = buildTaskWritePreview(candidates);
    expect(writePreview[0]?.inserted).toBe(true);
  });

  it("uses groupIndexOverride to move across shared reference windows", () => {
    const firstWindow = buildReferenceWindow({
      batchSize: 2,
      groupIndex: 0,
    });
    const secondWindow = buildReferenceWindow({
      batchSize: 2,
      groupIndex: 1,
    });

    expect(firstWindow.window).toEqual(["Yayoi Kusama", "David Bowie"]);
    expect(secondWindow.window).toEqual(["Octavia Butler", "Grace Jones"]);
    expect(secondWindow.start).toBe(2);
  });

  it("resolves personas from selected references and preserves inactive rows for preview filtering", () => {
    const personas = resolvePersonasForReferences({
      selectedReferences: [{ referenceName: "Grace Jones" }, { referenceName: "Octavia Butler" }],
    });

    expect(personas.map((persona) => persona.username)).toEqual(["ai_sable", "ai_vesper"]);
    expect(personas.find((persona) => persona.username === "ai_sable")?.active).toBe(false);
  });

  it("builds inject-ready write-preview expectations for dedupe and cooldown cases", () => {
    const previews = buildTaskWritePreview([
      {
        candidateIndex: 0,
        personaId: "persona-orchid",
        username: "ai_orchid",
        dispatchKind: "notification",
        sourceTable: "notifications",
        sourceId: "notification-1",
        dedupeKey: "ai_orchid:notification-1:mention",
        cooldownUntil: "2026-03-29T06:00:00.000Z",
        decisionReason: "match",
        payload: {
          contentType: "mention",
          source: "notification",
          summary: "mention",
          fixtureMode: "notification-intake",
        },
      },
      {
        candidateIndex: 1,
        personaId: "persona-marlowe",
        username: "ai_marlowe",
        dispatchKind: "notification",
        sourceTable: "notifications",
        sourceId: "notification-2",
        dedupeKey: "ai_marlowe:notification-2:reply",
        cooldownUntil: "2026-03-29T06:00:00.000Z",
        decisionReason: "match",
        payload: {
          contentType: "reply",
          source: "notification",
          summary: "reply",
          fixtureMode: "notification-intake",
        },
      },
      {
        candidateIndex: 2,
        personaId: "persona-vesper",
        username: "ai_vesper",
        dispatchKind: "public",
        sourceTable: "comments",
        sourceId: "comment-1",
        dedupeKey: "ai_vesper:comment-1:comment",
        cooldownUntil: "2026-03-29T06:00:00.000Z",
        decisionReason: "match",
        payload: {
          contentType: "comment",
          source: "public-comment",
          summary: "comment",
          fixtureMode: "mixed-public-opportunity",
        },
      },
    ]);

    expect(previews[0]).toMatchObject({
      inserted: true,
      skipReason: null,
      dedupeExpectation: "insert",
      cooldownExpectation: "eligible",
    });
    expect(previews[1]).toMatchObject({
      inserted: false,
      skipReason: "duplicate_candidate",
      dedupeExpectation: "skip_duplicate",
    });
    expect(previews[2]).toMatchObject({
      inserted: false,
      skipReason: "cooldown_active",
      cooldownExpectation: "cooldown_active",
    });
  });

  it("builds an RPC-style injection preview from task candidates and write expectations", () => {
    const candidates = [
      {
        candidateIndex: 0,
        personaId: "persona-orchid",
        username: "ai_orchid",
        dispatchKind: "notification" as const,
        sourceTable: "notifications" as const,
        sourceId: "notification-1",
        dedupeKey: "ai_orchid:notification-1:mention",
        cooldownUntil: "2026-03-29T06:00:00.000Z",
        decisionReason: "match",
        payload: {
          contentType: "mention",
          source: "notification",
          summary: "mention",
          fixtureMode: "notification-intake" as const,
        },
      },
      {
        candidateIndex: 1,
        personaId: "persona-marlowe",
        username: "ai_marlowe",
        dispatchKind: "notification" as const,
        sourceTable: "notifications" as const,
        sourceId: "notification-2",
        dedupeKey: "ai_marlowe:notification-2:reply",
        cooldownUntil: "2026-03-29T06:00:00.000Z",
        decisionReason: "match",
        payload: {
          contentType: "reply",
          source: "notification",
          summary: "reply",
          fixtureMode: "notification-intake" as const,
        },
      },
    ];
    const taskWritePreview = buildTaskWritePreview(candidates);

    const injectionPreview = buildTaskInjectionPreview({
      candidates,
      taskWritePreview,
    });

    expect(injectionPreview.rpcName).toBe("inject_persona_tasks");
    expect(injectionPreview.summary).toEqual({
      candidateCount: 2,
      insertedCount: 1,
      skippedCount: 1,
      insertedTaskIds: ["task-preview-1"],
      skippedReasonCounts: {
        duplicate_candidate: 1,
      },
    });
    expect(injectionPreview.results[0]).toMatchObject({
      inserted: true,
      taskType: "mention",
      dispatchKind: "notification",
      personaUsername: "ai_orchid",
    });
  });
});
