import { describe, expect, it } from "vitest";
import { buildAiAgentIntakeTrace } from "@/lib/ai/agent/intake/intake-trace";
import { buildMockIntakeRuntimePreviews } from "@/lib/ai/agent/testing/mock-intake-runtime-previews";
import {
  buildTaskSavePayloadData,
  buildCandidateStage,
  buildCandidateStageFromTrace,
  buildModeStateFromTrace,
  buildSelectorStageFromTrace,
} from "./lab-data";

describe("agent lab data mapping", () => {
  it("reuses canonical trace payloads for selector and candidate raw output", () => {
    const trace = buildAiAgentIntakeTrace(buildMockIntakeRuntimePreviews().public);

    const selectorStage = buildSelectorStageFromTrace(trace);
    const { candidateStage, taskRows } = buildCandidateStageFromTrace(trace);

    expect(selectorStage.inputData).toEqual(trace.opportunities.input);
    expect(selectorStage.outputData).toEqual({
      opportunity_probabilities:
        trace.opportunities.result.selectedOpportunities?.opportunityProbabilities.map((item) => ({
          opportunity_key: item.opportunityKey,
          probability: item.probability,
        })) ?? [],
    });
    expect(candidateStage.inputData).toEqual(trace.candidates.input);
    expect(candidateStage.outputData).toEqual(trace.candidates.result);
    expect(taskRows.map((row) => row.candidate?.candidateIndex)).toEqual([1, 0, 2]);
    expect(trace.opportunities.result.selectedOpportunities).not.toBeNull();
    expect(trace.candidates.result.candidateSelection).not.toBeNull();
  });

  it("builds initial mode state from the same canonical trace", () => {
    const trace = buildAiAgentIntakeTrace(buildMockIntakeRuntimePreviews().notification);

    const modeState = buildModeStateFromTrace(trace, "notification");

    expect(modeState.opportunities).toHaveLength(trace.opportunities.input.sourceItems.length);
    expect(modeState.opportunities.every((row) => row.probability === null)).toBe(true);
    expect(modeState.opportunities.every((row) => row.selected === false)).toBe(true);
    expect(modeState.selectorStage.inputData).toBeNull();
    expect(modeState.selectorStage.prompt).toBe(
      trace.opportunities.result.selectedOpportunities?.promptPreview ?? null,
    );
    expect(modeState.selectorStage.outputData).toBeNull();
    expect(modeState.candidateStage.status).toBe("auto-routed");
    expect(modeState.candidateStage.rows.length).toBeGreaterThan(0);
    expect(modeState.candidateStage.rows.every((row) => row.opportunityKey === null)).toBe(true);
  });

  it("keeps public prompt previews available in the initial mode state", () => {
    const trace = buildAiAgentIntakeTrace(buildMockIntakeRuntimePreviews().public);

    const modeState = buildModeStateFromTrace(trace, "public");

    expect(modeState.selectorStage.prompt).toBe(
      trace.opportunities.result.selectedOpportunities?.promptPreview ?? null,
    );
    expect(modeState.candidateStage.prompt).toBe(
      trace.candidates.result.candidateSelection?.promptPreview ?? null,
    );
    expect(modeState.candidateStage.rows.length).toBeGreaterThan(0);
    expect(modeState.candidateStage.rows).toHaveLength(10);
    expect(modeState.candidateStage.rows.every((row) => row.opportunityKey === null)).toBe(true);
    expect(modeState.personaGroup.batchSize).toBe(10);
    expect(modeState.personaGroup.totalReferenceCount).toBe(12);
    expect(modeState.opportunities.some((row) => row.probability === null)).toBe(true);
  });

  it("rebuilds candidate stage from canonical group input overrides", () => {
    const snapshot = buildMockIntakeRuntimePreviews().public;

    const first = buildCandidateStage({
      kind: "public",
      snapshot,
      personaGroup: {
        batchSize: 2,
        groupIndex: 0,
      },
    });
    const second = buildCandidateStage({
      kind: "public",
      snapshot,
      personaGroup: {
        batchSize: 2,
        groupIndex: 1,
      },
    });

    expect(first.candidateStage.rows.map((row) => row.referenceName)).not.toEqual(
      second.candidateStage.rows.map((row) => row.referenceName),
    );
  });

  it("enriches candidate rows with persona summaries when provided", () => {
    const trace = buildAiAgentIntakeTrace(buildMockIntakeRuntimePreviews().notification);

    const { candidateStage } = buildCandidateStageFromTrace(trace, {
      kind: "notification",
      personaSummaries: [
        {
          id: "persona-orchid",
          username: "ai_orchid",
          display_name: "Orchid Runtime",
          avatar_url: "https://example.com/orchid.png",
          bio: "runtime persona",
          status: "active",
        },
      ],
    });

    expect(candidateStage.rows[0]?.persona).toMatchObject({
      id: "persona-orchid",
      displayName: "Orchid Runtime",
      username: "ai_orchid",
      avatarUrl: "https://example.com/orchid.png",
      href: "/u/ai_orchid",
      status: "active",
    });
  });

  it("keeps persona info on unselected candidate rows from the full reference batch", () => {
    const baseTrace = buildAiAgentIntakeTrace(buildMockIntakeRuntimePreviews().public, {
      selectorReferenceBatchSize: 4,
      groupIndexOverride: 0,
    });
    const trace = {
      ...baseTrace,
      candidates: {
        ...baseTrace.candidates,
        result: {
          ...baseTrace.candidates.result,
          candidateSelection: baseTrace.candidates.result.candidateSelection
            ? {
                ...baseTrace.candidates.result.candidateSelection,
                candidateSelections:
                  baseTrace.candidates.result.candidateSelection.candidateSelections.slice(0, 1),
              }
            : null,
        },
      },
    };

    const { candidateStage } = buildCandidateStageFromTrace(trace, {
      kind: "public",
    });
    const unselected = candidateStage.rows.find((row) => row.opportunityKey === null);

    expect(unselected).toBeDefined();
    expect(unselected?.persona).not.toBeNull();
  });

  it("exposes active and inactive persona status in candidate rows", () => {
    const trace = buildAiAgentIntakeTrace(buildMockIntakeRuntimePreviews().public, {
      selectorReferenceBatchSize: 10,
      groupIndexOverride: 0,
    });

    const modeState = buildModeStateFromTrace(trace, "public");

    expect(modeState.candidateStage.rows.some((row) => row.persona?.status === "active")).toBe(
      true,
    );
    expect(modeState.candidateStage.rows.some((row) => row.persona?.status === "inactive")).toBe(
      true,
    );
  });

  it("includes one unselected public opportunity in the default mock run result", () => {
    const trace = buildAiAgentIntakeTrace(buildMockIntakeRuntimePreviews().public);
    const selectorStage = buildSelectorStageFromTrace(trace);

    expect(selectorStage.rows.some((row) => row.selected === false)).toBe(true);
  });

  it("keeps task rows aligned with selected candidate rows after run", () => {
    const trace = buildAiAgentIntakeTrace(buildMockIntakeRuntimePreviews().public);
    const { candidateStage, taskRows } = buildCandidateStageFromTrace(trace, {
      kind: "public",
    });

    const candidateKeys = candidateStage.rows
      .filter((row) => row.opportunityKey && row.persona)
      .filter((row) =>
        taskRows.some(
          (taskRow) =>
            taskRow.persona.id === row.persona!.id && taskRow.opportunityKey === row.opportunityKey,
        ),
      )
      .map((row) => `${row.opportunityKey}:${row.persona!.id}`);
    const taskKeys = taskRows.map((row) => `${row.opportunityKey}:${row.persona.id}`);

    expect(taskKeys).toEqual(candidateKeys);
    expect(taskRows).toHaveLength(3);
    expect(
      candidateStage.rows.some((row) => row.opportunityKey && row.persona?.status === "inactive"),
    ).toBe(true);
  });

  it("builds task show-data payloads from save request bodies, not save responses", () => {
    const trace = buildAiAgentIntakeTrace(buildMockIntakeRuntimePreviews().public);
    const { taskRows } = buildCandidateStageFromTrace(trace, {
      kind: "public",
    });

    const payloadData = buildTaskSavePayloadData(taskRows);

    expect(payloadData.injectPersonaTasksCandidates).toHaveLength(taskRows.length);
    expect(payloadData.injectPersonaTasksCandidates[0]).toMatchObject({
      candidate_index: taskRows[0]?.candidate?.candidateIndex,
      persona_id: taskRows[0]?.candidate?.personaId,
      task_type: taskRows[0]?.taskType,
      dispatch_kind: taskRows[0]?.candidate?.dispatchKind,
      source_table: taskRows[0]?.candidate?.sourceTable,
      source_id: taskRows[0]?.candidate?.sourceId,
      dedupe_key: taskRows[0]?.candidate?.dedupeKey,
      cooldown_until: taskRows[0]?.candidate?.cooldownUntil,
      decision_reason: taskRows[0]?.candidate?.decisionReason,
      payload: taskRows[0]?.candidate?.payload,
    });
  });

  it("keeps full persona info on task rows for consistent table UI", () => {
    const trace = buildAiAgentIntakeTrace(buildMockIntakeRuntimePreviews().public);
    const { taskRows } = buildCandidateStageFromTrace(trace, {
      kind: "public",
    });

    expect(taskRows[0]?.persona).toMatchObject({
      displayName: "Marlowe",
      username: "ai_marlowe",
      avatarUrl: null,
      status: "active",
      href: "/u/ai_marlowe",
    });
  });
});
