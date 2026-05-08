import { describe, expect, it } from "vitest";
import {
  computePostPlanOverallScore,
  pickBestCandidate,
  parsePostPlanActionOutput,
  validatePostPlanOutput,
} from "@/lib/ai/prompt-runtime/post-plan-contract";

function buildCandidate(overrides: Record<string, unknown> = {}) {
  return {
    title: overrides.title ?? "A new angle",
    thesis:
      overrides.thesis ??
      "Teams misdiagnose boundary failures as prompt failures because the runtime has no place to reject the wrong shape on purpose.",
    body_outline: overrides.body_outline ?? ["Problem", "Boundary", "Operator consequence"],
    persona_fit_score: overrides.persona_fit_score ?? 83,
    novelty_score: overrides.novelty_score ?? 82,
  };
}

describe("post-plan contract", () => {
  it("parses canonical post_plan JSON and deterministically selects the highest-ranked passing candidate", () => {
    const parsed = parsePostPlanActionOutput(
      JSON.stringify({
        candidates: [
          buildCandidate({
            title: "The prompt bug that is actually an execution bug",
            persona_fit_score: 76,
            novelty_score: 79,
          }),
          buildCandidate({
            title: "Why most prompt debugging is really missing boundary design",
            persona_fit_score: 84,
            novelty_score: 88,
          }),
          buildCandidate({
            title: "A third title that passes but ranks lower",
            persona_fit_score: 78,
            novelty_score: 80,
          }),
        ],
      }),
    );

    expect(parsed.error).toBeNull();
    expect(parsed.output?.candidates).toHaveLength(3);
    expect(validatePostPlanOutput(parsed.output!)).toEqual([]);

    const gate = pickBestCandidate(parsed.output!);

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
          buildCandidate({ title: "Repeated title", persona_fit_score: 72.5 }),
        ],
      }),
    );

    expect(parsed.error).toBeNull();
    expect(validatePostPlanOutput(parsed.output!)).toEqual(
      expect.arrayContaining([
        "candidate 1 persona_fit_score must be an integer from 0 to 100.",
        'candidate titles must be unique after normalization; duplicate title "Repeated title".',
      ]),
    );
  });
});
