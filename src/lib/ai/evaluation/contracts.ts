import type { DispatcherPolicy } from "@/agents/task-dispatcher/policy/reply-only-policy";
import type {
  DecisionReasonCode,
  PersonaProfile,
  TaskIntent,
} from "@/lib/ai/contracts/task-intents";
import type {
  RuntimeMemoryRefs,
  RuntimeMemoryContext,
  RuntimePolicyRefs,
  RuntimeThreadMemoryEntry,
} from "@/lib/ai/memory/runtime-memory-context";
import type { QueueTask } from "@/lib/ai/task-queue/task-queue";
import type { ReplySafetyContext, SafetyGateResult } from "@/lib/ai/safety/reply-safety-gate";

export type ReplayContractVersion = "replay.v1";
export type ReplayFlow = "dispatch_precheck" | "execution";

export type ReplayExpected = {
  decision?: ReplayDecision;
  reasonCodes?: string[];
  safety?: {
    shouldBlock?: boolean;
  };
  reliability?: {
    shouldSucceed?: boolean;
  };
};

export type ReplayMemorySnapshot = {
  policyRefs?: RuntimePolicyRefs;
  memoryRefs?: RuntimeMemoryRefs;
  personaLongMemory?: {
    id?: string;
    content: string;
    updatedAt?: string;
  } | null;
  threadEntries?: RuntimeThreadMemoryEntry[];
  recentReplies?: string[];
  forceReadError?: boolean;
};

export type ReplayCase = {
  id: string;
  schemaVersion: ReplayContractVersion;
  flow: ReplayFlow;
  taskType: "reply";
  personaId: string;
  threadId?: string;
  boardId?: string;
  intent: {
    id: string;
    sourceTable: TaskIntent["sourceTable"];
    sourceId: string;
    payload: Record<string, unknown>;
  };
  policyRefs: {
    policyVersion: string;
    baselineRef?: string;
    candidateRef?: string;
  };
  memorySnapshot: ReplayMemorySnapshot;
  expected?: ReplayExpected;
};

export type ReplayDataset = {
  contractVersion: ReplayContractVersion;
  datasetVersion: string;
  generatedAt: string;
  cases: ReplayCase[];
};

export type ReplayDecision =
  | "ALLOWED"
  | "BLOCKED_PRECHECK"
  | "BLOCKED_SAFETY"
  | "SUCCEEDED"
  | "SKIPPED"
  | "FAILED";

export type ReplayCaseResult = {
  caseId: string;
  variant: string;
  flow: ReplayFlow;
  decision: ReplayDecision;
  reasonCodes: string[];
  generated: {
    textPreview: string;
    textLength: number;
    empty: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
  latencyMs: number;
  reliability: {
    succeeded: boolean;
    errored: boolean;
  };
  safety: {
    blocked: boolean;
    shouldBlock?: boolean;
  };
  quality: {
    emptyOutput: boolean;
    normalizedText: string;
  };
  cost: {
    inputTokens: number;
    outputTokens: number;
    estimatedUsd: number;
  };
  expected?: ReplayExpected;
};

export type VariantAggregateMetrics = {
  safety: {
    labeledCount: number;
    interceptRate: number;
    falseInterceptRate: number;
    missRate: number;
  };
  quality: {
    repeatRate: number;
    emptyOutputRate: number;
  };
  reliability: {
    successRate: number;
    errorRate: number;
    avgLatencyMs: number;
  };
  cost: {
    totalTokens: number;
    totalEstimatedUsd: number;
  };
  score: {
    safety: number;
    quality: number;
    reliability: number;
    cost: number;
    total: number;
  };
};

export type RegressionGateRules = {
  maxMissRateIncrease?: number;
  maxFalseInterceptRateIncrease?: number;
  maxSuccessRateDrop?: number;
  maxErrorRateIncrease?: number;
  maxAvgLatencyIncreaseMs?: number;
};

export type RegressionGateFailure = {
  rule: keyof RegressionGateRules;
  baseline: number;
  candidate: number;
  delta: number;
  message: string;
};

export type RegressionGateResult = {
  passed: boolean;
  failures: RegressionGateFailure[];
  rules: Required<RegressionGateRules>;
};

export type ReplayVariant = {
  id: string;
  version: string;
  describe?: string;
  resolvePolicy?: (input: { testCase: ReplayCase }) => DispatcherPolicy;
  resolveEligibility?: (input: {
    testCase: ReplayCase;
    persona: PersonaProfile;
    postId?: string | null;
    boardId?: string | null;
    now: Date;
  }) => Promise<{ allowed: boolean; reasonCode?: DecisionReasonCode }>;
  resolveRecentReplyCount?: (input: {
    testCase: ReplayCase;
    personaId: string;
    since: Date;
  }) => Promise<number>;
  resolveLatestReplyAtOnPost?: (input: {
    testCase: ReplayCase;
    personaId: string;
    postId: string;
  }) => Promise<Date | null>;
  resolveMemoryContext?: (input: {
    testCase: ReplayCase;
    now: Date;
  }) => Promise<RuntimeMemoryContext>;
  generate?: (input: { testCase: ReplayCase; phase: ReplayFlow; task: QueueTask }) => Promise<{
    text?: string;
    parentCommentId?: string;
    skipReason?: string;
    safetyContext?: ReplySafetyContext;
  }>;
  safetyCheck?: (input: {
    testCase: ReplayCase;
    phase: ReplayFlow;
    text: string;
    context?: ReplySafetyContext;
  }) => Promise<SafetyGateResult>;
  estimateCost?: (input: { testCase: ReplayCase; generatedText: string; phase: ReplayFlow }) => {
    inputTokens: number;
    outputTokens: number;
    estimatedUsd: number;
  };
};

export type ReplayReport = {
  summary: {
    contractVersion: ReplayContractVersion;
    datasetVersion: string;
    generatedAt: string;
    caseCount: number;
    baseline: string;
    candidate: string;
  };
  baseline: {
    id: string;
    version: string;
    caseResults: ReplayCaseResult[];
    metrics: VariantAggregateMetrics;
  };
  candidate: {
    id: string;
    version: string;
    caseResults: ReplayCaseResult[];
    metrics: VariantAggregateMetrics;
  };
  diff: {
    safety: {
      missRateDelta: number;
      falseInterceptRateDelta: number;
      interceptRateDelta: number;
    };
    quality: {
      repeatRateDelta: number;
      emptyOutputRateDelta: number;
    };
    reliability: {
      successRateDelta: number;
      errorRateDelta: number;
      avgLatencyMsDelta: number;
    };
    cost: {
      totalTokensDelta: number;
      totalEstimatedUsdDelta: number;
    };
    score: {
      totalDelta: number;
    };
  };
  gate: RegressionGateResult;
};
