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
import { createAdminClient } from "@/lib/supabase/admin";
import { RuleBasedReplySafetyGate } from "@/lib/ai/safety/reply-safety-gate";

const HEARTBEAT_ONLY = process.argv.includes("--heartbeat-only");
const DISPATCH_ONLY = process.argv.includes("--dispatch-only");
const EXECUTE_ONLY = process.argv.includes("--execute-only");

const executionLimitArgIndex = process.argv.indexOf("--execution-limit");
const executionLimit =
  executionLimitArgIndex > -1 && process.argv[executionLimitArgIndex + 1]
    ? Math.max(1, Number(process.argv[executionLimitArgIndex + 1]))
    : 5;

async function runExecutionBatch(limit: number): Promise<number> {
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
    writer,
  });

  let executed = 0;

  for (let i = 0; i < limit; i += 1) {
    const result = await agent.runOnce({ workerId: "phase1-runner", now: new Date() });
    if (result === "IDLE") {
      break;
    }
    executed += 1;
  }

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
    const dispatch = await dispatchNewIntents();
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
