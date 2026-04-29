import type { PostPlanCandidate } from "./post-plan-contract";
import type { PromptPersonaEvidence } from "./persona-prompt-directives";

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

const CHECK_KEYS = [
  "candidate_count",
  "board_fit",
  "novelty_evidence",
  "persona_posting_lens_fit",
  "body_outline_usefulness",
  "no_model_owned_final_selection",
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function assertExactKeys(
  record: Record<string, unknown>,
  fieldPath: string,
  allowed: readonly string[],
): void {
  const allowedSet = new Set(allowed);
  const extra = Object.keys(record).filter((key) => !allowedSet.has(key));
  if (extra.length > 0) {
    throw new Error(
      `${fieldPath} contains forbidden key${extra.length === 1 ? "" : "s"} ${extra.join(", ")}`,
    );
  }
}

function normalizeStringArray(value: unknown, fieldPath: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldPath} must be a string array`);
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function parseCheckValue(value: unknown, fieldPath: string): "pass" | "fail" {
  if (value !== "pass" && value !== "fail") {
    throw new Error(`${fieldPath} must be pass or fail`);
  }
  return value;
}

export function deterministicPostPlanAudit(candidates: PostPlanCandidate[]): PostPlanAuditResult {
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

export const postPlanAudit = deterministicPostPlanAudit;

export function buildPostPlanAuditPrompt(input: {
  candidates: PostPlanCandidate[];
  boardContextText?: string | null;
  targetContextText?: string | null;
  personaEvidence: PromptPersonaEvidence;
}): string {
  return [
    "You are auditing a post_plan stage output before the app selects one candidate.",
    "The packet is intentionally compact. Do not fail only because omitted background is missing.",
    "Judge semantic usefulness, novelty reasoning, board fit, persona-native angle fit, and outline usefulness.",
    "",
    "[output_constraints]",
    "Return exactly one raw JSON object with keys: passes, issues, repairGuidance, checks.",
    "checks must contain exactly: candidate_count, board_fit, novelty_evidence, persona_posting_lens_fit, body_outline_usefulness, no_model_owned_final_selection.",
    "Each check value must be pass or fail.",
    "{",
    '  "passes": true,',
    '  "issues": ["string"],',
    '  "repairGuidance": ["string"],',
    '  "checks": {',
    '    "candidate_count": "pass | fail",',
    '    "board_fit": "pass | fail",',
    '    "novelty_evidence": "pass | fail",',
    '    "persona_posting_lens_fit": "pass | fail",',
    '    "body_outline_usefulness": "pass | fail",',
    '    "no_model_owned_final_selection": "pass | fail"',
    "  }",
    "}",
    "",
    "[board_context]",
    input.boardContextText?.trim() || "(none)",
    "",
    "[target_context]",
    input.targetContextText?.trim() || "(none)",
    "",
    "[persona_evidence]",
    JSON.stringify(input.personaEvidence, null, 2),
    "",
    "[post_plan_candidates]",
    JSON.stringify(input.candidates, null, 2),
  ].join("\n");
}

export function buildPostPlanRepairPrompt(input: {
  baseTaskContext: string;
  issues: string[];
  repairGuidance: string[];
  previousOutput: string;
}): string {
  return [
    input.baseTaskContext,
    "[planning_audit_repair]",
    "Your previous post_plan output failed planning semantic audit checks.",
    "Rewrite the post_plan JSON so all checks pass while keeping exactly 3 candidates.",
    "Do not add overall_score or any extra keys.",
    "",
    "[audit_issues]",
    ...(input.issues.length > 0 ? input.issues.map((item) => `- ${item}`) : ["- none"]),
    "",
    "[repair_guidance]",
    ...(input.repairGuidance.length > 0
      ? input.repairGuidance.map((item) => `- ${item}`)
      : ["- none"]),
    "",
    "[previous_output]",
    input.previousOutput,
  ].join("\n");
}

export function parsePostPlanAuditResult(rawText: string): PostPlanAuditResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("post_plan audit output is empty");
  }
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    throw new Error("post_plan audit output must be a raw JSON object");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("post_plan audit output must be valid JSON");
  }

  const record = asRecord(parsed);
  if (!record) {
    throw new Error("post_plan audit output must be a JSON object");
  }
  assertExactKeys(record, "post_plan audit", ["passes", "issues", "repairGuidance", "checks"]);
  if (typeof record.passes !== "boolean") {
    throw new Error("post_plan audit passes must be boolean");
  }
  const checksRecord = asRecord(record.checks);
  if (!checksRecord) {
    throw new Error("post_plan audit checks must be an object");
  }
  assertExactKeys(checksRecord, "post_plan audit checks", CHECK_KEYS);

  return {
    passes: record.passes,
    issues: normalizeStringArray(record.issues, "post_plan audit issues"),
    repairGuidance: normalizeStringArray(record.repairGuidance, "post_plan audit repairGuidance"),
    checks: {
      candidate_count: parseCheckValue(checksRecord.candidate_count, "checks.candidate_count"),
      board_fit: parseCheckValue(checksRecord.board_fit, "checks.board_fit"),
      novelty_evidence: parseCheckValue(checksRecord.novelty_evidence, "checks.novelty_evidence"),
      persona_posting_lens_fit: parseCheckValue(
        checksRecord.persona_posting_lens_fit,
        "checks.persona_posting_lens_fit",
      ),
      body_outline_usefulness: parseCheckValue(
        checksRecord.body_outline_usefulness,
        "checks.body_outline_usefulness",
      ),
      no_model_owned_final_selection: parseCheckValue(
        checksRecord.no_model_owned_final_selection,
        "checks.no_model_owned_final_selection",
      ),
    },
  };
}
