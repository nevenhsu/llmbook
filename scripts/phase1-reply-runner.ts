#!/usr/bin/env node

import {
  log,
  logSeparator,
  validateEnvironment,
  testDatabaseConnection,
} from "./lib/script-helpers";
import { collectTaskIntents } from "@/agents/heartbeat-observer/orchestrator/collect-task-intents";
import { dispatchNewIntents } from "@/agents/task-dispatcher/orchestrator/dispatch-new-intents";
import { TaskQueue } from "@/lib/ai/task-queue/task-queue";
import { SupabaseTaskQueueStore } from "@/lib/ai/task-queue/supabase-task-queue-store";
import { SupabaseTaskEventSink } from "@/lib/ai/observability/supabase-task-event-sink";
import { ReplyExecutionAgent } from "@/agents/phase-1-reply-vote/orchestrator/reply-execution-agent";
import { SupabaseIdempotencyStore } from "@/agents/phase-1-reply-vote/orchestrator/supabase-idempotency-store";
import { SupabaseTemplateReplyGenerator } from "@/agents/phase-1-reply-vote/orchestrator/supabase-template-reply-generator";
import { SupabaseReplyAtomicPersistence } from "@/agents/phase-1-reply-vote/orchestrator/supabase-reply-atomic-persistence";
import { createAdminClient } from "@/lib/supabase/admin";
import { RuleBasedReplySafetyGate } from "@/lib/ai/safety/reply-safety-gate";
import { SupabaseSafetyEventSink } from "@/lib/ai/observability/supabase-safety-event-sink";
import { CachedReplyPolicyProvider } from "@/lib/ai/policy/policy-control-plane";
import { SupabaseRuntimeEventSink } from "@/lib/ai/observability/runtime-event-sink";
import { SupabaseRuntimeObservabilityStore } from "@/lib/ai/observability/runtime-observability-store";

const HEARTBEAT_ONLY = process.argv.includes("--heartbeat-only");
const DISPATCH_ONLY = process.argv.includes("--dispatch-only");
const EXECUTE_ONLY = process.argv.includes("--execute-only");

const executionLimitArgIndex = process.argv.indexOf("--execution-limit");
const executionLimit =
  executionLimitArgIndex > -1 && process.argv[executionLimitArgIndex + 1]
    ? Math.max(1, Number(process.argv[executionLimitArgIndex + 1]))
    : 5;
const policyProvider = new CachedReplyPolicyProvider();

async function runExecutionBatch(limit: number): Promise<number> {
  const workerId = "phase1-runner";
  const runtimeEventSink = new SupabaseRuntimeEventSink();
  const runtimeStore = new SupabaseRuntimeObservabilityStore();

  const queue = new TaskQueue({
    store: new SupabaseTaskQueueStore(),
    eventSink: new SupabaseTaskEventSink(),
    leaseMs: 60_000,
  });

  const writer = {
    write: async (input: { personaId: string; text: string; payload: Record<string, unknown> }) => {
      const supabase = createAdminClient();
      const postId = input.payload.postId;
      const parentCommentId = input.payload.parentCommentId;

      if (typeof postId !== "string" || !postId) {
        throw new Error("payload.postId is required");
      }

      const { data, error } = await supabase
        .from("comments")
        .insert({
          post_id: postId,
          parent_id: typeof parentCommentId === "string" ? parentCommentId : null,
          author_id: null,
          persona_id: input.personaId,
          body: input.text,
        })
        .select("id")
        .single<{ id: string }>();

      if (error) {
        throw new Error(`insert comment failed: ${error.message}`);
      }

      return { resultId: data.id };
    },
  };

  const agent = new ReplyExecutionAgent({
    queue,
    idempotency: new SupabaseIdempotencyStore("reply"),
    generator: new SupabaseTemplateReplyGenerator(),
    safetyGate: new RuleBasedReplySafetyGate(),
    safetyEventSink: new SupabaseSafetyEventSink(),
    writer,
    atomicPersistence: new SupabaseReplyAtomicPersistence(),
    policyProvider,
    runtimeEventSink,
  });

  const publishWorkerStatus = async (
    status: "RUNNING" | "IDLE" | "DEGRADED" | "STOPPED",
    now: Date,
    metadata?: Record<string, unknown>,
  ): Promise<void> => {
    const snapshot = agent.getCircuitSnapshot();
    const effectiveStatus = snapshot.isOpen ? "DEGRADED" : status;
    try {
      await runtimeStore.upsertWorkerStatus({
        workerId,
        agentType: "phase1_reply_runner",
        status: effectiveStatus,
        circuitOpen: snapshot.isOpen,
        circuitReason: snapshot.isOpen ? "EMPTY_REPLY_CIRCUIT_OPEN" : null,
        currentTaskId: snapshot.currentTaskId,
        now,
        metadata: {
          consecutiveEmptyReplySkips: snapshot.consecutiveEmptyReplySkips,
          emptyReplyCircuitBreakerThreshold: snapshot.threshold,
          ...metadata,
        },
      });
    } catch {
      // Best-effort observability only.
    }
  };

  let executed = 0;
  await publishWorkerStatus("RUNNING", new Date(), { phase: "execution_start" });

  for (let i = 0; i < limit; i += 1) {
    const now = new Date();
    const result = await agent.runOnce({ workerId, now });
    await publishWorkerStatus(result === "DONE" ? "RUNNING" : "IDLE", now, {
      lastRunResult: result,
    });
    if (result === "IDLE") {
      break;
    }
    executed += 1;
  }

  await publishWorkerStatus("STOPPED", new Date(), { phase: "execution_end", executed });
  return executed;
}

async function main(): Promise<void> {
  logSeparator();
  log("Phase1 Reply Runner (Heartbeat -> Dispatch -> Execute)", "info");
  logSeparator();

  await validateEnvironment();
  await testDatabaseConnection("persona_tasks");

  if (!DISPATCH_ONLY && !EXECUTE_ONLY) {
    const heartbeat = await collectTaskIntents();
    log(
      `Heartbeat scanned posts=${heartbeat.scannedBySource.posts}, comments=${heartbeat.scannedBySource.comments}, votes=${heartbeat.scannedBySource.votes}, poll_votes=${heartbeat.scannedBySource.poll_votes}, notifications=${heartbeat.scannedBySource.notifications}`,
      "info",
    );
    log(
      `Heartbeat created intents=${heartbeat.createdIntents}, skipped=${heartbeat.skippedEvents}`,
      "info",
    );
    if (HEARTBEAT_ONLY) return;
  }

  if (!HEARTBEAT_ONLY && !EXECUTE_ONLY) {
    const dispatch = await dispatchNewIntents({ policyProvider });
    log(
      `Dispatcher scanned=${dispatch.scanned}, dispatched=${dispatch.dispatched}, skipped=${dispatch.skipped}`,
      "info",
    );
    if (DISPATCH_ONLY) return;
  }

  if (!HEARTBEAT_ONLY && !DISPATCH_ONLY) {
    const executed = await runExecutionBatch(executionLimit);
    log(`Execution handled ${executed} task(s)`, executed > 0 ? "success" : "info");
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  log(`Phase1 runner failed: ${message}`, "error");
  process.exit(1);
});
