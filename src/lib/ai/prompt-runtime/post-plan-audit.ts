import type { PostPlanCandidate } from "./post-plan-contract";

export type PostPlanAuditChecks = {
  candidate_count: "pass" | "fail";
  board_fit: "pass" | "fail";
  novelty_evidence: "pass" | "fail";
  persona_posting_lens_fit: "pass" | "fail";
  body_outline_usefulness: "pass" | "fail";
  no_model_owned_final_selection: "pass" | "fail";
};

export type PostPlanAuditResult = {
  passes: boolean;
  issues: string[];
  repairGuidance: string[];
  checks: PostPlanAuditChecks;
};

export function postPlanAudit(candidates: PostPlanCandidate[]): PostPlanAuditResult {
  const issues: string[] = [];
  const repairGuidance: string[] = [];

  // Check 1: candidate_count - must be exactly 3
  if (candidates.length !== 3) {
    issues.push(`candidate_count: expected exactly 3 candidates, got ${candidates.length}`);
    repairGuidance.push(
      "post_plan must return exactly 3 candidates. Add or remove candidates to meet this requirement.",
    );
  }

  // Check 2: board_fit - each candidate must have boardFitScore >= 70
  candidates.forEach((candidate, index) => {
    if (candidate.boardFitScore < 70) {
      issues.push(
        `board_fit: candidate ${index} has boardFitScore ${candidate.boardFitScore}, must be >= 70`,
      );
      repairGuidance.push(
        `Improve candidate ${index} board fit by refining the angle summary and thesis to better align with board priorities.`,
      );
    }
  });

  // Check 3: novelty_evidence - each candidate must have novelty scores >= 75
  candidates.forEach((candidate, index) => {
    if (candidate.titleNoveltyScore < 75) {
      issues.push(
        `novelty_evidence: candidate ${index} has titleNoveltyScore ${candidate.titleNoveltyScore}, must be >= 75`,
      );
      repairGuidance.push(
        `Enhance candidate ${index} novelty by introducing more unique insights and perspectives not seen in recent posts.`,
      );
    }
    if (candidate.angleNoveltyScore < 75) {
      issues.push(
        `novelty_evidence: candidate ${index} has angleNoveltyScore ${candidate.angleNoveltyScore}, must be >= 75`,
      );
      repairGuidance.push(
        `Improve candidate ${index} angle novelty by exploring a more distinct and differentiated angle from recent discussions.`,
      );
    }
  });

  // Check 4: persona_posting_lens_fit - each candidate must have persona fit scores >= 70
  candidates.forEach((candidate, index) => {
    if (candidate.titlePersonaFitScore < 70) {
      issues.push(
        `persona_posting_lens_fit: candidate ${index} has titlePersonaFitScore ${candidate.titlePersonaFitScore}, must be >= 70`,
      );
      repairGuidance.push(
        `Adjust candidate ${index} persona fit by ensuring the title and angle resonate with the target persona's values and communication style.`,
      );
    }
  });

  // Check 5: body_outline_usefulness - each candidate must have bodyUsefulnessScore >= 70
  candidates.forEach((candidate, index) => {
    if (candidate.bodyUsefulnessScore < 70) {
      issues.push(
        `body_outline_usefulness: candidate ${index} has bodyUsefulnessScore ${candidate.bodyUsefulnessScore}, must be >= 70`,
      );
      repairGuidance.push(
        `Improve candidate ${index} body usefulness by developing more concrete, actionable insights and practical recommendations in the body outline.`,
      );
    }
  });

  // Check 6: no_model_owned_final_selection - no candidate should have modelOwnedOverallScorePresent = true
  candidates.forEach((candidate, index) => {
    if (candidate.modelOwnedOverallScorePresent) {
      issues.push(
        `no_model_owned_final_selection: candidate ${index} includes model-owned overall_score, which is not allowed`,
      );
      repairGuidance.push(
        `Remove the overall_score field from candidate ${index} as models should not provide final selection scores.`,
      );
    }
  });

  const passes = issues.length === 0;

  return {
    passes,
    issues,
    repairGuidance,
    checks: {
      candidate_count: issues.some((i) => i.startsWith("candidate_count")) ? "fail" : "pass",
      board_fit: issues.some((i) => i.startsWith("board_fit")) ? "fail" : "pass",
      novelty_evidence: issues.some((i) => i.startsWith("novelty_evidence")) ? "fail" : "pass",
      persona_posting_lens_fit: issues.some((i) => i.startsWith("persona_posting_lens_fit"))
        ? "fail"
        : "pass",
      body_outline_usefulness: issues.some((i) => i.startsWith("body_outline_usefulness"))
        ? "fail"
        : "pass",
      no_model_owned_final_selection: issues.some((i) =>
        i.startsWith("no_model_owned_final_selection"),
      )
        ? "fail"
        : "pass",
    },
  };
}
