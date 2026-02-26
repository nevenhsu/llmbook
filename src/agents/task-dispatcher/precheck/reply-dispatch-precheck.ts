import { createAdminClient } from "@/lib/supabase/admin";
import type {
  DecisionReasonCode,
  PersonaProfile,
  TaskIntent,
} from "@/lib/ai/contracts/task-intents";
import type { DispatcherPolicy } from "@/agents/task-dispatcher/policy/reply-only-policy";
import type { QueueTask } from "@/lib/ai/task-queue/task-queue";
import { SupabaseTemplateReplyGenerator } from "@/agents/phase-1-reply-vote/orchestrator/supabase-template-reply-generator";
import { RuleBasedReplySafetyGate } from "@/lib/ai/safety/reply-safety-gate";
import { SafetyReasonCode } from "@/lib/ai/reason-codes";
import { SupabaseSafetyEventSink } from "@/lib/ai/observability/supabase-safety-event-sink";
import type { SafetyEventSink } from "@/lib/ai/observability/safety-events";
import { createReplyInteractionEligibilityChecker } from "@/lib/ai/policy/reply-interaction-eligibility";

type ReplyDispatchPrecheckDeps = {
  checkEligibility: (input: {
    personaId: string;
    postId?: string | null;
    boardId?: string | null;
    now: Date;
  }) => Promise<{ allowed: boolean; reasonCode?: DecisionReasonCode }>;
  countRecentReplies: (input: { personaId: string; since: Date }) => Promise<number>;
  getLatestReplyAtOnPost: (input: { personaId: string; postId: string }) => Promise<Date | null>;
  generateDraft: (task: QueueTask) => Promise<{
    text?: string;
    parentCommentId?: string;
    skipReason?: string;
    safetyContext?: { recentPersonaReplies: string[] };
  }>;
  runSafetyCheck: (input: {
    text: string;
    context?: { recentPersonaReplies: string[] };
  }) => Promise<{ allowed: boolean; reasonCode?: string; reason?: string }>;
  recordSafetyEvent: (input: {
    intentId: string;
    personaId: string;
    postId?: string;
    reasonCode: string;
    similarity?: number;
    metadata?: Record<string, unknown>;
    now: Date;
  }) => Promise<void>;
};

type ReplyDispatchPrecheckInput = {
  intent: TaskIntent;
  persona: PersonaProfile;
  now: Date;
};

export type ReplyDispatchPrecheck = (input: ReplyDispatchPrecheckInput) => Promise<{
  allowed: boolean;
  reasons: DecisionReasonCode[];
}>;

function resolvePostId(intent: TaskIntent): string | null {
  const postId = intent.payload.postId;
  return typeof postId === "string" && postId.length > 0 ? postId : null;
}

function defaultDeps(policy: DispatcherPolicy): ReplyDispatchPrecheckDeps {
  const generator = new SupabaseTemplateReplyGenerator();
  const gate = new RuleBasedReplySafetyGate({
    similarityThreshold: policy.precheckSimilarityThreshold,
  });
  const eligibilityCheck = createReplyInteractionEligibilityChecker();

  const eventSink: SafetyEventSink = new SupabaseSafetyEventSink();

  return {
    checkEligibility: async (input) => eligibilityCheck(input),
    countRecentReplies: async ({ personaId, since }) => {
      const supabase = createAdminClient();
      const { count, error } = await supabase
        .from("comments")
        .select("*", { count: "exact", head: true })
        .eq("persona_id", personaId)
        .eq("is_deleted", false)
        .gte("created_at", since.toISOString());

      if (error) {
        throw new Error(`precheck countRecentReplies failed: ${error.message}`);
      }

      return count ?? 0;
    },
    getLatestReplyAtOnPost: async ({ personaId, postId }) => {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("comments")
        .select("created_at")
        .eq("persona_id", personaId)
        .eq("post_id", postId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ created_at: string }>();

      if (error) {
        throw new Error(`precheck getLatestReplyAtOnPost failed: ${error.message}`);
      }

      return data?.created_at ? new Date(data.created_at) : null;
    },
    generateDraft: async (task) => generator.generate(task),
    runSafetyCheck: async (input) => gate.check(input),
    recordSafetyEvent: async (input) => {
      await eventSink.record({
        intentId: input.intentId,
        personaId: input.personaId,
        postId: input.postId,
        source: "dispatch_precheck",
        reasonCode: input.reasonCode,
        similarity: input.similarity,
        metadata: input.metadata,
        occurredAt: input.now.toISOString(),
      });
    },
  };
}

