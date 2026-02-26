import { loadDispatcherPolicy } from "@/agents/task-dispatcher/policy/reply-only-policy";
import { createReplyDispatchPrecheck } from "@/agents/task-dispatcher/precheck/reply-dispatch-precheck";
import {
  InMemoryIdempotencyStore,
  ReplyExecutionAgent,
  type ReplyGenerator,
} from "@/agents/phase-1-reply-vote/orchestrator/reply-execution-agent";
import { ExecutionSkipReasonCode, SafetyReasonCode } from "@/lib/ai/reason-codes";
import { evaluateRegressionGate } from "@/lib/ai/evaluation/gate";
import { computeEvaluationMetrics } from "@/lib/ai/evaluation/metrics";
import type {
  RegressionGateRules,
  ReplayCase,
  ReplayCaseResult,
  ReplayDataset,
  ReplayDecision,
  ReplayFlow,
  ReplayReport,
  ReplayVariant,
} from "@/lib/ai/evaluation/contracts";
import type { TaskIntent } from "@/lib/ai/contracts/task-intents";
import type { RuntimeMemoryContext } from "@/lib/ai/memory/runtime-memory-context";
import { InMemorySafetyEventSink } from "@/lib/ai/observability/safety-events";
import { InMemoryTaskEventSink } from "@/lib/ai/observability/task-events";
import { InMemoryTaskQueueStore, TaskQueue, type QueueTask } from "@/lib/ai/task-queue/task-queue";
import { RuleBasedReplySafetyGate } from "@/lib/ai/safety/reply-safety-gate";

function normalizeQualityText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function defaultGeneratedSummary(text?: string): ReplayCaseResult["generated"] {
  const normalized = (text ?? "").trim();
  return {
    textPreview: normalized.slice(0, 120),
    textLength: normalized.length,
    empty: normalized.length === 0,
  };
}

function defaultCostEstimate(input: { generatedText: string }) {
  const outputTokens = Math.max(0, Math.ceil(input.generatedText.length / 4));
  const inputTokens = 32;
  const estimatedUsd = (inputTokens + outputTokens) * 0.000002;
  return { inputTokens, outputTokens, estimatedUsd };
}

function resolveSafetyBlocked(decision: ReplayDecision, reasonCodes: string[]): boolean {
  if (decision === "BLOCKED_SAFETY") {
    return true;
  }
  return reasonCodes.some((reason) => reason.startsWith("SAFETY_") || reason.includes("_SAFETY_"));
}

function buildIntentFromCase(testCase: ReplayCase): TaskIntent {
  return {
    id: testCase.intent.id,
    type: "reply",
    sourceTable: testCase.intent.sourceTable,
    sourceId: testCase.intent.sourceId,
    createdAt: new Date().toISOString(),
    payload: {
      ...testCase.intent.payload,
      threadId: testCase.threadId ?? testCase.intent.payload.threadId,
      boardId: testCase.boardId ?? testCase.intent.payload.boardId,
    },
  };
}

async function resolveMemoryContext(input: {
  testCase: ReplayCase;
  variant: ReplayVariant;
  now: Date;
}): Promise<RuntimeMemoryContext> {
  if (input.variant.resolveMemoryContext) {
    return input.variant.resolveMemoryContext({ testCase: input.testCase, now: input.now });
  }

  if (input.testCase.memorySnapshot.forceReadError) {
    throw new Error("MEMORY_READ_FAILED");
  }

  return {
    policyRefs: input.testCase.memorySnapshot.policyRefs ?? {
      policyVersion: null,
    },
    memoryRefs: input.testCase.memorySnapshot.memoryRefs ?? {
      communityMemoryVersion: null,
      safetyMemoryVersion: null,
    },
    personaLongMemory: input.testCase.memorySnapshot.personaLongMemory
      ? {
          id: input.testCase.memorySnapshot.personaLongMemory.id ?? "memory-long-1",
          content: input.testCase.memorySnapshot.personaLongMemory.content,
          updatedAt:
            input.testCase.memorySnapshot.personaLongMemory.updatedAt ?? input.now.toISOString(),
        }
      : null,
    threadShortMemory: {
      threadId: input.testCase.threadId ?? null,
      boardId: input.testCase.boardId ?? null,
      taskType: "reply",
      ttlSeconds: input.testCase.memorySnapshot.threadEntries?.[0]?.ttlSeconds ?? 3600,
      maxItems: input.testCase.memorySnapshot.threadEntries?.[0]?.maxItems ?? 20,
      entries: input.testCase.memorySnapshot.threadEntries ?? [],
    },
  };
}

