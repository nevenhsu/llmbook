import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import type { PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";
import type { AiAgentPersonaTaskPromptContext } from "@/lib/ai/agent/execution/persona-task-context-builder";

export type TextFlowKind = "post" | "comment" | "reply";

export type PreferredTextModel = {
  modelId: string;
  providerKey: string;
  modelKey: string;
};

export type FlowDiagnostics = {
  finalStatus: "passed" | "failed";
  terminalStage: string | null;
  attempts: Array<{
    stage: string;
    main: number;
    schemaRepair: number;
    repair: number;
    regenerate: number;
  }>;
  stageResults: Array<{
    stage: string;
    status: "passed" | "failed" | "skipped";
  }>;
  gate?: {
    attempted: boolean;
    passedCandidateIndexes: number[];
    selectedCandidateIndex: number | null;
  };
  planningCandidates?: Array<{
    candidateIndex: number;
    title: string;
    overallScore: number;
    passedHardGate: boolean;
    scores: {
      boardFit: number;
      titlePersonaFit: number;
      titleNovelty: number;
      angleNovelty: number;
      bodyUsefulness: number;
    };
  }>;
  bodyAudit?: {
    contract: "post_body_audit";
    status: "passed" | "passed_after_repair";
    repairApplied: boolean;
    issues: string[];
    contentChecks: {
      angle_fidelity: "pass" | "fail";
      board_fit: "pass" | "fail";
      body_usefulness: "pass" | "fail";
      markdown_structure: "pass" | "fail";
      title_body_alignment: "pass" | "fail";
    };
    personaChecks: {
      body_persona_fit: "pass" | "fail";
      anti_style_compliance: "pass" | "fail";
      value_fit: "pass" | "fail";
      reasoning_fit: "pass" | "fail";
      discourse_fit: "pass" | "fail";
      expression_fit: "pass" | "fail";
    };
  };
  audit?: {
    contract: "comment_audit" | "reply_audit";
    status: "passed" | "passed_after_repair";
    repairApplied: boolean;
    issues: string[];
    checks: Record<string, "pass" | "fail">;
  };
};

export type WriterMediaTail = {
  needImage: boolean;
  imagePrompt: string | null;
  imageAlt: string | null;
};

export type SelectedPostPlan = {
  title: string;
  angleSummary: string;
  thesis: string;
  bodyOutline: string[];
  differenceFromRecent: string[];
};

export type PostBodyOutput = WriterMediaTail & {
  body: string;
  tags: string[];
};

export type RenderedPost = WriterMediaTail & {
  title: string;
  body: string;
  tags: string[];
};

export type CommentOutput = WriterMediaTail & {
  markdown: string;
};

export type ReplyOutput = WriterMediaTail & {
  markdown: string;
};

export type TextFlowRunResult =
  | {
      flowKind: "post";
      parsed: {
        selectedPostPlan: SelectedPostPlan;
        postBody: PostBodyOutput;
        renderedPost: RenderedPost;
      };
      diagnostics: FlowDiagnostics;
    }
  | {
      flowKind: "comment";
      parsed: {
        comment: CommentOutput;
      };
      diagnostics: FlowDiagnostics;
    }
  | {
      flowKind: "reply";
      parsed: {
        reply: ReplyOutput;
      };
      diagnostics: FlowDiagnostics;
    };

export type TextFlowModuleRunInput = {
  task: AiAgentRecentTaskSnapshot;
  promptContext: AiAgentPersonaTaskPromptContext;
  extraInstructions?: string | null;
  loadPreferredTextModel: () => Promise<PreferredTextModel>;
  runPersonaInteraction: (input: {
    personaId: string;
    modelId: string;
    taskType: PromptActionType;
    taskContext: string;
    boardContextText?: string;
    targetContextText?: string;
  }) => Promise<PreviewResult>;
};

export type TextFlowModuleRunResult = {
  promptContext: AiAgentPersonaTaskPromptContext;
  preview: PreviewResult;
  flowResult: TextFlowRunResult;
  modelSelection: PreferredTextModel;
  modelMetadata: Record<string, unknown>;
};

export interface TextFlowModule {
  readonly flowKind: TextFlowKind;
  runPreview(input: TextFlowModuleRunInput): Promise<TextFlowModuleRunResult>;
  runRuntime(input: TextFlowModuleRunInput): Promise<TextFlowModuleRunResult>;
}

export function mergeFlowTaskContext(input: {
  promptContext: AiAgentPersonaTaskPromptContext;
  extraInstructions?: string | null;
}): AiAgentPersonaTaskPromptContext {
  const taskContext =
    input.extraInstructions && input.extraInstructions.trim().length > 0
      ? [input.promptContext.taskContext, input.extraInstructions.trim()].join("\n\n")
      : input.promptContext.taskContext;

  return {
    ...input.promptContext,
    taskContext,
  };
}

export function buildPassedSingleStageDiagnostics(stage: string): FlowDiagnostics {
  return {
    finalStatus: "passed",
    terminalStage: stage,
    attempts: [
      {
        stage,
        main: 1,
        schemaRepair: 0,
        repair: 0,
        regenerate: 0,
      },
    ],
    stageResults: [{ stage, status: "passed" }],
  };
}

export function buildModuleMetadata(input: {
  modelSelection: PreferredTextModel;
  preview: PreviewResult;
  task: AiAgentRecentTaskSnapshot;
  flowKind: TextFlowKind;
}): Record<string, unknown> {
  return {
    schema_version: 1,
    model_id: input.modelSelection.modelId,
    provider_key: input.modelSelection.providerKey,
    model_key: input.modelSelection.modelKey,
    audit_status: input.preview.auditDiagnostics?.status ?? null,
    repair_applied: input.preview.auditDiagnostics?.repairApplied ?? false,
    task_type: input.task.taskType,
    dispatch_kind: input.task.dispatchKind,
    flow_kind: input.flowKind,
  };
}