function parseSimilarity(reason?: string): number | undefined {
  if (!reason) {
    return undefined;
  }
  const match = reason.match(/similarity\s+([0-9.]+)/i);
  if (!match || !match[1]) {
    return undefined;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

export function createReplyDispatchPrecheck(options: {
  policy: DispatcherPolicy;
  deps?: Partial<ReplyDispatchPrecheckDeps>;
}): ReplyDispatchPrecheck {
  const deps = { ...defaultDeps(options.policy), ...(options.deps ?? {}) };

  return async (input) => {
    const reasons: DecisionReasonCode[] = [];
    const { policy } = options;
    const postId = resolvePostId(input.intent);
    const boardId =
      typeof input.intent.payload.boardId === "string" ? input.intent.payload.boardId : null;

    const eligibility = await deps.checkEligibility({
      personaId: input.persona.id,
      postId,
      boardId,
      now: input.now,
    });

    if (!eligibility.allowed) {
      reasons.push(eligibility.reasonCode ?? "ELIGIBILITY_CHECK_FAILED", "PRECHECK_BLOCKED");
      return { allowed: false, reasons };
    }

    if (!policy.precheckEnabled) {
      return { allowed: true, reasons };
    }

    if (policy.perPersonaHourlyReplyLimit > 0) {
      const since = new Date(input.now.getTime() - 60 * 60 * 1000);
      const recentCount = await deps.countRecentReplies({
        personaId: input.persona.id,
        since,
      });
      if (recentCount >= policy.perPersonaHourlyReplyLimit) {
        reasons.push("RATE_LIMIT_HOURLY", "PRECHECK_BLOCKED");
      }
    }

    if (postId && policy.perPostCooldownSeconds > 0) {
      const latestReplyAt = await deps.getLatestReplyAtOnPost({
        personaId: input.persona.id,
        postId,
      });
      if (latestReplyAt) {
        const cooldownMs = policy.perPostCooldownSeconds * 1000;
        if (input.now.getTime() - latestReplyAt.getTime() < cooldownMs) {
          reasons.push("COOLDOWN_ACTIVE", "PRECHECK_BLOCKED");
        }
      }
    }

    if (postId) {
      const syntheticTask: QueueTask = {
        id: `precheck:${input.intent.id}:${input.persona.id}`,
        personaId: input.persona.id,
        taskType: "reply",
        payload: {
          ...input.intent.payload,
          postId,
        },
        status: "PENDING",
        scheduledAt: new Date(input.now),
        retryCount: 0,
        maxRetries: 0,
        createdAt: new Date(input.now),
      };
      const generated = await deps.generateDraft(syntheticTask);
      const text = generated.text?.trim();
      if (text) {
        const safety = await deps.runSafetyCheck({
          text,
          context: generated.safetyContext,
        });
        if (!safety.allowed && safety.reasonCode === SafetyReasonCode.similarToRecentReply) {
          reasons.push("PRECHECK_SAFETY_SIMILAR_TO_RECENT_REPLY", "PRECHECK_BLOCKED");
          try {
            await deps.recordSafetyEvent({
              intentId: input.intent.id,
              personaId: input.persona.id,
              postId,
              reasonCode: SafetyReasonCode.similarToRecentReply,
              similarity: parseSimilarity(safety.reason),
              metadata: { layer: "dispatch_precheck" },
              now: input.now,
            });
          } catch {
            // Best-effort observability; do not block dispatch pipeline on metrics failures.
          }
        }
      }
    }

    return { allowed: reasons.length === 0, reasons };
  };
}
