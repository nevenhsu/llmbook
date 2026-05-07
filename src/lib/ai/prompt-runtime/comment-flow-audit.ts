import {
  PersonaOutputValidationError,
  formatPersonaEvidenceForAudit,
  type PromptPersonaEvidence,
} from "@/lib/ai/prompt-runtime/persona-audit-shared";
import { parseJsonObject, readStringArray, readCheckStatus } from "./json-parse-utils";

export type CommentAuditCheckStatus = "pass" | "fail";

export type CommentAuditChecks = {
  post_relevance: CommentAuditCheckStatus;
  net_new_value: CommentAuditCheckStatus;
  non_repetition_against_recent_comments: CommentAuditCheckStatus;
  standalone_top_level_shape: CommentAuditCheckStatus;
  value_fit: CommentAuditCheckStatus;
  reasoning_fit: CommentAuditCheckStatus;
  discourse_fit: CommentAuditCheckStatus;
  expression_fit: CommentAuditCheckStatus;
};

export type CommentAuditResult = {
  passes: boolean;
  issues: string[];
  repairGuidance: string[];
  checks: CommentAuditChecks;
};

function parseAuditJsonObject(text: string): Record<string, unknown> {
  return parseJsonObject(text, (type) => {
    if (type === "empty") {
      return new PersonaOutputValidationError({
        code: "persona_audit_invalid",
        message: "comment audit returned empty output",
        rawOutput: text,
      });
    }
    if (type === "invalid_json") {
      return new PersonaOutputValidationError({
        code: "persona_audit_invalid",
        message: "comment audit returned invalid JSON",
        rawOutput: text,
      });
    }
    return new PersonaOutputValidationError({
      code: "persona_audit_invalid",
      message: "comment audit output must be a JSON object",
      rawOutput: text,
    });
  });
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
  const value_fit = readCheckStatus(record.value_fit);
  const reasoning_fit = readCheckStatus(record.reasoning_fit);
  const discourse_fit = readCheckStatus(record.discourse_fit);
  const expression_fit = readCheckStatus(record.expression_fit);

  if (
    !post_relevance ||
    !net_new_value ||
    !non_repetition_against_recent_comments ||
    !standalone_top_level_shape ||
    !value_fit ||
    !reasoning_fit ||
    !discourse_fit ||
    !expression_fit
  ) {
    return null;
  }

  return {
    post_relevance,
    net_new_value,
    non_repetition_against_recent_comments,
    standalone_top_level_shape,
    value_fit,
    reasoning_fit,
    discourse_fit,
    expression_fit,
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
    "- value_fit",
    "- reasoning_fit",
    "- discourse_fit",
    "- expression_fit",
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
    '    "value_fit": "pass | fail",',
    '    "reasoning_fit": "pass | fail",',
    '    "discourse_fit": "pass | fail",',
    '    "expression_fit": "pass | fail"',
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
  const parsed = parseAuditJsonObject(rawText);
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
