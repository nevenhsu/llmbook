import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-contract";
import type { TaskCandidatePreview } from "@/lib/ai/agent/intake/intake-preview";

export type AgentLabSourceMode = "public" | "notification";

export type AgentLabSourceModeOption = {
  value: AgentLabSourceMode;
  label: string;
};

export type AgentLabPersonaGroup = {
  totalReferenceCount: number;
  batchSize: number;
  groupIndex: number;
  maxGroupIndex: number;
};

export type AgentLabOpportunityRow = {
  opportunityKey: string;
  source: "public-post" | "public-comment" | "notification";
  link: string | null;
  content: string;
  createdAt: string | null;
};

export type AgentLabSelectorRow = {
  opportunityKey: string;
  source: "public-post" | "public-comment" | "notification";
  link: string | null;
  content: string;
  reason: string | null;
  errorMessage: string | null;
};

export type AgentLabCandidateRow = {
  opportunityKey: string;
  referenceName: string;
  targetPersona: {
    id: string;
    displayName: string;
    href: string;
  };
  dispatchKind: "public" | "notification";
  reason: string;
  dedupeKey: string;
  errorMessage: string | null;
};

export type AgentLabStageStatus = "idle" | "success" | "error" | "auto-routed";

export type AgentLabSelectorStage = {
  status: Exclude<AgentLabStageStatus, "auto-routed">;
  prompt: string | null;
  inputData: unknown;
  outputData: unknown;
  rows: AgentLabSelectorRow[];
};

export type AgentLabCandidateStage = {
  status: AgentLabStageStatus;
  prompt: string | null;
  inputData: unknown;
  outputData: unknown;
  selectedReferences: Array<{
    referenceId?: string;
    referenceName: string;
    personaId?: string;
    personaDisplayName?: string;
  }>;
  rows: AgentLabCandidateRow[];
};

export type AgentLabSaveState = "idle" | "saving" | "success" | "failed";

export type AgentLabSaveResult = {
  candidateIndex: number | null;
  inserted: boolean | null;
  skipReason: string | null;
  taskId: string | null;
};

export type AgentLabTaskRow = {
  taskId: string | null;
  candidateIndex: number | null;
  opportunityKey: string;
  persona: {
    id: string;
    displayName: string;
    href: string;
  };
  taskType: "comment" | "post" | "reply";
  status: string;
  saveState: AgentLabSaveState;
  errorMessage: string | null;
  saveResult: AgentLabSaveResult | null;
  data: Record<string, unknown>;
  candidate: TaskCandidatePreview | null;
  actions: {
    canSave: boolean;
  };
};

export type AgentLabTaskStage = {
  rows: AgentLabTaskRow[];
  summary: {
    attempted: number;
    succeeded: number;
    failed: number;
  };
  toastMessage: string | null;
};

export type AgentLabModeState = {
  personaGroup: AgentLabPersonaGroup;
  opportunities: AgentLabOpportunityRow[];
  selectorStage: AgentLabSelectorStage;
  candidateStage: AgentLabCandidateStage;
  taskStage: AgentLabTaskStage;
};

export type AgentLabSaveTaskOutcome = {
  inserted: boolean;
  skipReason: string | null;
  taskId: string | null;
  errorMessage: string | null;
  status: string;
};

export type AgentLabPageProps = {
  dataSource: "mock" | "runtime";
  titleEyebrow?: string;
  title?: string;
  description?: string;
  sourceModeOptions: AgentLabSourceModeOption[];
  initialSourceMode: AgentLabSourceMode;
  models: AiModelConfig[];
  providers: AiProviderConfig[];
  initialModelId: string;
  initialModes: Record<AgentLabSourceMode, AgentLabModeState>;
  onRunSelector: (input: {
    sourceMode: AgentLabSourceMode;
    modelId: string;
  }) => Promise<AgentLabSelectorStage>;
  onRunCandidate: (input: {
    sourceMode: AgentLabSourceMode;
    modelId: string;
    selectorStage: AgentLabSelectorStage;
  }) => Promise<{
    candidateStage: AgentLabCandidateStage;
    taskRows: AgentLabTaskRow[];
  }>;
  onSaveTask: (input: {
    sourceMode: AgentLabSourceMode;
    modelId: string;
    row: AgentLabTaskRow;
    rowIndex: number;
  }) => Promise<AgentLabSaveTaskOutcome>;
};
