import type { AiModelConfig, AiProviderConfig } from "@/lib/ai/admin/control-plane-contract";
import type {
  AgentLabCandidateStage,
  AgentLabModeState,
  AgentLabOpportunityRow,
  AgentLabPersonaGroup,
  AgentLabPersonaGroupInput,
  AgentLabSaveTaskOutcome,
  AgentLabSelectorStage,
  AgentLabTaskRow,
} from "@/lib/ai/agent/intake/lab-types";

export type {
  AgentLabCandidateRow,
  AgentLabCandidateStage,
  AgentLabModeState,
  AgentLabOpportunityRow,
  AgentLabPersonaGroup,
  AgentLabPersonaGroupInput,
  AgentLabPersonaInfo,
  AgentLabSaveResult,
  AgentLabSaveState,
  AgentLabSaveTaskOutcome,
  AgentLabSelectorStage,
  AgentLabSourceMode,
  AgentLabStageStatus,
  AgentLabTaskRow,
  AgentLabTaskStage,
} from "@/lib/ai/agent/intake/lab-types";

export type AgentLabSourceModeOption = {
  value: "public" | "notification";
  label: string;
};

export type AgentLabPageProps = {
  dataSource: "mock" | "runtime";
  titleEyebrow?: string;
  title?: string;
  description?: string;
  sourceModeOptions: AgentLabSourceModeOption[];
  initialSourceMode: "public" | "notification";
  models: AiModelConfig[];
  providers: AiProviderConfig[];
  initialModelId: string;
  initialModes: Record<"public" | "notification", AgentLabModeState>;
  onRunSelector: (input: {
    sourceMode: "public" | "notification";
    modelId: string;
    personaGroup: AgentLabPersonaGroupInput;
    currentOpportunities: AgentLabOpportunityRow[];
    onProgress?: (partial: AgentLabSelectorStage) => void;
  }) => Promise<AgentLabSelectorStage>;
  onRunCandidate: (input: {
    sourceMode: "public" | "notification";
    modelId: string;
    personaGroup: AgentLabPersonaGroupInput;
    selectorStage: AgentLabSelectorStage;
    currentCandidateStage: AgentLabCandidateStage;
    currentTaskRows: AgentLabTaskRow[];
    onProgress?: (partial: {
      candidateStage: AgentLabCandidateStage;
      taskRows: AgentLabTaskRow[];
    }) => void;
  }) => Promise<{
    candidateStage: AgentLabCandidateStage;
    taskRows: AgentLabTaskRow[];
  }>;
  onSavePersonaGroup: (input: {
    sourceMode: "public" | "notification";
    modelId: string;
    personaGroup: AgentLabPersonaGroupInput;
    selectorStage: AgentLabSelectorStage;
  }) => Promise<{
    personaGroup: AgentLabPersonaGroup;
    candidateStage: AgentLabCandidateStage;
    taskRows: AgentLabTaskRow[];
  }>;
  onSaveTask: (input: {
    sourceMode: "public" | "notification";
    modelId: string;
    row: AgentLabTaskRow;
    rowIndex: number;
  }) => Promise<AgentLabSaveTaskOutcome>;
};
