export type ProviderTestStatus = "untested" | "success" | "failed" | "disabled" | "key_missing";
export type ProviderStatus = "active" | "disabled";
export type ModelCapability = "text_generation" | "image_generation";
export type ModelStatus = "active" | "disabled";
export type ModelTestStatus = "untested" | "success" | "failed";
export type ModelLifecycleStatus = "active" | "retired";
export type ModelErrorKind = "provider_api" | "model_retired" | "other";

export type AiProviderConfig = {
  id: string;
  providerKey: string;
  displayName: string;
  sdkPackage: string;
  status: ProviderStatus;
  testStatus: ProviderTestStatus;
  keyLast4: string | null;
  hasKey: boolean;
  lastApiErrorCode: string | null;
  lastApiErrorMessage: string | null;
  lastApiErrorAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiModelConfig = {
  id: string;
  providerId: string;
  modelKey: string;
  displayName: string;
  capability: ModelCapability;
  status: ModelStatus;
  testStatus: ModelTestStatus;
  lifecycleStatus: ModelLifecycleStatus;
  displayOrder: number;
  lastErrorKind: ModelErrorKind | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastErrorAt: string | null;
  supportsInput: boolean;
  supportsImageInputPrompt: boolean;
  supportsOutput: boolean;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

export type GlobalPolicyStudioDraft = {
  systemBaseline: string;
  globalPolicy: string;
  styleGuide: string;
  forbiddenRules: string;
};

export type AiControlPlaneDocument = {
  globalPolicyDraft: GlobalPolicyStudioDraft;
};

export type PolicyReleaseListItem = {
  version: number;
  isActive: boolean;
  createdBy: string | null;
  changeNote: string | null;
  createdAt: string;
  globalPolicyDraft: GlobalPolicyStudioDraft;
};

export type AdminControlPlaneSnapshot = {
  providers: AiProviderConfig[];
  models: AiModelConfig[];
  releases: PolicyReleaseListItem[];
  activeRelease: PolicyReleaseListItem | null;
};

export type ModelTestResult = {
  model: AiModelConfig;
  provider: AiProviderConfig;
  artifact?: {
    imageDataUrl?: string;
  };
};

export type PromptBlockStat = {
  name: string;
  tokens: number;
};

export type PreviewTokenBudget = {
  estimatedInputTokens: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  blockStats: PromptBlockStat[];
  compressedStages: Array<"memory" | "long_memory">;
  exceeded: boolean;
  message: string | null;
};

export type PreviewAuditDiagnostics = {
  status: "passed" | "passed_after_repair";
  issues: string[];
  repairGuidance: string[];
  severity: import("@/lib/ai/prompt-runtime/persona-output-audit").PersonaAuditSeverity;
  confidence: number;
  missingSignals: string[];
  repairApplied: boolean;
  auditMode: import("@/lib/ai/prompt-runtime/persona-output-audit").PersonaOutputAuditPromptMode;
  compactRetryUsed: boolean;
};

export type PreviewResult = {
  assembledPrompt: string;
  markdown: string;
  rawResponse?: string | null;
  renderOk: boolean;
  renderError: string | null;
  tokenBudget: PreviewTokenBudget;
  auditDiagnostics?: PreviewAuditDiagnostics | null;
};

export type PersonaGenerationSemanticAuditResult = {
  passes: boolean;
  issues: string[];
  repairGuidance: string[];
};

export class PersonaGenerationParseError extends Error {
  public readonly rawOutput: string;
  public readonly stageName: string | null;
  public readonly details: Record<string, unknown> | null;

  public constructor(
    message: string,
    rawOutput: string,
    options?: {
      stageName?: string | null;
      details?: Record<string, unknown> | null;
    },
  ) {
    super(message);
    this.name = "PersonaGenerationParseError";
    this.rawOutput = rawOutput;
    this.stageName = options?.stageName ?? null;
    this.details = options?.details ?? null;
  }
}

export class PersonaGenerationQualityError extends PersonaGenerationParseError {
  public readonly stageName: string;
  public readonly issues: string[];

  public constructor(input: {
    stageName: string;
    message: string;
    rawOutput: string;
    issues: string[];
    details?: Record<string, unknown> | null;
  }) {
    super(input.message, input.rawOutput, {
      stageName: input.stageName,
      details: input.details,
    });
    this.name = "PersonaGenerationQualityError";
    this.stageName = input.stageName;
    this.issues = input.issues;
  }
}

export type PromptAssistErrorCode =
  | "prompt_assist_provider_failed"
  | "prompt_assist_provider_timeout"
  | "prompt_assist_missing_reference"
  | "prompt_assist_output_too_weak"
  | "prompt_assist_truncated_output"
  | "prompt_assist_repair_output_empty"
  | "prompt_assist_final_output_empty";

export type PromptAssistAttemptStage =
  | "reference_resolution"
  | "main_rewrite"
  | "empty_output_repair"
  | "weak_output_repair"
  | "reference_name_repair"
  | "reference_presence_audit"
  | "truncated_output_repair";

export class PromptAssistError extends Error {
  public readonly code: PromptAssistErrorCode;
  public readonly details: Record<string, unknown> | null;

  public constructor(input: {
    code: PromptAssistErrorCode;
    message: string;
    details?: Record<string, unknown> | null;
  }) {
    super(input.message);
    this.name = "PromptAssistError";
    this.code = input.code;
    this.details = input.details ?? null;
  }
}

export type PersonaGenerationStructured = {
  persona: {
    display_name: string;
    bio: string;
    status: "active" | "inactive";
  };
  persona_core: Record<string, unknown>;
  reference_sources: Array<{
    name: string;
    type: string;
    contribution: string[];
  }>;
  reference_derivation: string[];
  originalization_note: string;
  persona_memories: Array<{
    memory_type: "memory" | "long_memory";
    scope: "persona" | "thread" | "task";
    memory_key: string | null;
    content: string;
    metadata: Record<string, unknown>;
    expires_in_hours: number | null;
    is_canonical: boolean;
    importance: number | null;
  }>;
};

export type PersonaProfile = {
  persona: PersonaSummary;
  personaCore: Record<string, unknown>;
  personaMemories: Array<{
    id: string;
    memoryType: "memory" | "long_memory";
    scope: "persona" | "thread" | "task";
    memoryKey: string | null;
    content: string;
    metadata: Record<string, unknown>;
    expiresAt: string | null;
    isCanonical: boolean;
    importance: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type PersonaGenerationSeedStage = {
  persona: PersonaGenerationStructured["persona"];
  identity_summary: Record<string, unknown>;
  reference_sources: PersonaGenerationStructured["reference_sources"];
  reference_derivation: string[];
  originalization_note: string;
};

export type PersonaGenerationValuesStage = {
  values: Record<string, unknown>;
  aesthetic_profile: Record<string, unknown>;
};

export type PersonaGenerationContextStage = {
  lived_context: Record<string, unknown>;
  creator_affinity: Record<string, unknown>;
};

export type PersonaGenerationInteractionStage = {
  interaction_defaults: Record<string, unknown>;
  guardrails: Record<string, unknown>;
  voice_fingerprint: Record<string, unknown>;
  task_style_matrix: Record<string, unknown>;
};

export type PersonaGenerationMemoriesStage = {
  persona_memories: PersonaGenerationStructured["persona_memories"];
};

export type PromptBoardRule = {
  title: string;
  description?: string | null;
};

export type PromptBoardContext = {
  name?: string | null;
  description?: string | null;
  rules?: PromptBoardRule[] | null;
};

export type PromptTargetOption = {
  id: string;
  label: string;
};

export type PromptTargetContext = {
  targetType?: "post" | "comment" | null;
  targetId?: string | null;
  targetAuthor?: string | null;
  targetContent?: string | null;
  threadSummary?: string | null;
  pollPostId?: string | null;
  pollQuestion?: string | null;
  pollOptions?: PromptTargetOption[] | null;
};

export type PolicyReleaseRow = {
  version: number;
  policy: unknown;
  is_active: boolean;
  created_by: string | null;
  change_note: string | null;
  created_at: string;
};

export type ProviderRow = {
  id: string;
  provider_key: string;
  display_name: string;
  sdk_package: string;
  status: ProviderStatus;
  test_status: ProviderTestStatus;
  last_api_error_code: string | null;
  last_api_error_message: string | null;
  last_api_error_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ModelRow = {
  id: string;
  provider_id: string;
  model_key: string;
  display_name: string;
  capability: ModelCapability;
  status: ModelStatus;
  test_status: ModelTestStatus;
  lifecycle_status: ModelLifecycleStatus;
  display_order: number;
  last_error_kind: ModelErrorKind | null;
  last_error_code: string | null;
  last_error_message: string | null;
  last_error_at: string | null;
  supports_input: boolean;
  supports_image_input_prompt: boolean;
  supports_output: boolean;
  context_window: number | null;
  max_output_tokens: number | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
  created_at: string;
};

export type PersonaSummary = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  status: string;
};

export type PersonaCoreRow = {
  core_profile: unknown;
};

export type PersonaMemoryRow = {
  id: string;
  key: string;
  value: string | null;
  context_data: Record<string, unknown>;
  expires_at: string | null;
  created_at: string;
};

export type PersonaLongMemoryRow = {
  id: string;
  content: string;
  importance: number;
  memory_category: string;
  updated_at: string;
};

export type PersonaMemoryStoreRow = {
  id: string;
  memory_key: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  expires_at: string | null;
  is_canonical: boolean;
  importance: number | null;
  updated_at: string;
  created_at: string;
};
