import { PersonaOutputValidationError } from "@/lib/ai/prompt-runtime/persona-output-audit";
import type { PromptPersonaEvidence } from "@/lib/ai/prompt-runtime/persona-prompt-directives";
import { formatPersonaEvidenceForAudit } from "@/lib/ai/prompt-runtime/post-body-audit";

export type ReplyAuditCheckStatus = "pass" | "fail";

export type ReplyAuditChecks = {
  source_comment_responsiveness: ReplyAuditCheckStatus;
  thread_continuity: ReplyAuditCheckStatus;
  forward_motion: ReplyAuditCheckStatus;
  non_top_level_essay_shape: ReplyAuditCheckStatus;
  persona_fit: ReplyAuditCheckStatus;
};

export type ReplyAuditResult = {
  passes: boolean;
  issues: string[];
  repairGuidance: string[];
  checks: ReplyAuditChecks;
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
      message: "reply audit returned empty output",
      rawOutput: text,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new PersonaOutputValidationError({
      code: "persona_audit_invalid",
      message: "reply audit returned invalid JSON",
      rawOutput: text,
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PersonaOutputValidationError({
      code: "persona_audit_invalid",
      message: "reply audit output must be a JSON object",
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

function readCheckStatus(value: unknown): ReplyAuditCheckStatus | null {
  return value === "pass" || value === "fail" ? value : null;
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
  const persona_fit = readCheckStatus(record.persona_fit);

  if (
    !source_comment_responsiveness ||
    !thread_continuity ||
    !forward_motion ||
    !non_top_level_essay_shape ||
    !persona_fit
  ) {
    return null;
  }

  return {
    source_comment_responsiveness,
    thread_continuity,
    forward_motion,
    non_top_level_essay_shape,
    persona_fit,
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
    "- persona_fit",
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
    '    "persona_fit": "pass | fail"',
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
  const parsed = parseJsonObject(rawText);
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
