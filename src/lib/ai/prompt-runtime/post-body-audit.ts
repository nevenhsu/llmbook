import { PersonaOutputValidationError } from "@/lib/ai/prompt-runtime/persona-audit-shared";
import { parseJsonObject, readStringArray, readCheckStatus } from "./json-parse-utils";

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

export type PostBodyAuditCheckStatus = "pass" | "fail";

export type PostBodyAuditContentChecks = {
  angle_fidelity: PostBodyAuditCheckStatus;
  body_usefulness: PostBodyAuditCheckStatus;
  markdown_structure: PostBodyAuditCheckStatus;
};

export type PostBodyAuditPersonaChecks = {
  body_persona_fit: PostBodyAuditCheckStatus;
  anti_style_compliance: PostBodyAuditCheckStatus;
};

export type PostBodyAuditResult = {
  passes: boolean;
  issues: string[];
  repairGuidance: string[];
  contentChecks: PostBodyAuditContentChecks;
  personaChecks: PostBodyAuditPersonaChecks;
};

function parseAuditJsonObject(text: string): Record<string, unknown> {
  return parseJsonObject(text, (type) => {
    if (type === "empty") {
      return new PersonaOutputValidationError({
        code: "persona_audit_invalid",
        message: "post_body audit returned empty output",
        rawOutput: text,
      });
    }
    if (type === "invalid_json") {
      return new PersonaOutputValidationError({
        code: "persona_audit_invalid",
        message: "post_body audit returned invalid JSON",
        rawOutput: text,
      });
    }
    return new PersonaOutputValidationError({
      code: "persona_audit_invalid",
      message: "post_body audit output must be a JSON object",
      rawOutput: text,
    });
  });
}

function parseContentChecks(value: unknown): PostBodyAuditContentChecks | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const angle_fidelity = readCheckStatus(record.angle_fidelity);
  const body_usefulness = readCheckStatus(record.body_usefulness);
  const markdown_structure = readCheckStatus(record.markdown_structure);

  if (!angle_fidelity || !body_usefulness || !markdown_structure) {
    return null;
  }

  return {
    angle_fidelity,
    body_usefulness,
    markdown_structure,
  };
}

function parsePersonaChecks(value: unknown): PostBodyAuditPersonaChecks | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const body_persona_fit = readCheckStatus(record.body_persona_fit);
  const anti_style_compliance = readCheckStatus(record.anti_style_compliance);

  if (!body_persona_fit || !anti_style_compliance) {
    return null;
  }

  return {
    body_persona_fit,
    anti_style_compliance,
  };
}

export function buildPostBodyAuditPrompt(input: {
  selectedPostPlanText: string;
  renderedFinalPost: string;
}): string {
  return [
    "[post_body_audit]",
    "You are auditing a rendered final post before persistence.",
    "Judge content quality and persona fit.",
    "Do not rewrite the post here.",
    "",
    "Required checks:",
    "- angle_fidelity",
    "- body_usefulness",
    "- markdown_structure",
    "- body_persona_fit",
    "- anti_style_compliance",
    "",
    "Rules:",
    "- The selected title is locked and cannot be changed at this stage.",
    "- Fail angle_fidelity if the body drifts away from the selected thesis.",
    "- Fail body_usefulness if the body stays generic, empty, or structureless.",
    "- Fail body_persona_fit if the prose sounds generic instead of persona-specific.",
    "",
    input.selectedPostPlanText,
    "",
    "[rendered_final_post]",
    input.renderedFinalPost.trim(),
    "",
    "[output_constraints]",
    "Return exactly one JSON object.",
    "{",
    '  "passes": true,',
    '  "issues": ["string"],',
    '  "repairGuidance": ["string"],',
    '  "contentChecks": {',
    '    "angle_fidelity": "pass | fail",',
    '    "body_usefulness": "pass | fail",',
    '    "markdown_structure": "pass | fail"',
    "  },",
    '  "personaChecks": {',
    '    "body_persona_fit": "pass | fail",',
    '    "anti_style_compliance": "pass | fail"',
    "  }",
    "}",
  ].join("\n");
}

export function buildPostBodyRepairPrompt(input: {
  selectedPostPlanText: string;
  issues: string[];
  repairGuidance: string[];
  previousOutput: string;
}): string {
  return [
    "[post_body_repair]",
    "Repair the body-stage JSON below using the audit findings.",
    "Do not change the title.",
    "Do not change the selected topic.",
    "Return the body-stage JSON with only the fields that need fixing.",
    "",
    input.selectedPostPlanText,
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
    formatTruncatedPreviousOutput(input.previousOutput),
    "",
    "[output_constraints]",
    "Return exactly one JSON object.",
    "{",
    '  "body": "markdown string",',
    '  "tags": ["#tag"],',
    '  "need_image": false,',
    '  "image_prompt": null,',
    '  "image_alt": null',
    "}",
    "Do not output title.",
  ].join("\n");
}

export function parsePostBodyAuditResult(rawText: string): PostBodyAuditResult {
  const parsed = parseAuditJsonObject(rawText);
  const issues = readStringArray(parsed.issues);
  const repairGuidance = readStringArray(parsed.repairGuidance);
  const contentChecks = parseContentChecks(parsed.contentChecks);
  const personaChecks = parsePersonaChecks(parsed.personaChecks);

  if (
    typeof parsed.passes !== "boolean" ||
    issues === null ||
    repairGuidance === null ||
    contentChecks === null ||
    personaChecks === null
  ) {
    throw new PersonaOutputValidationError({
      code: "persona_audit_invalid",
      message:
        "post_body audit output must include boolean passes, string-array issues/repairGuidance, and valid content/persona checks",
      rawOutput: rawText,
    });
  }

  return {
    passes: parsed.passes,
    issues,
    repairGuidance,
    contentChecks,
    personaChecks,
  };
}
