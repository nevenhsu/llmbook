import { PersonaOutputValidationError } from "@/lib/ai/prompt-runtime/persona-output-audit";
import type { PromptPersonaEvidence } from "@/lib/ai/prompt-runtime/persona-prompt-directives";
import { formatPersonaEvidenceForAudit } from "@/lib/ai/prompt-runtime/post-body-audit";

export type CommentAuditCheckStatus = "pass" | "fail";

export type CommentAuditChecks = {
  post_relevance: CommentAuditCheckStatus;
  net_new_value: CommentAuditCheckStatus;
  non_repetition_against_recent_comments: CommentAuditCheckStatus;
  standalone_top_level_shape: CommentAuditCheckStatus;
  persona_fit: CommentAuditCheckStatus;
};

export type CommentAuditResult = {
  passes: boolean;
  issues: string[];
  repairGuidance: string[];
  checks: CommentAuditChecks;
};

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function extractJsonFromText(text: string): string {
  const trimmed = normalizeText(text);
  if (!trimmed) {
    return "";
  }
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/```\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function parseJsonObject(text: string): Record<string, unknown> {
  const jsonText = extractJsonFromText(text);
  if (!jsonText) {
    throw new PersonaOutputValidationError({
      code: "persona_audit_invalid",
      message: "comment audit returned empty output",
      rawOutput: text,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new PersonaOutputValidationError({
      code: "persona_audit_invalid",
      message: "comment audit returned invalid JSON",
      rawOutput: text,
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PersonaOutputValidationError({
      code: "persona_audit_invalid",
      message: "comment audit output must be a JSON object",
      rawOutput: text,
    });
  }

  return parsed as Record<string, unknown>;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value
    .map((item) => (typeof item === "string" ? normalizeText(item) : ""))
    .filter((item) => item.length > 0);
}

function readCheckStatus(value: unknown): CommentAuditCheckStatus | null {
  return value === "pass" || value === "fail" ? value : null;
}

function parseChecks(value: unknown): CommentAuditChecks | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const post_relevance = readCheckStatus(record.post_relevance);
  const net_new_value = readCheckStatus(record.net_new_value);
  const non_repetition_against_recent_comments = readCheckStatus(
    record.non_repetition_against_recent_comments,
  );
  const standalone_top_level_shape = readCheckStatus(record.standalone_top_level_shape);
  const persona_fit = readCheckStatus(record.persona_fit);

  if (
    !post_relevance ||
    !net_new_value ||
    !non_repetition_against_recent_comments ||
    !standalone_top_level_shape ||
    !persona_fit
  ) {
    return null;
  }

  return {
    post_relevance,
    net_new_value,
    non_repetition_against_recent_comments,
    standalone_top_level_shape,
    persona_fit,
  };
}

export function buildCommentAuditPrompt(input: {
  personaEvidence: PromptPersonaEvidence;
  rootPostText?: string | null;
  recentTopLevelCommentsText?: string | null;
  generatedComment: string;
}): string {
  return [
    "[comment_audit]",
    "You are auditing a top-level comment before persistence.",
    "You are reviewing a compact app-owned review packet, not the full generation prompt.",
    "Judge whether it is a real standalone contribution to the post rather than an echo.",
    "",
    "Required checks:",
    "- post_relevance",
    "- net_new_value",
    "- non_repetition_against_recent_comments",
    "- standalone_top_level_shape",
    "- persona_fit",
    "",
    "Rules:",
    "- Do not complain that unrelated generation background is absent; judge only the checks supported by this packet.",
    "",
    "[persona_evidence]",
    formatPersonaEvidenceForAudit(input.personaEvidence),
    "",
    input.rootPostText?.trim() ?? "[root_post]\nNo root post available.",
    "",
    input.recentTopLevelCommentsText?.trim() ??
      "[recent_top_level_comments]\nNo recent top-level comments are available.",
    "",
    "[generated_comment]",
    input.generatedComment.trim(),
    "",
    "[output_constraints]",
    "Return exactly one JSON object.",
    "{",
    '  "passes": true,',
    '  "issues": ["string"],',
    '  "repairGuidance": ["string"],',
    '  "checks": {',
    '    "post_relevance": "pass | fail",',
    '    "net_new_value": "pass | fail",',
    '    "non_repetition_against_recent_comments": "pass | fail",',
    '    "standalone_top_level_shape": "pass | fail",',
    '    "persona_fit": "pass | fail"',
    "  }",
    "}",
  ].join("\n");
}

export function buildCommentRepairPrompt(input: {
  personaEvidence: PromptPersonaEvidence;
  rootPostText?: string | null;
  recentTopLevelCommentsText?: string | null;
  issues: string[];
  repairGuidance: string[];
  previousOutput: string;
}): string {
  return [
    "[comment_repair]",
    "Repair the generated top-level comment below.",
    "You are receiving a fuller rewrite packet than the audit saw.",
    "Keep the same output schema.",
    "Make it a standalone top-level contribution with net-new value.",
    "",
    "[persona_evidence]",
    formatPersonaEvidenceForAudit(input.personaEvidence),
    "",
    input.rootPostText?.trim() ?? "[root_post]\nNo root post available.",
    "",
    input.recentTopLevelCommentsText?.trim() ??
      "[recent_top_level_comments]\nNo recent top-level comments are available.",
    "",
    "[audit_issues]",
    ...(input.issues.length > 0
      ? input.issues.map((item) => `- ${item}`)
      : ["- No issues provided."]),
    "",
    "[repair_guidance]",
    ...(input.repairGuidance.length > 0
      ? input.repairGuidance.map((item) => `- ${item}`)
      : ["- No repair guidance provided."]),
    "",
    "[previous_output]",
    input.previousOutput.trim(),
    "",
    "[output_constraints]",
    "Return exactly one JSON object with the same comment schema.",
  ].join("\n");
}

export function parseCommentAuditResult(rawText: string): CommentAuditResult {
  const parsed = parseJsonObject(rawText);
  const issues = readStringArray(parsed.issues);
  const repairGuidance = readStringArray(parsed.repairGuidance);
  const checks = parseChecks(parsed.checks);

  if (typeof parsed.passes !== "boolean" || issues === null || repairGuidance === null || !checks) {
    throw new PersonaOutputValidationError({
      code: "persona_audit_invalid",
      message:
        "comment audit output must include boolean passes, string-array issues/repairGuidance, and valid checks",
      rawOutput: rawText,
    });
  }

  return {
    passes: parsed.passes,
    issues,
    repairGuidance,
    checks,
  };
}
