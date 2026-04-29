import { describe, expect, it } from "vitest";
import {
  buildPostPlanAuditPrompt,
  parsePostPlanAuditResult,
  postPlanAudit,
} from "@/lib/ai/prompt-runtime/post-plan-audit";
import type { PostPlanCandidate } from "@/lib/ai/prompt-runtime/post-plan-contract";

function validCandidates(): PostPlanCandidate[] {
  return [
    {
      title: "Title 1",
      angleSummary: "Angle 1",
      thesis: "Thesis 1",
      bodyOutline: ["#point1", "#point2", "#point3"],
      differenceFromRecent: ["#diff1"],
      boardFitScore: 80,
      titlePersonaFitScore: 85,
      titleNoveltyScore: 90,
      angleNoveltyScore: 88,
      bodyUsefulnessScore: 75,
    },
    {
      title: "Title 2",
      angleSummary: "Angle 2",
      thesis: "Thesis 2",
      bodyOutline: ["#point1", "#point2", "#point3"],
      differenceFromRecent: ["#diff2"],
      boardFitScore: 75,
      titlePersonaFitScore: 72,
      titleNoveltyScore: 80,
      angleNoveltyScore: 78,
      bodyUsefulnessScore: 71,
    },
    {
      title: "Title 3",
      angleSummary: "Angle 3",
      thesis: "Thesis 3",
      bodyOutline: ["#point1", "#point2", "#point3"],
      differenceFromRecent: ["#diff3"],
      boardFitScore: 70,
      titlePersonaFitScore: 70,
      titleNoveltyScore: 77,
      angleNoveltyScore: 76,
      bodyUsefulnessScore: 73,
    },
  ];
}

function validAuditJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    passes: true,
    issues: [],
    repairGuidance: [],
    checks: {
      candidate_count: "pass",
      board_fit: "pass",
      novelty_evidence: "pass",
      persona_posting_lens_fit: "pass",
      body_outline_usefulness: "pass",
      no_model_owned_final_selection: "pass",
    },
    ...overrides,
  });
}

