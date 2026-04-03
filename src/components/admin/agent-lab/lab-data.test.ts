import { describe, expect, it } from "vitest";
import { buildMockIntakeRuntimePreviews } from "@/lib/ai/agent/testing/mock-intake-runtime-previews";
import previewMockData from "@/mock-data/ai-agent-lab.json";
import {
  buildCandidateStage,
  buildInitialModes,
  buildSelectorStage,
  buildTaskSavePayloadData,
} from "./lab-data";

describe("agent lab data mapping", () => {
  it("builds initial public mode from snapshot/new-contract data without pre-run outputs", () => {
    const previews = buildMockIntakeRuntimePreviews();

    const initialModes = buildInitialModes({
      ...previews,
      selectorReferenceBatchSize: 10,
    });

    expect(initialModes.public.selectorStage.prompt).toContain("[stage]\nopportunities_selector");
    expect(initialModes.public.selectorStage.outputData).toBeNull();
    expect(initialModes.public.candidateStage.prompt).toContain("[stage]\ncandidates_selector");
    expect(initialModes.public.candidateStage.outputData).toBeNull();
    expect(initialModes.public.candidateStage.rows).toHaveLength(10);
    expect(
      initialModes.public.candidateStage.rows.every((row) => row.opportunityKey === null),
    ).toBe(true);
    expect(initialModes.public.personaGroup.totalReferenceCount).toBe(12);
  });

  it("keeps notification candidates prefilled from snapshot while waiting for selector run", () => {
    const previews = buildMockIntakeRuntimePreviews();

    const initialModes = buildInitialModes({
      ...previews,
      selectorReferenceBatchSize: 10,
    });

    expect(initialModes.notification.candidateStage.status).toBe("auto-routed");
    expect(initialModes.notification.candidateStage.rows).toHaveLength(1);
    expect(initialModes.notification.candidateStage.rows[0]?.opportunityKey).toBeNull();
    expect(initialModes.notification.candidateStage.rows[0]?.persona?.displayName).toBe("Orchid");
  });

  it("returns opportunity probabilities only after opportunities run", () => {
    const selectorStage = buildSelectorStage({
      snapshot: buildMockIntakeRuntimePreviews().public,
    });

    expect(selectorStage.outputData).toEqual({
      scores: [
        { opportunity_key: "O01", probability: 0.67 },
        { opportunity_key: "O02", probability: 0.77 },
        { opportunity_key: "O03", probability: 0.35 },
      ],
    });
    expect(selectorStage.rows.some((row) => row.selected === false)).toBe(true);
  });

  it("reads opportunity probabilities from snapshot items when lookup metadata omits persisted values", () => {
    const previewData = previewMockData as {
      runtimePreviews: {
        public: Parameters<typeof buildSelectorStage>[0]["snapshot"];
      };
    };

    const selectorStage = buildSelectorStage({
      snapshot: previewData.runtimePreviews.public,
    });

    expect(selectorStage.rows).toMatchObject([
      { opportunityKey: "O01", probability: 0.77, selected: true },
      { opportunityKey: "O02", probability: 0.67, selected: true },
      { opportunityKey: "O03", probability: 0.35, selected: false },
    ]);
    expect(selectorStage.outputData).toEqual({
      scores: [
        { opportunity_key: "O01", probability: 0.77 },
        { opportunity_key: "O02", probability: 0.67 },
        { opportunity_key: "O03", probability: 0.35 },
      ],
    });
  });

  it("builds public candidates from selected opportunities without old trace builders", () => {
    const previews = buildMockIntakeRuntimePreviews();
    const selectorStage = buildSelectorStage({
      snapshot: previews.public,
    });

    const { candidateStage, taskRows } = buildCandidateStage({
      kind: "public",
      snapshot: previews.public,
      selectorStage,
    });

    expect(candidateStage.inputData).toEqual({
      selected_opportunities: [
        {
          opportunity_key: "O01",
          content_type: "comment",
          summary:
            "Board: Creative Lab | Recent comment: Can anyone share concrete workflow examples for this tool stack?",
        },
        {
          opportunity_key: "O02",
          content_type: "post",
          summary: "Board: Creative Lab | Recent post title: Best prompting workflows this week",
        },
      ],
      speaker_batch: [
        "Yayoi Kusama",
        "David Bowie",
        "Octavia Butler",
        "Grace Jones",
        "Wong Kar-wai",
        "Bjork",
        "Nina Simone",
        "Leiji Matsumoto",
        "Ursula K. Le Guin",
        "Laurie Anderson",
      ],
    });
    expect(candidateStage.outputData).toEqual({
      speaker_candidates: [
        {
          opportunity_key: "O01",
          selected_speakers: [
            { name: "David Bowie", probability: 0.82 },
            { name: "Laurie Anderson", probability: 0.71 },
          ],
        },
        {
          opportunity_key: "O02",
          selected_speakers: [
            { name: "Grace Jones", probability: 0.64 },
            { name: "Yayoi Kusama", probability: 0.58 },
          ],
        },
      ],
    });
    expect(
      candidateStage.rows.filter(
        (row) => row.opportunityKey === "O01" && row.persona?.id === "persona-marlowe",
      ),
    ).toHaveLength(2);
    expect(
      candidateStage.rows.some((row) => row.opportunityKey && row.persona?.status === "inactive"),
    ).toBe(true);
    expect(
      taskRows.filter(
        (row) => row.opportunityKey === "O01" && row.persona.id === "persona-marlowe",
      ),
    ).toHaveLength(1);
    expect(taskRows).toHaveLength(2);
  });

  it("auto-routes notification candidates/tasks after opportunities run", () => {
    const previews = buildMockIntakeRuntimePreviews();
    const selectorStage = buildSelectorStage({
      snapshot: previews.notification,
    });

    const { candidateStage, taskRows } = buildCandidateStage({
      kind: "notification",
      snapshot: previews.notification,
      selectorStage,
    });

    expect(candidateStage.status).toBe("auto-routed");
    expect(candidateStage.rows[0]?.opportunityKey).toBe("N01");
    expect(taskRows).toHaveLength(1);
    expect(taskRows[0]?.persona.displayName).toBe("Orchid");
  });

  it("builds task show-data payloads from persona_tasks insert rows", () => {
    const previews = buildMockIntakeRuntimePreviews();
    const selectorStage = buildSelectorStage({
      snapshot: previews.public,
    });
    const { taskRows } = buildCandidateStage({
      kind: "public",
      snapshot: previews.public,
      selectorStage,
    });

    const payloadData = buildTaskSavePayloadData(taskRows);

    expect(payloadData.persona_tasks_rows).toHaveLength(taskRows.length);
    expect(payloadData.persona_tasks_rows[0]).toMatchObject({
      persona_id: taskRows[0]?.candidate?.personaId,
      task_type: taskRows[0]?.taskType,
      dispatch_kind: taskRows[0]?.candidate?.dispatchKind,
      source_table: taskRows[0]?.candidate?.sourceTable,
      source_id: taskRows[0]?.candidate?.sourceId,
      payload: {
        summary: taskRows[0]?.candidate?.payload.summary,
      },
    });
    expect(payloadData.persona_tasks_rows[0]).not.toHaveProperty("candidate_index");
    expect(payloadData.persona_tasks_rows[0]?.payload).not.toHaveProperty("contentType");
    expect(payloadData.persona_tasks_rows[0]?.payload).not.toHaveProperty("source");
    expect(payloadData.persona_tasks_rows[0]?.payload).not.toHaveProperty("fixtureMode");
  });
});
