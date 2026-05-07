export type PersonaOutputValidationErrorCode =
  | "schema_validation_failed"
  | "persona_audit_invalid"
  | "persona_repair_failed"
  | "persona_repair_invalid";

export type PersonaAuditSeverity = "low" | "medium" | "high";

export type PersonaAuditResult = {
  passes: boolean;
  issues: string[];
  repairGuidance: string[];
  severity: PersonaAuditSeverity;
  confidence: number;
  missingSignals: string[];
};

export type PersonaOutputAuditPromptMode = "default" | "compact";

export type PromptPersonaEvidence = {
  displayName: string | null;
  identity: string | null;
  referenceSourceNames: string[];
  doctrine: {
    valueFit: string[];
    reasoningFit: string[];
    discourseFit: string[];
    expressionFit: string[];
  };
};

export function formatPersonaEvidenceForAudit(input: PromptPersonaEvidence): string {
  const lines = [
    input.displayName ? `display_name: ${input.displayName}` : null,
    "identity_summary:",
    ...(input.identity ? [`- ${input.identity}`] : ["- No identity summary available."]),
    "reference_sources:",
    ...(input.referenceSourceNames.length > 0
      ? input.referenceSourceNames.map((item: string) => `- ${item}`)
      : ["- No reference sources available."]),
    "value_fit:",
    ...(input.doctrine.valueFit.length > 0
      ? input.doctrine.valueFit.map((item: string) => `- ${item}`)
      : ["- No value-fit doctrine available."]),
    "reasoning_fit:",
    ...(input.doctrine.reasoningFit.length > 0
      ? input.doctrine.reasoningFit.map((item: string) => `- ${item}`)
      : ["- No reasoning-fit doctrine available."]),
    "discourse_fit:",
    ...(input.doctrine.discourseFit.length > 0
      ? input.doctrine.discourseFit.map((item: string) => `- ${item}`)
      : ["- No discourse-fit doctrine available."]),
    "expression_fit:",
    ...(input.doctrine.expressionFit.length > 0
      ? input.doctrine.expressionFit.map((item: string) => `- ${item}`)
      : ["- No expression-fit doctrine available."]),
  ].filter((item): item is string => Boolean(item));

  return lines.join("\n");
}

export function isRetryablePersonaAuditParseFailure(error: unknown): boolean {
  return error instanceof PersonaOutputValidationError && error.code === "persona_audit_invalid";
}

export class PersonaOutputValidationError extends Error {
  public readonly code: PersonaOutputValidationErrorCode;
  public readonly issues: string[];
  public readonly repairGuidance: string[];
  public readonly rawOutput: string | null;
  public readonly severity: PersonaAuditSeverity | null;
  public readonly confidence: number | null;
  public readonly missingSignals: string[];

  public constructor(input: {
    code: PersonaOutputValidationErrorCode;
    message: string;
    issues?: string[];
    repairGuidance?: string[];
    rawOutput?: string | null;
    severity?: PersonaAuditSeverity | null;
    confidence?: number | null;
    missingSignals?: string[];
  }) {
    super(input.message);
    this.name = "PersonaOutputValidationError";
    this.code = input.code;
    this.issues = input.issues ?? [];
    this.repairGuidance = input.repairGuidance ?? [];
    this.rawOutput = input.rawOutput ?? null;
    this.severity = input.severity ?? null;
    this.confidence =
      typeof input.confidence === "number" && Number.isFinite(input.confidence)
        ? input.confidence
        : null;
    this.missingSignals = input.missingSignals ?? [];
  }
}

export type PromptPersonaDirectives = {
  voiceContract: string[];
  antiStyleRules: string[];
  enactmentRules: string[];
  inCharacterExamples: Array<{
    scenario: string;
    response: string;
  }>;
  referenceRoleGuidance: string[];
};
