export type ProviderTestStatus = "untested" | "success" | "failed" | "disabled" | "key_missing";
export type ProviderStatus = "active" | "disabled";
export type ModelCapability = "text_generation" | "image_generation";
export type ModelStatus = "active" | "disabled";
export type ModelTestStatus = "untested" | "success" | "failed";
export type ModelLifecycleStatus = "active" | "retired";
export type ModelErrorKind = "provider_api" | "model_retired" | "other";

import type { StageDebugRecord } from "@/lib/ai/stage-debug-records";

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
    text?: string;
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
  status: "passed" | "passed_after_repair" | "failed";
  issues: string[];
};

export type PreviewFlowDiagnostics = {
  finalStatus: "passed" | "failed";
  terminalStage: string | null;
  attempts: Array<{
    stage: string;
    main: number;
    regenerate: number;
  }>;
  stageResults: Array<{
    stage: string;
    status: "passed" | "failed" | "skipped";
  }>;
  gate?: {
    attempted: boolean;
    selectedCandidateIndex: number | null;
  };
  planningCandidates?: Array<{
    candidateIndex: number;
    title: string;
    overallScore: number;
    passedHardGate: boolean;
    scores: {
      personaFit: number;
      novelty: number;
    };
  }>;
};

export type PreviewResult = {
  markdown: string;
  rawResponse?: string | null;
  renderOk: boolean;
  renderError: string | null;
  tokenBudget: PreviewTokenBudget;
  stageDebugRecords?: StageDebugRecord[] | null;
  object?: unknown;
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
  other_reference_sources: Array<{
    name: string;
    type: string;
    contribution: string[];
  }>;
  reference_derivation: string[];
  originalization_note: string;
};

export type PersonaProfile = {
  persona: PersonaSummary;
  personaCore: Record<string, unknown>;
  personaMemories: Array<{
    id: string;
    memoryType: "memory" | "long_memory";
    scope: "persona" | "board" | "thread";
    content: string;
    metadata: Record<string, unknown>;
    expiresAt: string | null;
    importance: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type PersonaGenerationSeedStage = {
  persona: PersonaGenerationStructured["persona"];
  identity_summary: Record<string, unknown>;
  reference_sources: PersonaGenerationStructured["reference_sources"];
  other_reference_sources: PersonaGenerationStructured["other_reference_sources"];
  reference_derivation: string[];
  originalization_note: string;
};

export type PersonaGenerationCoreStage = {
  values: Record<string, unknown>;
  aesthetic_profile: Record<string, unknown>;
  lived_context: Record<string, unknown>;
  creator_affinity: Record<string, unknown>;
  interaction_defaults: Record<string, unknown>;
  guardrails: Record<string, unknown>;
  voice_fingerprint: Record<string, unknown>;
  task_style_matrix: Record<string, unknown>;
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
  targetType?: "post" | "comment" | "reply" | null;
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
  avatar_url: string | null;
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
  scope: "persona" | "board" | "thread";
  content: string;
  metadata: Record<string, unknown> | null;
  expires_at: string | null;
  importance: number | null;
  updated_at: string;
  created_at: string;
};
