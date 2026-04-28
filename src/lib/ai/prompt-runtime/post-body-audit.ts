import { PersonaOutputValidationError } from "@/lib/ai/prompt-runtime/persona-output-audit";
import {
  formatPersonaEvidenceForAudit,
  type PromptPersonaEvidence,
} from "@/lib/ai/prompt-runtime/persona-prompt-directives";
import { parseJsonObject, readStringArray, readCheckStatus } from "./json-parse-utils";

export type PostBodyAuditCheckStatus = "pass" | "fail";

export type PostBodyAuditContentChecks = {
  angle_fidelity: PostBodyAuditCheckStatus;
  board_fit: PostBodyAuditCheckStatus;
  body_usefulness: PostBodyAuditCheckStatus;
  markdown_structure: PostBodyAuditCheckStatus;
  title_body_alignment: PostBodyAuditCheckStatus;
};

export type PostBodyAuditPersonaChecks = {
  body_persona_fit: PostBodyAuditCheckStatus;
  anti_style_compliance: PostBodyAuditCheckStatus;
  value_fit: PostBodyAuditCheckStatus;
  reasoning_fit: PostBodyAuditCheckStatus;
  discourse_fit: PostBodyAuditCheckStatus;
  expression_fit: PostBodyAuditCheckStatus;
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
  const board_fit = readCheckStatus(record.board_fit);
  const body_usefulness = readCheckStatus(record.body_usefulness);
  const markdown_structure = readCheckStatus(record.markdown_structure);
  const title_body_alignment = readCheckStatus(record.title_body_alignment);

  if (
    !angle_fidelity ||
    !board_fit ||
    !body_usefulness ||
    !markdown_structure ||
    !title_body_alignment
  ) {
    return null;
  }

  return {
    angle_fidelity,
    board_fit,
    body_usefulness,
    markdown_structure,
    title_body_alignment,
  };
}

function parsePersonaChecks(value: unknown): PostBodyAuditPersonaChecks | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const body_persona_fit = readCheckStatus(record.body_persona_fit);
  const anti_style_compliance = readCheckStatus(record.anti_style_compliance);
  const value_fit = readCheckStatus(record.value_fit);
  const reasoning_fit = readCheckStatus(record.reasoning_fit);
  const discourse_fit = readCheckStatus(record.discourse_fit);
  const expression_fit = readCheckStatus(record.expression_fit);

  if (
    !body_persona_fit ||
    !anti_style_compliance ||
    !value_fit ||
    !reasoning_fit ||
    !discourse_fit ||
    !expression_fit
  ) {
    return null;
  }

  return {
    body_persona_fit,
    anti_style_compliance,
    value_fit,
    reasoning_fit,
    discourse_fit,
    expression_fit,
  };
}

export function buildPostBodyAuditPrompt(input: {
  boardContextText?: string | null;
  selectedPostPlanText: string;
  renderedFinalPost: string;
  personaEvidence: PromptPersonaEvidence;
}): string {
  return [
    "[post_body_audit]",
    "You are auditing a rendered final post before persistence.",
    "You are reviewing a compact app-owned review packet, not the full generation prompt.",
    "Judge both content quality and persona fit.",
    "Do not rewrite the post here.",
    "",
    "Required checks:",
    "- angle_fidelity",
    "- board_fit",
    "- body_usefulness",
    "- markdown_structure",
    "- title_body_alignment",
    "- body_persona_fit",
    "- anti_style_compliance",
    "- value_fit",
    "- reasoning_fit",
    "- discourse_fit",
    "- expression_fit",
    "",
    "Rules:",
    "- The selected title is locked and cannot be changed at this stage.",
    "- Fail angle_fidelity if the body drifts away from the selected thesis.",
    "- Fail body_usefulness if the body stays generic, empty, or structureless.",
    "- Fail body_persona_fit if the prose sounds generic instead of persona-specific.",
    "- Do not complain that unrelated generation background is absent; judge only the checks supported by this packet.",
    "",
    "[persona_evidence]",
    formatPersonaEvidenceForAudit(input.personaEvidence),
    "",
    input.boardContextText ? ["[board]", input.boardContextText].join("\n") : "",
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
    '    "board_fit": "pass | fail",',
    '    "body_usefulness": "pass | fail",',
    '    "markdown_structure": "pass | fail",',
    '    "title_body_alignment": "pass | fail"',
    "  },",
    '  "personaChecks": {',
    '    "body_persona_fit": "pass | fail",',
    '    "anti_style_compliance": "pass | fail",',
    '    "value_fit": "pass | fail",',
    '    "reasoning_fit": "pass | fail",',
    '    "discourse_fit": "pass | fail",',
    '    "expression_fit": "pass | fail"',
    "  }",
    "}",
  ]
    .filter((item) => item.length > 0)
    .join("\n");
}

export function buildPostBodyRepairPrompt(input: {
  selectedPostPlanText: string;
  personaEvidence: PromptPersonaEvidence;
  issues: string[];
  repairGuidance: string[];
  previousOutput: string;
}): string {
  return [
    "[post_body_repair]",
    "Repair the body-stage JSON below using the audit findings.",
    "You are receiving a fuller rewrite packet than the audit saw.",
    "Do not change the title.",
    "Do not change the selected topic.",
    "Return the same body-stage schema only.",
    "",
    "[persona_evidence]",
    formatPersonaEvidenceForAudit(input.personaEvidence),
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
    input.previousOutput.trim(),
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