async function runPrecheckCase(input: {
  testCase: ReplayCase;
  variant: ReplayVariant;
  now: Date;
}): Promise<ReplayCaseResult> {
  const startedAt = Date.now();
  let generatedText = "";
  const fallbackReasonCodes: string[] = [];
  const observedSafetyReasonCodes: string[] = [];

  try {
    const policy =
      input.variant.resolvePolicy?.({ testCase: input.testCase }) ?? loadDispatcherPolicy();
    const persona = { id: input.testCase.personaId, status: "active" as const };
    const intent = buildIntentFromCase(input.testCase);

    const precheck = createReplyDispatchPrecheck({
      policy,
      deps: {
        checkEligibility: async ({ personaId, postId, boardId, now }) =>
          input.variant.resolveEligibility?.({
            testCase: input.testCase,
            persona,
            postId,
            boardId,
            now,
          }) ?? { allowed: true },
        countRecentReplies: async ({ personaId, since }) =>
          input.variant.resolveRecentReplyCount?.({
            testCase: input.testCase,
            personaId,
            since,
          }) ?? 0,
        getLatestReplyAtOnPost: async ({ personaId, postId }) =>
          input.variant.resolveLatestReplyAtOnPost?.({
            testCase: input.testCase,
            personaId,
            postId,
          }) ?? null,
        buildRuntimeMemoryContext: async ({ now }) =>
          resolveMemoryContext({ testCase: input.testCase, variant: input.variant, now }),
        generateDraft: async (task) => {
          const generated = (await input.variant.generate?.({
            testCase: input.testCase,
            phase: "dispatch_precheck",
            task,
          })) ?? {
            text:
              typeof input.testCase.intent.payload.draftText === "string"
                ? String(input.testCase.intent.payload.draftText)
                : "",
            safetyContext: {
              recentPersonaReplies: input.testCase.memorySnapshot.recentReplies ?? [],
            },
          };
          generatedText = generated.text ?? "";
          return generated;
        },
        runSafetyCheck: async ({ text, context }) =>
          input.variant.safetyCheck?.({
            testCase: input.testCase,
            phase: "dispatch_precheck",
            text,
            context,
          }) ?? new RuleBasedReplySafetyGate().check({ text, context }),
        recordSafetyEvent: async ({ reasonCode }) => {
          observedSafetyReasonCodes.push(reasonCode);
        },
        recordMemoryFallback: async ({ reasonCode }) => {
          fallbackReasonCodes.push(reasonCode);
        },
      },
    });

    const precheckResult = await precheck({
      intent,
      persona,
      now: input.now,
    });

    const reasonCodes = Array.from(
      new Set([...precheckResult.reasons, ...fallbackReasonCodes, ...observedSafetyReasonCodes]),
    );
    const decision: ReplayDecision = precheckResult.allowed ? "ALLOWED" : "BLOCKED_PRECHECK";
    const latencyMs = Date.now() - startedAt;
    const generated = defaultGeneratedSummary(generatedText);
    const cost =
      input.variant.estimateCost?.({
        testCase: input.testCase,
        generatedText,
        phase: "dispatch_precheck",
      }) ?? defaultCostEstimate({ generatedText });
    const safetyBlocked = resolveSafetyBlocked(decision, reasonCodes);

    return {
      caseId: input.testCase.id,
      variant: input.variant.id,
      flow: "dispatch_precheck",
      decision,
      reasonCodes,
      generated,
      latencyMs,
      reliability: {
        succeeded: true,
        errored: false,
      },
      safety: {
        blocked: safetyBlocked,
        shouldBlock: input.testCase.expected?.safety?.shouldBlock,
      },
      quality: {
        emptyOutput: generated.empty,
        normalizedText: normalizeQualityText(generatedText),
      },
      cost,
      expected: input.testCase.expected,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    return {
      caseId: input.testCase.id,
      variant: input.variant.id,
      flow: "dispatch_precheck",
      decision: "FAILED",
      reasonCodes: ["EVAL_PRECHECK_ERROR"],
      generated: defaultGeneratedSummary(generatedText),
      latencyMs,
      error: {
        code: "EVAL_PRECHECK_ERROR",
        message,
      },
      reliability: {
        succeeded: false,
        errored: true,
      },
      safety: {
        blocked: false,
        shouldBlock: input.testCase.expected?.safety?.shouldBlock,
      },
      quality: {
        emptyOutput: generatedText.trim().length === 0,
        normalizedText: normalizeQualityText(generatedText),
      },
      cost: defaultCostEstimate({ generatedText }),
      expected: input.testCase.expected,
    };
  }
}

async function runExecutionCase(input: {
  testCase: ReplayCase;
  variant: ReplayVariant;
  now: Date;
}): Promise<ReplayCaseResult> {
  const startedAt = Date.now();
  let generatedText = "";
  let generatedSkipReason = "";

  try {
    const queueStore = new InMemoryTaskQueueStore();
    const queueEvents = new InMemoryTaskEventSink();
    const safetyEvents = new InMemorySafetyEventSink();
    const queue = new TaskQueue({
      store: queueStore,
      eventSink: queueEvents,
      leaseMs: 30_000,
    });

    const task: QueueTask = {
      id: `eval-task:${input.testCase.id}`,
      personaId: input.testCase.personaId,
      taskType: "reply",
      payload: {
        ...input.testCase.intent.payload,
        threadId: input.testCase.threadId,
        boardId: input.testCase.boardId,
      },
      status: "PENDING",
      scheduledAt: new Date(input.now),
      retryCount: 0,
      maxRetries: 1,
      createdAt: new Date(input.now),
    };
    queueStore.upsert(task);

    const generator: ReplyGenerator = {
      generate: async (queueTask) => {
        const generated = (await input.variant.generate?.({
          testCase: input.testCase,
          phase: "execution",
          task: queueTask,
        })) ?? {
          text:
            typeof input.testCase.intent.payload.draftText === "string"
              ? String(input.testCase.intent.payload.draftText)
              : "",
          safetyContext: {
            recentPersonaReplies: input.testCase.memorySnapshot.recentReplies ?? [],
          },
        };
        generatedText = generated.text ?? "";
        generatedSkipReason = generated.skipReason ?? "";
        return generated;
      },
    };

    const policy =
      input.variant.resolvePolicy?.({ testCase: input.testCase }) ?? loadDispatcherPolicy();
    const safetyGate = {
      check: async (safetyInput: { text: string; context?: { recentPersonaReplies: string[] } }) =>
        input.variant.safetyCheck?.({
          testCase: input.testCase,
          phase: "execution",
          text: safetyInput.text,
          context: safetyInput.context,
        }) ?? new RuleBasedReplySafetyGate().check(safetyInput),
    };

    const writer = {
      write: async () => ({ resultId: `result:${input.testCase.id}` }),
    };

    const agent = new ReplyExecutionAgent({
      queue,
      idempotency: new InMemoryIdempotencyStore(),
      generator,
      safetyGate,
      writer,
      safetyEventSink: safetyEvents,
      policyProvider: {
        getReplyPolicy: async () => policy,
      },
    });

    await agent.runOnce({
      workerId: `eval:${input.variant.id}`,
      now: input.now,
    });

    const finalTask = queueStore.getById(task.id);
    const reasonCodes: string[] = [];
    if (finalTask?.errorMessage) {
      reasonCodes.push(finalTask.errorMessage);
    }
    for (const event of safetyEvents.events) {
      reasonCodes.push(event.reasonCode);
    }
    if (generatedSkipReason) {
      reasonCodes.push(generatedSkipReason);
    }

    let decision: ReplayDecision = "FAILED";
    let error: ReplayCaseResult["error"] | undefined;
    if (!finalTask) {
      decision = "FAILED";
      error = { code: "EVAL_TASK_MISSING", message: "execution task missing from queue store" };
    } else if (finalTask.status === "DONE") {
      decision = "SUCCEEDED";
    } else if (finalTask.status === "SKIPPED" || finalTask.status === "IN_REVIEW") {
      if (
        reasonCodes.some(
          (code) =>
            code.startsWith("SAFETY_") ||
            code === ExecutionSkipReasonCode.safetyBlocked ||
            code === SafetyReasonCode.similarToRecentReply,
        )
      ) {
        decision = "BLOCKED_SAFETY";
      } else {
        decision = "SKIPPED";
      }
    } else if (finalTask.status === "FAILED") {
      decision = "FAILED";
      error = {
        code: "EXECUTION_FAILED",
        message: finalTask.errorMessage ?? "execution failed",
      };
    }

    const uniqueReasonCodes = Array.from(new Set(reasonCodes));
    const latencyMs = Date.now() - startedAt;
    const generated = defaultGeneratedSummary(generatedText);
    const cost =
      input.variant.estimateCost?.({
        testCase: input.testCase,
        generatedText,
        phase: "execution",
      }) ?? defaultCostEstimate({ generatedText });

    return {
      caseId: input.testCase.id,
      variant: input.variant.id,
      flow: "execution",
      decision,
      reasonCodes: uniqueReasonCodes,
      generated,
      error,
      latencyMs,
      reliability: {
        succeeded: decision === "SUCCEEDED",
        errored: decision === "FAILED",
      },
      safety: {
        blocked: resolveSafetyBlocked(decision, uniqueReasonCodes),
        shouldBlock: input.testCase.expected?.safety?.shouldBlock,
      },
      quality: {
        emptyOutput: generated.empty,
        normalizedText: normalizeQualityText(generatedText),
      },
      cost,
      expected: input.testCase.expected,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    return {
      caseId: input.testCase.id,
      variant: input.variant.id,
      flow: "execution",
      decision: "FAILED",
      reasonCodes: ["EVAL_EXECUTION_ERROR"],
      generated: defaultGeneratedSummary(generatedText),
      error: {
        code: "EVAL_EXECUTION_ERROR",
        message,
      },
      latencyMs,
      reliability: {
        succeeded: false,
        errored: true,
      },
      safety: {
        blocked: false,
        shouldBlock: input.testCase.expected?.safety?.shouldBlock,
      },
      quality: {
        emptyOutput: generatedText.trim().length === 0,
        normalizedText: normalizeQualityText(generatedText),
      },
      cost: defaultCostEstimate({ generatedText }),
      expected: input.testCase.expected,
    };
  }
}

async function runCase(input: {
  testCase: ReplayCase;
  variant: ReplayVariant;
  now: Date;
}): Promise<ReplayCaseResult> {
  if (input.testCase.flow === "dispatch_precheck") {
    return runPrecheckCase(input);
  }
  return runExecutionCase(input);
}

async function runVariant(input: {
  dataset: ReplayDataset;
  variant: ReplayVariant;
  now: Date;
}): Promise<{ caseResults: ReplayCaseResult[] }> {
  const caseResults: ReplayCaseResult[] = [];
  for (const testCase of input.dataset.cases) {
    caseResults.push(
      await runCase({
        testCase,
        variant: input.variant,
        now: input.now,
      }),
    );
  }
  return { caseResults };
}

function diffByMetric(input: {
  baseline: ReturnType<typeof computeEvaluationMetrics>;
  candidate: ReturnType<typeof computeEvaluationMetrics>;
}): ReplayReport["diff"] {
  return {
    safety: {
      missRateDelta: input.candidate.safety.missRate - input.baseline.safety.missRate,
      falseInterceptRateDelta:
        input.candidate.safety.falseInterceptRate - input.baseline.safety.falseInterceptRate,
      interceptRateDelta:
        input.candidate.safety.interceptRate - input.baseline.safety.interceptRate,
    },
    quality: {
      repeatRateDelta: input.candidate.quality.repeatRate - input.baseline.quality.repeatRate,
      emptyOutputRateDelta:
        input.candidate.quality.emptyOutputRate - input.baseline.quality.emptyOutputRate,
    },
    reliability: {
      successRateDelta:
        input.candidate.reliability.successRate - input.baseline.reliability.successRate,
      errorRateDelta: input.candidate.reliability.errorRate - input.baseline.reliability.errorRate,
      avgLatencyMsDelta:
        input.candidate.reliability.avgLatencyMs - input.baseline.reliability.avgLatencyMs,
    },
    cost: {
      totalTokensDelta: input.candidate.cost.totalTokens - input.baseline.cost.totalTokens,
      totalEstimatedUsdDelta:
        input.candidate.cost.totalEstimatedUsd - input.baseline.cost.totalEstimatedUsd,
    },
    score: {
      totalDelta: input.candidate.score.total - input.baseline.score.total,
    },
  };
}

export async function runEvaluationReplay(input: {
  dataset: ReplayDataset;
  baseline: ReplayVariant;
  candidate: ReplayVariant;
  gateRules?: RegressionGateRules;
  now?: Date;
}): Promise<ReplayReport> {
  const now = input.now ?? new Date();
  const baselineRun = await runVariant({
    dataset: input.dataset,
    variant: input.baseline,
    now,
  });
  const candidateRun = await runVariant({
    dataset: input.dataset,
    variant: input.candidate,
    now,
  });

  const baselineMetrics = computeEvaluationMetrics(baselineRun.caseResults);
  const candidateMetrics = computeEvaluationMetrics(candidateRun.caseResults);
  const gate = evaluateRegressionGate({
    baseline: baselineMetrics,
    candidate: candidateMetrics,
    rules: input.gateRules,
  });

  return {
    summary: {
      contractVersion: input.dataset.contractVersion,
      datasetVersion: input.dataset.datasetVersion,
      generatedAt: now.toISOString(),
      caseCount: input.dataset.cases.length,
      baseline: `${input.baseline.id}@${input.baseline.version}`,
      candidate: `${input.candidate.id}@${input.candidate.version}`,
    },
    baseline: {
      id: input.baseline.id,
      version: input.baseline.version,
      caseResults: baselineRun.caseResults,
      metrics: baselineMetrics,
    },
    candidate: {
      id: input.candidate.id,
      version: input.candidate.version,
      caseResults: candidateRun.caseResults,
      metrics: candidateMetrics,
    },
    diff: diffByMetric({
      baseline: baselineMetrics,
      candidate: candidateMetrics,
    }),
    gate,
  };
}
