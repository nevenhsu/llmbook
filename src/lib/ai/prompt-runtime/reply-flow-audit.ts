import {
  PersonaOutputValidationError,
  formatPersonaEvidenceForAudit,
  type PromptPersonaEvidence,
} from "@/lib/ai/prompt-runtime/persona-audit-shared";
import { parseJsonObject, readStringArray, readCheckStatus } from "./json-parse-utils";

export type ReplyAuditCheckStatus = "pass" | "fail";

export type ReplyAuditChecks = {
  source_comment_responsiveness: ReplyAuditCheckStatus;
  thread_continuity: ReplyAuditCheckStatus;
  forward_motion: ReplyAuditCheckStatus;
  non_top_level_essay_shape: ReplyAuditCheckStatus;
  value_fit: ReplyAuditCheckStatus;
  reasoning_fit: ReplyAuditCheckStatus;
  discourse_fit: ReplyAuditCheckStatus;
  expression_fit: ReplyAuditCheckStatus;
};

export type ReplyAuditResult = {
  passes: boolean;
  issues: string[];
  repairGuidance: string[];
  checks: ReplyAuditChecks;
};

function parseAuditJsonObject(text: string): Record<string, unknown> {
  return parseJsonObject(text, (type) => {
    if (type === "empty") {
      return new PersonaOutputValidationError({
        code: "persona_audit_invalid",
        message: "reply audit returned empty output",
        rawOutput: text,
      });
    }
    if (type === "invalid_json") {
      return new PersonaOutputValidationError({
        code: "persona_audit_invalid",
        message: "reply audit returned invalid JSON",
        rawOutput: text,
      });
    }
    return new PersonaOutputValidationError({
      code: "persona_audit_invalid",
      message: "reply audit output must be a JSON object",
      rawOutput: text,
    });
  });
}

function parseChecks(value: unknown): ReplyAuditChecks | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const source_comment_responsiveness = readCheckStatus(record.source_comment_responsiveness);
  const thread_continuity = readCheckStatus(record.thread_continuity);
  const forward_motion = readCheckStatus(record.forward_motion);
  const non_top_level_essay_shape = readCheckStatus(record.non_top_level_essay_shape);
  const value_fit = readCheckStatus(record.value_fit);
  const reasoning_fit = readCheckStatus(record.reasoning_fit);
  const discourse_fit = readCheckStatus(record.discourse_fit);
  const expression_fit = readCheckStatus(record.expression_fit);

  if (
    !source_comment_responsiveness ||
    !thread_continuity ||
    !forward_motion ||
    !non_top_level_essay_shape ||
    !value_fit ||
    !reasoning_fit ||
    !discourse_fit ||
    !expression_fit
  ) {
    return null;
  }

  return {
    source_comment_responsiveness,
    thread_continuity,
    forward_motion,
    non_top_level_essay_shape,
    value_fit,
    reasoning_fit,
    discourse_fit,
    expression_fit,
  };
}

export function buildReplyAuditPrompt(input: {
  personaEvidence: PromptPersonaEvidence;
  sourceCommentText?: string | null;
  ancestorCommentsText?: string | null;
  generatedReply: string;
}): string {
  return [
    "[reply_audit]",
    "You are auditing a thread reply before persistence.",
    "You are reviewing a compact app-owned review packet, not the full generation prompt.",
    "Judge whether it responds to the source comment directly, continues the thread, and avoids top-level essay shape.",
    "",
    "Required checks:",
    "- source_comment_responsiveness",
    "- thread_continuity",
    "- forward_motion",
    "- non_top_level_essay_shape",
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
    input.sourceCommentText?.trim() ?? "[source_comment]\nNo source comment available.",
    "",
    input.ancestorCommentsText?.trim() ??
      "[ancestor_comments]\nNo ancestor comments are available.",
    "",
    "[generated_reply]",
    input.generatedReply.trim(),
    "",
    "[output_constraints]",
    "Return exactly one JSON object.",
    "{",
    '  "passes": true,',
    '  "issues": ["string"],',
    '  "repairGuidance": ["string"],',
    '  "checks": {',
    '    "source_comment_responsiveness": "pass | fail",',
    '    "thread_continuity": "pass | fail",',
    '    "forward_motion": "pass | fail",',
    '    "non_top_level_essay_shape": "pass | fail",',
    '    "value_fit": "pass | fail",',
    '    "reasoning_fit": "pass | fail",',
    '    "discourse_fit": "pass | fail",',
    '    "expression_fit": "pass | fail"',
    "  }",
    "}",
  ].join("\n");
}

export function buildReplyRepairPrompt(input: {
  personaEvidence: PromptPersonaEvidence;
  sourceCommentText?: string | null;
  ancestorCommentsText?: string | null;
  issues: string[];
  repairGuidance: string[];
  previousOutput: string;
}): string {
  return [
    "[reply_repair]",
    "Repair the generated thread reply below.",
    "You are receiving a fuller rewrite packet than the audit saw.",
    "Keep the same output schema.",
    "Respond directly to the source comment.",
    "Do not write a top-level essay.",
    "",
    "[persona_evidence]",
    formatPersonaEvidenceForAudit(input.personaEvidence),
    "",
    input.sourceCommentText?.trim() ?? "[source_comment]\nNo source comment available.",
    "",
    input.ancestorCommentsText?.trim() ??
      "[ancestor_comments]\nNo ancestor comments are available.",
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
    "Return exactly one JSON object with the same reply schema.",
  ].join("\n");
}

export function parseReplyAuditResult(rawText: string): ReplyAuditResult {
  const parsed = parseAuditJsonObject(rawText);
  const issues = readStringArray(parsed.issues);
  const repairGuidance = readStringArray(parsed.repairGuidance);
  const checks = parseChecks(parsed.checks);

  if (typeof parsed.passes !== "boolean" || issues === null || repairGuidance === null || !checks) {
    throw new PersonaOutputValidationError({
      code: "persona_audit_invalid",
      message:
        "reply audit output must include boolean passes, string-array issues/repairGuidance, and valid checks",
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
