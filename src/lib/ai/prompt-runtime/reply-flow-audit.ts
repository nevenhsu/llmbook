import { PersonaOutputValidationError } from "@/lib/ai/prompt-runtime/persona-audit-shared";
import { parseJsonObject, readStringArray, readCheckStatus } from "./json-parse-utils";
import type { ContentMode } from "@/lib/ai/core/persona-core-v2";

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
  procedure_fit: ReplyAuditCheckStatus;
  narrative_fit?: ReplyAuditCheckStatus;
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

function parseChecks(value: unknown, contentMode: ContentMode): ReplyAuditChecks | null {
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
  const procedure_fit = readCheckStatus(record.procedure_fit);

  if (
    !source_comment_responsiveness ||
    !thread_continuity ||
    !forward_motion ||
    !non_top_level_essay_shape ||
    !value_fit ||
    !reasoning_fit ||
    !discourse_fit ||
    !expression_fit ||
    !procedure_fit
  ) {
    return null;
  }

  const checks: ReplyAuditChecks = {
    source_comment_responsiveness,
    thread_continuity,
    forward_motion,
    non_top_level_essay_shape,
    value_fit,
    reasoning_fit,
    discourse_fit,
    expression_fit,
    procedure_fit,
  };

  if (contentMode === "story") {
    const narrative_fit = readCheckStatus(record.narrative_fit);
    if (!narrative_fit) {
      return null;
    }
    checks.narrative_fit = narrative_fit;
  }

  return checks;
}

export function buildReplyAuditPrompt(input: {
  sourceCommentText?: string | null;
  ancestorCommentsText?: string | null;
  generatedReply: string;
  contentMode?: ContentMode;
  personaPacketText?: string | null;
}): string {
  const contentMode = input.contentMode ?? "discussion";
  const lines = [
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
    "- procedure_fit",
  ];

  if (contentMode === "story") {
    lines.push("- narrative_fit");
  }

  if (input.personaPacketText) {
    lines.push("", "[persona_packet]", input.personaPacketText);
  }

  lines.push(
    "",
    "Rules:",
    "- Do not complain that unrelated generation background is absent; judge only the checks supported by this packet.",
    "- Fail procedure_fit if the reply tone matches the persona but the context interpretation logic is missing or generic.",
  );

  if (contentMode === "story") {
    lines.push(
      "- Fail narrative_fit if the story continuation does not match the persona's narrative engine.",
    );
  }

  lines.push(
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
    "Do not output text outside the JSON object.",
  );

  return lines.join("\n");
}

export function buildReplyRepairPrompt(input: {
  sourceCommentText?: string | null;
  ancestorCommentsText?: string | null;
  issues: string[];
  repairGuidance: string[];
  previousOutput: string;
  personaPacketText?: string | null;
}): string {
  const lines = [
    "[reply_repair]",
    "Repair the generated thread reply below.",
    "You are receiving a fuller rewrite packet than the audit saw.",
    "Keep the same output schema.",
    "Respond directly to the source comment.",
    "Do not write a top-level essay.",
  ];

  if (input.personaPacketText) {
    lines.push("", "[persona_packet]", input.personaPacketText);
  }

  lines.push(
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
  );

  return lines.join("\n");
}

export function parseReplyAuditResult(
  rawText: string,
  contentMode: ContentMode = "discussion",
): ReplyAuditResult {
  const parsed = parseAuditJsonObject(rawText);
  const issues = readStringArray(parsed.issues);
  const repairGuidance = readStringArray(parsed.repairGuidance);
  const checks = parseChecks(parsed.checks, contentMode);

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
