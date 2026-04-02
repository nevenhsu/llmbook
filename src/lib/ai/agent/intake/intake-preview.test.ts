import { describe, expect, it } from "vitest";
import {
  buildReferenceWindow,
  buildCandidateSelectionPreview,
  buildOpportunitySelectionPreview,
  buildResolvedCandidatesPreview,
  buildResolvedPersonasPreview,
  buildSelectorInputPreview,
  buildSelectorOutputPreview,
  buildTaskCandidatePreview,
  buildTaskInjectionPreview,
  buildTaskWritePreview,
  resolvePersonasForReferences,
} from "@/lib/ai/agent/intake/intake-preview";

describe("intake preview builders", () => {
  it("builds opportunity selection, candidate selection, resolved personas, and active task candidates", () => {
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

    const opportunitySelection = buildOpportunitySelectionPreview(selectorInput);
    const selectorOutput = buildSelectorOutputPreview(selectorInput);
    const candidates = buildTaskCandidatePreview({
      selectorInput,
      opportunitySelection,
    });

    expect(selectorInput.referenceWindow.groupIndex).toBe(0);
    expect(opportunitySelection.selectedOpportunities).toHaveLength(2);
    expect(selectorOutput.promptPreview).toContain("[stage]");
    expect(opportunitySelection.promptPreview).toContain("opportunities_selector");
    expect(opportunitySelection.promptPreview).toContain("[snapshot_scope]");
    expect(opportunitySelection.promptPreview).toContain("fixture_mode: notification-intake");
    expect(opportunitySelection.promptPreview).toContain("[available_opportunities]");
    expect(opportunitySelection.promptPreview).toContain("[decision_criteria]");
    expect(opportunitySelection.promptPreview).toContain(
      "Prioritize opportunities with a clear reply/posting target",
    );
    expect(opportunitySelection.promptPreview).toContain('"opportunity_probabilities"');
    expect(opportunitySelection.promptPreview).toContain('"opportunity_key"');
    expect(opportunitySelection.promptPreview).toContain('"probability"');
    expect(opportunitySelection.promptPreview).toContain(
      "The application will treat `probability > 0.5` as selected",
    );
    expect(opportunitySelection.promptPreview).not.toContain("markdown: string");
    expect(opportunitySelection.promptPreview).not.toContain("need_image: boolean");
    expect(opportunitySelection.promptPreview).not.toContain("[agent_voice_contract]");
    expect(opportunitySelection.actualModelPayload.compactContext.fixtureMode).toBe(
      "notification-intake",
    );
    expect(opportunitySelection.opportunityProbabilities).toHaveLength(
      selectorInput.opportunities.length,
    );
    expect(candidates.every((candidate) => candidate.dispatchKind === "notification")).toBe(true);
    expect(candidates[0]?.dedupeKey).toContain("ai_orchid");
    const writePreview = buildTaskWritePreview(candidates);
    expect(writePreview[0]?.inserted).toBe(true);
  });

  it("builds candidate selections and resolved candidates from selected public opportunities", () => {
    const selectorInput = buildSelectorInputPreview({
      fixtureMode: "mixed-public-opportunity",
      groupIndexOverride: 0,
      selectorReferenceBatchSize: 4,
      items: [
        {
          source: "public-comment",
          contentType: "comment",
          summary: "Recent comment",
        },
        {
          source: "public-post",
          contentType: "post",
          summary: "Recent post",
        },
        {
          source: "public-comment",
          contentType: "comment",
          summary: "Lower priority comment",
        },
        {
          source: "public-post",
          contentType: "post",
          summary: "Low context board post",
        },
      ],
    });

    const opportunitySelection = buildOpportunitySelectionPreview(selectorInput);
    const candidateSelection = buildCandidateSelectionPreview({
      selectorInput,
      opportunitySelection,
    });
    const resolvedCandidates = buildResolvedCandidatesPreview(candidateSelection);
    const resolvedPersonas = buildResolvedPersonasPreview(resolvedCandidates);
    const candidates = buildTaskCandidatePreview({
      selectorInput,
      resolvedCandidates,
    });

    expect(candidateSelection.candidateSelections[0]?.selectedReferences.length).toBeGreaterThan(0);
    expect(opportunitySelection.opportunityProbabilities).toHaveLength(4);
    expect(opportunitySelection.selectedOpportunities.map((item) => item.opportunityKey)).toEqual([
      "O01",
      "O02",
    ]);
    expect(candidateSelection.promptPreview).toContain("candidates_selector");
    expect(candidateSelection.promptPreview).toContain("[selected_opportunities]");
    expect(candidateSelection.promptPreview).toContain("[reference_batch]");
    expect(candidateSelection.promptPreview).toContain("[decision_criteria]");
    expect(candidateSelection.promptPreview).toContain(
      "Choose reference names whose known voice, posture, and perspective fit the selected opportunity.",
    );
    expect(candidateSelection.promptPreview).toContain('"candidate_selections"');
    expect(candidateSelection.promptPreview).toContain('"selected_references"');
    expect(candidateSelection.promptPreview).toContain('"opportunity_key": "O02"');
    expect(candidateSelection.promptPreview).toContain(
      '"selected_references": ["Octavia Butler", "Grace Jones"]',
    );
    expect(candidateSelection.promptPreview).not.toContain("markdown: string");
    expect(candidateSelection.promptPreview).not.toContain("need_image: boolean");
    expect(candidateSelection.promptPreview).not.toContain("[agent_examples]");
    expect(candidateSelection.candidateSelections[0]?.selectedReferences).not.toEqual(
      candidateSelection.candidateSelections[1]?.selectedReferences,
    );
    expect(
      candidateSelection.candidateSelections.flatMap((selection) => selection.selectedReferences),
    ).toContain("Grace Jones");
    expect(resolvedCandidates[0]?.personaIds.length).toBeGreaterThan(0);
    expect(
      resolvedCandidates.some((candidate) =>
        candidate.personaIds.some(
          (persona) => persona.referenceName === "Grace Jones" && persona.status === "inactive",
        ),
      ),
    ).toBe(true);
    expect(resolvedPersonas.some((persona) => persona.username === "ai_orchid")).toBe(true);
    expect(candidates.every((candidate) => candidate.dispatchKind === "public")).toBe(true);
    expect(candidates.some((candidate) => candidate.username === "ai_sable")).toBe(false);
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
        opportunityKey: "N01",
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
        opportunityKey: "N02",
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
        opportunityKey: "O01",
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
        opportunityKey: "N01",
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
        opportunityKey: "N02",
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
