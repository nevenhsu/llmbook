import type { PostPlanCandidate } from "./post-plan-contract";
import type { ContentMode } from "@/lib/ai/core/persona-core-v2";

export type PostPlanAuditChecks = {
  candidate_count: "pass" | "fail";
  persona_fit: "pass" | "fail";
  novelty_evidence: "pass" | "fail";
  procedure_fit: "pass" | "fail";
  narrative_fit?: "pass" | "fail";
};

export type PostPlanAuditResult = {
  passes: boolean;
  issues: string[];
  repairGuidance: string[];
  checks: PostPlanAuditChecks;
};

function getCheckKeys(contentMode: ContentMode): readonly string[] {
  return contentMode === "story"
    ? ([
        "candidate_count",
        "persona_fit",
        "novelty_evidence",
        "procedure_fit",
        "narrative_fit",
      ] as const)
    : (["candidate_count", "persona_fit", "novelty_evidence", "procedure_fit"] as const);
}

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

function formatTruncatedPreviousOutput(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return "(empty)";
  }
  if (trimmed.length <= 1600) {
    return trimmed;
  }
  const head = trimmed.slice(0, 1000).trimEnd();
  const tail = trimmed.slice(-500).trimStart();
  return `${head}\n...[middle omitted for repair context]...\n${tail}`;
}

export function buildPostPlanAuditPrompt(input: {
  candidate: PostPlanCandidate;
  contentMode?: ContentMode;
  personaPacketText?: string | null;
}): string {
  const contentMode = input.contentMode ?? "discussion";
  const checks = [
    "candidate_count",
    "persona_fit",
    "novelty_evidence",
    "procedure_fit",
    ...(contentMode === "story" ? (["narrative_fit"] as const) : []),
  ];

  const lines = [
    "You are auditing a post_plan stage output before the app selects one candidate.",
    "Judge persona fit, novelty, and procedure fit of the candidate.",
  ];

  if (input.personaPacketText) {
    lines.push("", "[persona_packet]", input.personaPacketText);
  }

  if (contentMode === "story") {
    lines.push("", "Story mode: also check narrative fit.");
  }

  lines.push(
    "",
    "[output_constraints]",
    "Return exactly one raw JSON object with keys: passes, issues, repairGuidance, checks.",
    `checks must contain exactly: ${checks.join(", ")}.`,
    "Each check value must be pass or fail.",
    "{",
    '  "passes": true,',
    '  "issues": ["string"],',
    '  "repairGuidance": ["string"],',
    '  "checks": {',
  );

  for (const check of checks) {
    lines.push(`    "${check}": "pass | fail",`);
  }

  lines.push("  }", "}", "", "[post_plan_candidate]", JSON.stringify(input.candidate, null, 2));

  return lines.join("\n");
}

export function buildPostPlanRepairPrompt(input: {
  issues: string[];
  repairGuidance: string[];
  previousOutput: string;
}): string {
  return [
    "[planning_repair]",
    "Repair the post_plan candidates below using the audit findings.",
    "Return the post_plan JSON with corrected candidates.",
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
    formatTruncatedPreviousOutput(input.previousOutput),
    "",
    "[output_constraints]",
    "Return exactly one JSON object.",
    "{",
    '  "candidates": [',
    "    {",
    '      "title": "string",',
    '      "thesis": "string",',
    '      "body_outline": ["string"],',
    '      "persona_fit_score": 0,',
    '      "novelty_score": 0',
    "    }",
    "  ]",
    "}",
    "Return 2-3 candidates.",
    "Do not add extra keys.",
    "Do not output any text outside the JSON object.",
  ].join("\n");
}

export function parsePostPlanAuditResult(
  rawText: string,
  contentMode: ContentMode = "discussion",
): PostPlanAuditResult {
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
  const checkKeys = getCheckKeys(contentMode);
  assertExactKeys(checksRecord, "post_plan audit checks", checkKeys);

  const checks: PostPlanAuditChecks = {
    candidate_count: parseCheckValue(checksRecord.candidate_count, "checks.candidate_count"),
    persona_fit: parseCheckValue(checksRecord.persona_fit, "checks.persona_fit"),
    novelty_evidence: parseCheckValue(checksRecord.novelty_evidence, "checks.novelty_evidence"),
    procedure_fit: parseCheckValue(checksRecord.procedure_fit, "checks.procedure_fit"),
  };

  if (contentMode === "story") {
    checks.narrative_fit = parseCheckValue(checksRecord.narrative_fit, "checks.narrative_fit");
  }

  return {
    passes: record.passes,
    issues: normalizeStringArray(record.issues, "post_plan audit issues"),
    repairGuidance: normalizeStringArray(record.repairGuidance, "post_plan audit repairGuidance"),
    checks,
  };
}
