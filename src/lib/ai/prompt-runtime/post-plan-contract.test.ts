import { describe, expect, it } from "vitest";
import {
  computePostPlanOverallScore,
  evaluatePostPlanGate,
  parsePostPlanActionOutput,
  validatePostPlanOutput,
} from "@/lib/ai/prompt-runtime/post-plan-contract";

function buildCandidate(overrides: Record<string, unknown> = {}) {
  return {
    title: overrides.title ?? "A new angle",
    angle_summary: overrides.angle_summary ?? "Shift from prompt wording to workflow boundaries.",
    thesis:
      overrides.thesis ??
      "Teams misdiagnose boundary failures as prompt failures because the runtime has no place to reject the wrong shape on purpose.",
    body_outline: overrides.body_outline ?? ["Problem", "Boundary", "Operator consequence"],
    difference_from_recent: overrides.difference_from_recent ?? [
      "Changes the argument entry point, not just the title.",
    ],
    board_fit_score: overrides.board_fit_score ?? 86,
    title_persona_fit_score: overrides.title_persona_fit_score ?? 83,
    title_novelty_score: overrides.title_novelty_score ?? 82,
    angle_novelty_score: overrides.angle_novelty_score ?? 91,
    body_usefulness_score: overrides.body_usefulness_score ?? 80,
  };
}

describe("post-plan contract", () => {
  it("parses canonical post_plan JSON and deterministically selects the highest-ranked passing candidate", () => {
    const parsed = parsePostPlanActionOutput(
      JSON.stringify({
        candidates: [
          buildCandidate({
            title: "The prompt bug that is actually an execution bug",
            board_fit_score: 83,
            title_persona_fit_score: 76,
            title_novelty_score: 79,
            angle_novelty_score: 82,
            body_usefulness_score: 74,
          }),
          buildCandidate({
            title: "Why most prompt debugging is really missing boundary design",
            board_fit_score: 89,
            title_persona_fit_score: 84,
            title_novelty_score: 88,
            angle_novelty_score: 95,
            body_usefulness_score: 87,
          }),
          buildCandidate({
            title: "A third title that passes but ranks lower",
            board_fit_score: 81,
            title_persona_fit_score: 78,
            title_novelty_score: 80,
            angle_novelty_score: 83,
            body_usefulness_score: 75,
          }),
        ],
      }),
    );

    expect(parsed.error).toBeNull();
    expect(parsed.output?.candidates).toHaveLength(3);
    expect(validatePostPlanOutput(parsed.output!)).toEqual([]);

    const gate = evaluatePostPlanGate(parsed.output!);

    expect(gate.passedCandidateIndexes).toEqual([1, 2]);
    expect(gate.selectedCandidateIndex).toBe(1);
    expect(computePostPlanOverallScore(parsed.output!.candidates[1]!)).toBeGreaterThan(
      computePostPlanOverallScore(parsed.output!.candidates[0]!),
    );
  });

  it("rejects invalid deterministic post_plan shapes before gating", () => {
    const parsed = parsePostPlanActionOutput(
      JSON.stringify({
        candidates: [
          {
            ...buildCandidate({ title: "Repeated title" }),
            overall_score: 99,
          },
          buildCandidate({ title: "Repeated title", board_fit_score: 72.5 }),
        ],
      }),
    );

    expect(parsed.error).toBeNull();
    expect(validatePostPlanOutput(parsed.output!)).toEqual(
      expect.arrayContaining([
        "post_plan must return exactly 3 candidates.",
        "candidate 0 must not include model-owned overall_score.",
        "candidate 1 board_fit_score must be an integer from 0 to 100.",
        'candidate titles must be unique after normalization; duplicate title "Repeated title".',
      ]),
    );
  });
});