describe("postPlanAudit", () => {
  it("passes with valid candidates", () => {
    const result = postPlanAudit(validCandidates());
    expect(result.passes).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.repairGuidance).toEqual([]);
    expect(result.checks).toEqual({
      candidate_count: "pass",
      board_fit: "pass",
      novelty_evidence: "pass",
      persona_posting_lens_fit: "pass",
      body_outline_usefulness: "pass",
      no_model_owned_final_selection: "pass",
    });
  });

  it("builds a compact semantic post_plan audit prompt", () => {
    const prompt = buildPostPlanAuditPrompt({
      candidates: validCandidates(),
      boardContextText: "[board]\nName: Creative Lab",
      targetContextText: "[recent_board_posts]\n- Existing workflow post",
      personaEvidence: {
        displayName: "Orchid",
        identity: "ai_orchid",
        referenceSourceNames: ["source-a"],
        doctrine: {
          valueFit: ["Prioritize concrete utility."],
          reasoningFit: ["Show causal boundaries."],
          discourseFit: ["Be thread-native."],
          expressionFit: ["Keep it concise."],
        },
      },
    });

    expect(prompt).toContain("intentionally compact");
    expect(prompt).toContain("[post_plan_candidates]");
    expect(prompt).toContain("[board_context]");
    expect(prompt).toContain("[target_context]");
    expect(prompt).toContain("[persona_evidence]");
    expect(prompt).toContain("[output_constraints]");
    expect(prompt).toContain('"passes": true');
    expect(prompt).toContain('"issues": ["string"]');
    expect(prompt).toContain('"repairGuidance": ["string"]');
    expect(prompt).toContain('"candidate_count": "pass | fail"');
    expect(prompt).toContain("Title 1");
  });

  it("normalizes valid semantic post_plan audit JSON", () => {
    expect(
      parsePostPlanAuditResult(
        validAuditJson({
          passes: false,
          issues: ["Candidate 1 is too close to recent posts."],
          repairGuidance: ["Make the angle more distinct."],
        }),
      ),
    ).toEqual({
      passes: false,
      issues: ["Candidate 1 is too close to recent posts."],
      repairGuidance: ["Make the angle more distinct."],
      checks: {
        candidate_count: "pass",
        board_fit: "pass",
        novelty_evidence: "pass",
        persona_posting_lens_fit: "pass",
        body_outline_usefulness: "pass",
        no_model_owned_final_selection: "pass",
      },
    });
  });

  it("rejects invalid semantic post_plan audit JSON", () => {
    expect(() => parsePostPlanAuditResult("")).toThrow(/empty/);
    expect(() => parsePostPlanAuditResult("not json")).toThrow(/raw JSON object/);
    expect(() => parsePostPlanAuditResult("{ bad }")).toThrow(/valid JSON/);
    expect(() =>
      parsePostPlanAuditResult(
        validAuditJson({
          summary: "not allowed",
        }),
      ),
    ).toThrow(/forbidden key summary/);
    expect(() =>
      parsePostPlanAuditResult(
        JSON.stringify({
          passes: true,
          issues: [],
          repairGuidance: [],
          checks: {
            candidate_count: "pass",
          },
        }),
      ),
    ).toThrow(/checks/);
  });

  it("fails with wrong candidate count", () => {
    const candidates = [
      {
        title: "Title 1",
        angleSummary: "Angle 1",
        thesis: "Thesis 1",
        bodyOutline: ["#point1", "#point2", "#point3"],
        differenceFromRecent: ["#diff1"],
        boardFitScore: 80,
        titlePersonaFitScore: 85,
        titleNoveltyScore: 90,
        angleNoveltyScore: 88,
        bodyUsefulnessScore: 75,
      },
      {
        title: "Title 2",
        angleSummary: "Angle 2",
        thesis: "Thesis 2",
        bodyOutline: ["#point1", "#point2", "#point3"],
        differenceFromRecent: ["#diff2"],
        boardFitScore: 75,
        titlePersonaFitScore: 72,
        titleNoveltyScore: 80,
        angleNoveltyScore: 78,
        bodyUsefulnessScore: 71,
      },
    ];
    const result = postPlanAudit(candidates);
    expect(result.passes).toBe(false);
    expect(result.issues).toContain("candidate_count: expected exactly 3 candidates, got 2");
    expect(result.checks.candidate_count).toBe("fail");
  });

  it("fails with low board fit score", () => {
    const candidates = [
      {
        title: "Title 1",
        angleSummary: "Angle 1",
        thesis: "Thesis 1",
        bodyOutline: ["#point1", "#point2", "#point3"],
        differenceFromRecent: ["#diff1"],
        boardFitScore: 60,
        titlePersonaFitScore: 85,
        titleNoveltyScore: 90,
        angleNoveltyScore: 88,
        bodyUsefulnessScore: 75,
      },
      {
        title: "Title 2",
        angleSummary: "Angle 2",
        thesis: "Thesis 2",
        bodyOutline: ["#point1", "#point2", "#point3"],
        differenceFromRecent: ["#diff2"],
        boardFitScore: 75,
        titlePersonaFitScore: 72,
        titleNoveltyScore: 80,
        angleNoveltyScore: 78,
        bodyUsefulnessScore: 71,
      },
      {
        title: "Title 3",
        angleSummary: "Angle 3",
        thesis: "Thesis 3",
        bodyOutline: ["#point1", "#point2", "#point3"],
        differenceFromRecent: ["#diff3"],
        boardFitScore: 70,
        titlePersonaFitScore: 70,
        titleNoveltyScore: 77,
        angleNoveltyScore: 76,
        bodyUsefulnessScore: 73,
      },
    ];
    const result = postPlanAudit(candidates);
    expect(result.passes).toBe(false);
    expect(result.issues).toContain("board_fit: candidate 0 has boardFitScore 60, must be >= 70");
    expect(result.checks.board_fit).toBe("fail");
  });

  it("fails with low novelty scores", () => {
    const candidates = [
      {
        title: "Title 1",
        angleSummary: "Angle 1",
        thesis: "Thesis 1",
        bodyOutline: ["#point1", "#point2", "#point3"],
        differenceFromRecent: ["#diff1"],
        boardFitScore: 80,
        titlePersonaFitScore: 85,
        titleNoveltyScore: 60,
        angleNoveltyScore: 88,
        bodyUsefulnessScore: 75,
      },
      {
        title: "Title 2",
        angleSummary: "Angle 2",
        thesis: "Thesis 2",
        bodyOutline: ["#point1", "#point2", "#point3"],
        differenceFromRecent: ["#diff2"],
        boardFitScore: 75,
        titlePersonaFitScore: 72,
        titleNoveltyScore: 70,
        angleNoveltyScore: 78,
        bodyUsefulnessScore: 71,
      },
      {
        title: "Title 3",
        angleSummary: "Angle 3",
        thesis: "Thesis 3",
        bodyOutline: ["#point1", "#point2", "#point3"],
        differenceFromRecent: ["#diff3"],
        boardFitScore: 70,
        titlePersonaFitScore: 70,
        titleNoveltyScore: 77,
        angleNoveltyScore: 76,
        bodyUsefulnessScore: 73,
      },
    ];
    const result = postPlanAudit(candidates);
    expect(result.passes).toBe(false);
    expect(result.issues).toContain(
      "novelty_evidence: candidate 0 has titleNoveltyScore 60, must be >= 75",
    );
    expect(result.checks.novelty_evidence).toBe("fail");
  });

  it("fails with low persona fit score", () => {
    const candidates = [
      {
        title: "Title 1",
        angleSummary: "Angle 1",
        thesis: "Thesis 1",
        bodyOutline: ["#point1", "#point2", "#point3"],
        differenceFromRecent: ["#diff1"],
        boardFitScore: 80,
        titlePersonaFitScore: 60,
        titleNoveltyScore: 90,
        angleNoveltyScore: 88,
        bodyUsefulnessScore: 75,
      },
      {
        title: "Title 2",
        angleSummary: "Angle 2",
        thesis: "Thesis 2",
        bodyOutline: ["#point1", "#point2", "#point3"],
        differenceFromRecent: ["#diff2"],
        boardFitScore: 75,
        titlePersonaFitScore: 72,
        titleNoveltyScore: 80,
        angleNoveltyScore: 78,
        bodyUsefulnessScore: 71,
      },
      {
        title: "Title 3",
        angleSummary: "Angle 3",
        thesis: "Thesis 3",
        bodyOutline: ["#point1", "#point2", "#point3"],
        differenceFromRecent: ["#diff3"],
        boardFitScore: 70,
        titlePersonaFitScore: 70,
        titleNoveltyScore: 77,
        angleNoveltyScore: 76,
        bodyUsefulnessScore: 73,
      },
    ];
    const result = postPlanAudit(candidates);
    expect(result.passes).toBe(false);
    expect(result.issues).toContain(
      "persona_posting_lens_fit: candidate 0 has titlePersonaFitScore 60, must be >= 70",
    );
    expect(result.checks.persona_posting_lens_fit).toBe("fail");
  });

  it("fails with low body outline usefulness score", () => {
    const candidates = [
      {
        title: "Title 1",
        angleSummary: "Angle 1",
        thesis: "Thesis 1",
        bodyOutline: ["#point1", "#point2", "#point3"],
        differenceFromRecent: ["#diff1"],
        boardFitScore: 80,
        titlePersonaFitScore: 85,
        titleNoveltyScore: 90,
        angleNoveltyScore: 88,
        bodyUsefulnessScore: 60,
      },
      {
        title: "Title 2",
        angleSummary: "Angle 2",
        thesis: "Thesis 2",
        bodyOutline: ["#point1", "#point2", "#point3"],
        differenceFromRecent: ["#diff2"],
        boardFitScore: 75,
        titlePersonaFitScore: 72,
        titleNoveltyScore: 80,
        angleNoveltyScore: 78,
        bodyUsefulnessScore: 71,
      },
      {
        title: "Title 3",
        angleSummary: "Angle 3",
        thesis: "Thesis 3",
        bodyOutline: ["#point1", "#point2", "#point3"],
        differenceFromRecent: ["#diff3"],
        boardFitScore: 70,
        titlePersonaFitScore: 70,
        titleNoveltyScore: 77,
        angleNoveltyScore: 76,
        bodyUsefulnessScore: 73,
      },
    ];
    const result = postPlanAudit(candidates);
    expect(result.passes).toBe(false);
    expect(result.issues).toContain(
      "body_outline_usefulness: candidate 0 has bodyUsefulnessScore 60, must be >= 70",
    );
    expect(result.checks.body_outline_usefulness).toBe("fail");
  });

  it("fails with model-owned final selection score", () => {
    const candidates = [
      {
        title: "Title 1",
        angleSummary: "Angle 1",
        thesis: "Thesis 1",
        bodyOutline: ["#point1", "#point2", "#point3"],
        differenceFromRecent: ["#diff1"],
        boardFitScore: 80,
        titlePersonaFitScore: 85,
        titleNoveltyScore: 90,
        angleNoveltyScore: 88,
        bodyUsefulnessScore: 75,
        modelOwnedOverallScorePresent: true,
      },
      {
        title: "Title 2",
        angleSummary: "Angle 2",
        thesis: "Thesis 2",
        bodyOutline: ["#point1", "#point2", "#point3"],
        differenceFromRecent: ["#diff2"],
        boardFitScore: 75,
        titlePersonaFitScore: 72,
        titleNoveltyScore: 80,
        angleNoveltyScore: 78,
        bodyUsefulnessScore: 71,
      },
      {
        title: "Title 3",
        angleSummary: "Angle 3",
        thesis: "Thesis 3",
        bodyOutline: ["#point1", "#point2", "#point3"],
        differenceFromRecent: ["#diff3"],
        boardFitScore: 70,
        titlePersonaFitScore: 70,
        titleNoveltyScore: 77,
        angleNoveltyScore: 76,
        bodyUsefulnessScore: 73,
      },
    ];
    const result = postPlanAudit(candidates);
    expect(result.passes).toBe(false);
    expect(result.issues).toContain(
      "no_model_owned_final_selection: candidate 0 includes model-owned overall_score, which is not allowed",
    );
    expect(result.checks.no_model_owned_final_selection).toBe("fail");
  });

  it("returns repair guidance for all failures", () => {
    const candidates = [
      {
        title: "Title 1",
        angleSummary: "Angle 1",
        thesis: "Thesis 1",
        bodyOutline: ["#point1", "#point2"],
        differenceFromRecent: ["#diff1"],
        boardFitScore: 60,
        titlePersonaFitScore: 60,
        titleNoveltyScore: 60,
        angleNoveltyScore: 60,
        bodyUsefulnessScore: 60,
        modelOwnedOverallScorePresent: true,
      },
    ];
    const result = postPlanAudit(candidates);
    expect(result.repairGuidance.length).toBeGreaterThan(0);
    expect(result.repairGuidance.every((g) => typeof g === "string")).toBe(true);
  });
});
