import type { PersonaInteractionTaskType } from "@/lib/ai/core/persona-core-v2";
import type {
  PromptPersonaDirectives,
  PersonaAuditSeverity,
  PersonaAuditResult,
  PersonaOutputAuditPromptMode,
} from "@/lib/ai/prompt-runtime/persona-audit-shared";
import { PersonaOutputValidationError } from "@/lib/ai/prompt-runtime/persona-audit-shared";
export {
  PersonaOutputValidationError,
  isRetryablePersonaAuditParseFailure,
} from "@/lib/ai/prompt-runtime/persona-audit-shared";
export type {
  PersonaAuditResult,
  PersonaAuditSeverity,
  PersonaOutputAuditPromptMode,
} from "@/lib/ai/prompt-runtime/persona-audit-shared";

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
      message: "persona audit returned empty output",
      rawOutput: text,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new PersonaOutputValidationError({
      code: "persona_audit_invalid",
      message: "persona audit returned invalid JSON",
      rawOutput: text,
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PersonaOutputValidationError({
      code: "persona_audit_invalid",
      message: "persona audit output must be a JSON object",
      rawOutput: text,
    });
  }

  return parsed as Record<string, unknown>;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value
    .map((item) => (typeof item === "string" ? normalizeText(item) : ""))
    .filter((item) => item.length > 0);
  return items;
}

function readSeverity(value: unknown): PersonaAuditSeverity | null {
  return value === "low" || value === "medium" || value === "high" ? value : null;
}

function readConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0 || value > 1) {
    return null;
  }
  return value;
}

export function buildPersonaOutputAuditPrompt(input: {
  actionType: Exclude<PersonaInteractionTaskType, "reply">;
  taskContext: string;
  renderedOutput: string;
  directives: PromptPersonaDirectives;
  observedIssues?: string[];
  mode?: PersonaOutputAuditPromptMode;
}): string {
  const mode = input.mode ?? "default";
  const observedIssues =
    input.observedIssues && input.observedIssues.length > 0
      ? input.observedIssues.join(", ")
      : "none";
  const taskContext =
    mode === "compact" ? truncateForAudit(input.taskContext, 1000) : input.taskContext.trim();
  const renderedOutput =
    mode === "compact" ? truncateForAudit(input.renderedOutput, 1800) : input.renderedOutput.trim();
  const voiceContract =
    mode === "compact"
      ? input.directives.voiceContract.slice(0, 4)
      : input.directives.voiceContract;
  const referenceRoleGuidance =
    mode === "compact"
      ? input.directives.referenceRoleGuidance.slice(0, 2)
      : input.directives.referenceRoleGuidance;
  const antiStyleRules =
    mode === "compact"
      ? input.directives.antiStyleRules.slice(0, 3)
      : input.directives.antiStyleRules;
  const examples =
    mode === "compact"
      ? input.directives.inCharacterExamples.slice(0, 1)
      : input.directives.inCharacterExamples;

  return [
    "[persona_output_audit]",
    "You are auditing whether generated forum content still matches the persona and prompt constraints.",
    "Evaluate the generated output in whatever language it uses. Keep your own response in English.",
    `Audit the generated ${input.actionType} for persona fit, anti-style compliance, immediate reaction, and reference-role framing.`,
    "Return exactly one JSON object.",
    "Return raw JSON only. Do not use markdown fences.",
    "passes: boolean",
    "issues: string[]",
    "repairGuidance: string[]",
    'severity: "low" | "medium" | "high"',
    "confidence: number",
    "missingSignals: string[]",
    "Keep every array concise: at most 4 short phrases per array.",
    "Keep each string short and functional, not a paragraph.",
    "If the output already fits, set passes=true and return empty arrays for issues and repairGuidance.",
    "When passes=true, still return severity='low', a confidence score between 0 and 1, and an empty missingSignals array.",
    "",
    "[audit_mode]",
    mode,
    "",
    "[task_context]",
    taskContext || "No task context provided.",
    "",
    "[agent_voice_contract]",
    voiceContract.join("\n"),
    "",
    "[reference_role_guidance]",
    referenceRoleGuidance.join("\n") || "No explicit reference-role guidance available.",
    "",
    "[agent_anti_style_rules]",
    antiStyleRules.join("\n"),
    "",
    "[agent_examples]",
    examples
      .map((example) =>
        [`Scenario: ${example.scenario}`, `Response: ${example.response}`].join("\n"),
      )
      .join("\n\n") || "No explicit persona examples available.",
    "",
    "[observed_drift_signals]",
    observedIssues,
    "",
    "[generated_output]",
    renderedOutput,
  ].join("\n");
}

function truncateForAudit(value: string, maxChars: number): string {
  const normalized = normalizeText(value);
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 14)).trimEnd()} [truncated]`;
}

export function parsePersonaAuditResult(rawText: string): PersonaAuditResult {
  const parsed = parseJsonObject(rawText);
  const issues = readStringArray(parsed.issues);
  const repairGuidance = readStringArray(parsed.repairGuidance);
  const severity = readSeverity(parsed.severity);
  const confidence = readConfidence(parsed.confidence);
  const missingSignals = readStringArray(parsed.missingSignals);

  if (
    typeof parsed.passes !== "boolean" ||
    issues === null ||
    repairGuidance === null ||
    severity === null ||
    confidence === null ||
    missingSignals === null
  ) {
    throw new PersonaOutputValidationError({
      code: "persona_audit_invalid",
      message:
        "persona audit output must include boolean passes, string-array issues/repairGuidance/missingSignals, severity, and confidence",
      rawOutput: rawText,
    });
  }

  return {
    passes: parsed.passes,
    issues,
    repairGuidance,
    severity,
    confidence,
    missingSignals,
  };
}
