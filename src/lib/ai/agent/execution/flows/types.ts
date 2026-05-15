import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { StageDebugRecord } from "@/lib/ai/stage-debug-records";
import type { TaskSnapshot } from "@/lib/ai/agent/read-models/task-snapshot";
import type { PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";
import type { AiAgentPersonaTaskPromptContext } from "@/lib/ai/agent/execution/persona-task-context-builder";
import type { PromptPersonaEvidence } from "@/lib/ai/prompt-runtime/persona-audit-shared";
import type { PostFrame } from "@/lib/ai/prompt-runtime/persona-v2-flow-contracts";
import type { ContentMode } from "@/lib/ai/core/persona-core-v2";

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

export type TextFlowExecutionErrorCauseCategory =
  | "transport"
  | "empty_output"
  | "schema_validation"
  | "deterministic_gate"
  | "render_validation";

export class TextFlowExecutionError extends Error {
  public readonly flowKind: TextFlowKind;
  public readonly diagnostics: FlowDiagnostics;
  public readonly causeCategory: TextFlowExecutionErrorCauseCategory;
  public readonly stageDebugRecords?: StageDebugRecord[];

  public constructor(input: {
    message: string;
    flowKind: TextFlowKind;
    diagnostics: FlowDiagnostics;
    causeCategory: TextFlowExecutionErrorCauseCategory;
    cause?: unknown;
    stageDebugRecords?: StageDebugRecord[];
  }) {
    super(input.message);
    this.name = "TextFlowExecutionError";
    this.flowKind = input.flowKind;
    this.diagnostics = input.diagnostics;
    this.causeCategory = input.causeCategory;
    this.stageDebugRecords = input.stageDebugRecords;
    if (input.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = input.cause;
    }
  }
}

export type TextFlowFailureSummary = {
  flowKind: TextFlowKind;
  causeCategory: TextFlowExecutionErrorCauseCategory;
  terminalStage: string | null;
};

export function isTextFlowExecutionError(error: unknown): error is TextFlowExecutionError {
  return error instanceof TextFlowExecutionError;
}

export function buildTextFlowFailureSummary(error: TextFlowExecutionError): TextFlowFailureSummary {
  return {
    flowKind: error.flowKind,
    causeCategory: error.causeCategory,
    terminalStage: error.diagnostics.terminalStage,
  };
}

export function appendTextFlowFailureSuffix(error: Error): string {
  if (!isTextFlowExecutionError(error)) {
    return error.message;
  }
  return `${error.message} flow_failure=${JSON.stringify(buildTextFlowFailureSummary(error))}`;
}

export function parseTextFlowFailureSummary(
  errorMessage: string | null | undefined,
): TextFlowFailureSummary | null {
  if (!errorMessage) {
    return null;
  }
  const match = errorMessage.match(/(?:^|\s)flow_failure=(\{.*\})\s*$/u);
  if (!match?.[1]) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[1]) as Partial<TextFlowFailureSummary>;
    if (
      (parsed.flowKind === "post" ||
        parsed.flowKind === "comment" ||
        parsed.flowKind === "reply") &&
      typeof parsed.terminalStage !== "undefined" &&
      [
        "transport",
        "empty_output",
        "schema_validation",
        "deterministic_gate",
        "render_validation",
      ].includes(String(parsed.causeCategory))
    ) {
      return {
        flowKind: parsed.flowKind,
        causeCategory: parsed.causeCategory as TextFlowExecutionErrorCauseCategory,
        terminalStage:
          typeof parsed.terminalStage === "string" || parsed.terminalStage === null
            ? parsed.terminalStage
            : null,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export type WriterMediaTail = {
  needImage: boolean;
  imagePrompt: string | null;
  imageAlt: string | null;
};

export type SelectedPostPlan = {
  title: string;
  idea: string;
  outline: string[];
};

export type PostBodyOutput = WriterMediaTail & {
  body: string;
  tags: string[];
  metadata?: { probability: number };
};

export type RenderedPost = WriterMediaTail & {
  title: string;
  body: string;
  tags: string[];
  metadata?: { probability: number };
};

export type CommentOutput = WriterMediaTail & {
  markdown: string;
  metadata?: { probability: number };
};

export type ReplyOutput = WriterMediaTail & {
  markdown: string;
  metadata?: { probability: number };
};

export type TextFlowRunResult =
  | {
      flowKind: "post";
      parsed: {
        selectedPostPlan: SelectedPostPlan;
        postFrame?: PostFrame;
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
  task: TaskSnapshot;
  promptContext: AiAgentPersonaTaskPromptContext;
  extraInstructions?: string | null;
  loadPreferredTextModel: () => Promise<PreferredTextModel>;
  runPersonaInteractionStage: (input: {
    personaId: string;
    modelId: string;
    taskType: PromptActionType;
    stagePurpose: "main";
    taskContext: string;
    boardContextText?: string;
    targetContextText?: string;
    debug?: boolean;
    attemptLabel?: string;
    executionMode?: "admin_preview" | "runtime";
    contentMode?: ContentMode;
  }) => Promise<PreviewResult>;
  personaEvidence: PromptPersonaEvidence;
  debug?: boolean;
};

export type TextFlowModuleRunResult = {
  promptContext: AiAgentPersonaTaskPromptContext;
  preview: PreviewResult;
  flowResult: TextFlowRunResult;
  modelSelection: PreferredTextModel;
  modelMetadata: Record<string, unknown>;
  stageDebugRecords?: StageDebugRecord[];
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

export function buildFallbackPersonaEvidence(input: {
  personaDisplayName: string | null;
  personaUsername: string | null;
}): PromptPersonaEvidence {
  return {
    displayName: input.personaDisplayName,
    identity: input.personaUsername,
    referenceSourceNames: [],
    doctrine: {
      valueFit: [],
      reasoningFit: [],
      discourseFit: [],
      expressionFit: [],
    },
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
        regenerate: 0,
      },
    ],
    stageResults: [{ stage, status: "passed" }],
  };
}

export function buildModuleMetadata(input: {
  modelSelection: PreferredTextModel;
  preview: PreviewResult;
  task: TaskSnapshot;
  flowKind: TextFlowKind;
}): Record<string, unknown> {
  return {
    schema_version: 1,
    model_id: input.modelSelection.modelId,
    provider_key: input.modelSelection.providerKey,
    model_key: input.modelSelection.modelKey,
    task_type: input.task.taskType,
    dispatch_kind: input.task.dispatchKind,
    flow_kind: input.flowKind,
  };
}
