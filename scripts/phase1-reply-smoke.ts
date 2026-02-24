#!/usr/bin/env node

/**
 * Phase 1 reply-only smoke runner (manual only)
 *
 * Default mode is DRY RUN (no DB writes).
 * Use --execute to perform writes.
 *
 * Example:
 *   npm run ai:phase1:smoke -- --post-id <post_uuid> --execute
 */

import { randomUUID } from "node:crypto";
import { createAdminClient } from "../src/lib/supabase/admin";
import {
  log,
  logSeparator,
  validateEnvironment,
  testDatabaseConnection,
} from "./lib/script-helpers";
import { dispatchIntents } from "@/agents/task-dispatcher/orchestrator/dispatch-intents";
import { loadDispatcherPolicy } from "@/agents/task-dispatcher/policy/reply-only-policy";
import type { PersonaProfile } from "@/lib/ai/contracts/task-intents";
import { TaskQueue, type QueueTask } from "@/lib/ai/task-queue/task-queue";
import { SupabaseTaskQueueStore } from "@/lib/ai/task-queue/supabase-task-queue-store";
import { SupabaseTaskEventSink } from "@/lib/ai/observability/supabase-task-event-sink";
import { ReplyExecutionAgent } from "@/agents/phase-1-reply-vote/orchestrator/reply-execution-agent";
import { SupabaseIdempotencyStore } from "@/agents/phase-1-reply-vote/orchestrator/supabase-idempotency-store";
import { SupabaseTaskIntentRepository } from "@/lib/ai/contracts/task-intent-repository";
import { SupabaseTemplateReplyGenerator } from "@/agents/phase-1-reply-vote/orchestrator/supabase-template-reply-generator";
import { RuleBasedReplySafetyGate } from "@/lib/ai/safety/reply-safety-gate";
import { SafetyReasonCode } from "@/lib/ai/reason-codes";
import { SupabaseSafetyEventSink } from "@/lib/ai/observability/supabase-safety-event-sink";

type Args = {
  postId?: string;
  parentCommentId?: string;
  personaId?: string;
  execute: boolean;
  antiRepeatCheck: boolean;
  body?: string;
};

function parseArgs(argv: string[]): Args {
  const read = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    if (index < 0 || index + 1 >= argv.length) {
      return undefined;
    }
    return argv[index + 1];
  };

  return {
    postId: read("--post-id"),
    parentCommentId: read("--parent-comment-id"),
    personaId: read("--persona-id"),
    body: read("--body"),
    execute: argv.includes("--execute"),
    antiRepeatCheck: argv.includes("--anti-repeat-check"),
  };
}

async function resolveTargetPostId(inputPostId?: string): Promise<string> {
  if (inputPostId) {
    return inputPostId;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("posts")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(`failed to resolve latest post: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("no post found. pass --post-id explicitly");
  }

  return data.id;
}

async function resolveActivePersona(inputPersonaId?: string): Promise<PersonaProfile> {
  const supabase = createAdminClient();

  if (inputPersonaId) {
    const { data, error } = await supabase
      .from("personas")
      .select("id, status")
      .eq("id", inputPersonaId)
      .maybeSingle<{ id: string; status: "active" | "inactive" | "suspended" | "retired" }>();

    if (error) {
      throw new Error(`failed to load persona ${inputPersonaId}: ${error.message}`);
    }
    if (!data) {
      throw new Error(`persona not found: ${inputPersonaId}`);
    }
    if (data.status !== "active") {
      throw new Error(`persona ${inputPersonaId} is not active (status=${data.status})`);
    }

    return { id: data.id, status: "active" };
  }

  const { data, error } = await supabase
    .from("personas")
    .select("id, status")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; status: "active" }>();

  if (error) {
    throw new Error(`failed to resolve active persona: ${error.message}`);
  }

  if (!data) {
    throw new Error("no active persona found. create one or pass --persona-id");
  }

  return { id: data.id, status: "active" };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.execute ? "EXECUTE" : "DRY_RUN";

  logSeparator();
  log(`Phase1 Reply Smoke (${mode})`, "info");
  logSeparator();

  await validateEnvironment();
  await testDatabaseConnection("persona_tasks");

  const targetPostId = await resolveTargetPostId(args.postId);
  const persona = await resolveActivePersona(args.personaId);

  log(`Target post: ${targetPostId}`, "info");
  log(`Persona: ${persona.id}`, "info");

  const now = new Date();
  const runToken = randomUUID().slice(0, 8);
  const idempotencyKeyBase = `phase1-smoke:${targetPostId}:${args.parentCommentId ?? "root"}:${runToken}`;
  const intentRepo = new SupabaseTaskIntentRepository();
  const generator = new SupabaseTemplateReplyGenerator();

  const intent = {
    id: randomUUID(),
    type: "reply" as const,
    sourceTable: "posts" as const,
    sourceId: targetPostId,
    createdAt: now.toISOString(),
    payload: {
      postId: targetPostId,
      parentCommentId: args.parentCommentId ?? null,
      idempotencyKey: `${idempotencyKeyBase}:1`,
      smokeTest: true,
    },
  };

  const preview = await generator.generate({
    id: "preview-task",
    personaId: persona.id,
    taskType: "reply",
    payload: intent.payload,
    status: "PENDING",
    scheduledAt: now,
    retryCount: 0,
    maxRetries: 3,
    createdAt: now,
  });

  if (!args.execute) {
    log("Dry run only: no DB writes will happen.", "warning");
    log(`Would create intent for post ${intent.sourceId}`, "info");
    log(`Would dispatch to persona ${persona.id}`, "info");
    log(`Would run reply task with idempotency_key=${idempotencyKeyBase}:1`, "info");
    if (args.antiRepeatCheck) {
      log("Would run anti-repeat check (second similar body should be blocked)", "info");
    }
    if (preview.skipReason) {
      log(`Generator would skip: ${preview.skipReason}`, "warning");
    } else {
      log(`Generator parent_comment_id: ${preview.parentCommentId ?? "null(root)"}`, "info");
      log(`Generator preview: ${preview.text ?? ""}`, "info");
    }
    process.exit(0);
  }

  const storedIntent = await intentRepo.upsertIntent({
    intentType: intent.type,
    sourceTable: intent.sourceTable,
    sourceId: intent.sourceId,
    sourceCreatedAt: intent.createdAt,
    payload: intent.payload,
  });

  const decisions = await dispatchIntents({
    intents: [intent],
    personas: [persona],
    policy: loadDispatcherPolicy(),
    now,
    makeTaskId: () => randomUUID(),
    createTask: async (task) => {
      const supabase = createAdminClient();
      const { error } = await supabase.from("persona_tasks").insert({
        id: task.id,
        persona_id: task.personaId,
        source_intent_id: storedIntent.id,
        task_type: task.taskType,
        payload: task.payload,
        idempotency_key: String(task.payload.idempotencyKey ?? ""),
        status: task.status,
        scheduled_at: task.scheduledAt.toISOString(),
        retry_count: task.retryCount,
        max_retries: task.maxRetries,
        created_at: task.createdAt.toISOString(),
      });

      if (error) {
        throw new Error(`insert persona_task failed: ${error.message}`);
      }
    },
  });

  const decision = decisions[0];
  if (!decision) {
    throw new Error("dispatch did not return decision");
  }

  if (!decision.dispatched || !decision.taskId || !decision.personaId) {
    await intentRepo.markSkipped({ intentId: storedIntent.id, reasons: decision.reasons });
    throw new Error(`dispatch skipped: ${decision.reasons.join(",")}`);
  }

  await intentRepo.markDispatched({
    intentId: storedIntent.id,
    personaId: decision.personaId,
    reasons: decision.reasons,
  });

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
        throw new Error("payload.postId is required for reply writer");
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

  const overrideBody =
    args.body && args.body.trim().length > 0
      ? args.antiRepeatCheck
        ? `${args.body.trim()}\n\n[anti-repeat-run:${randomUUID().slice(0, 8)}]`
        : args.body.trim()
      : null;

  const runtimeGenerator =
    overrideBody != null
      ? {
          generate: async (task: QueueTask) => {
            const generated = await generator.generate(task);
            return {
              ...generated,
              text: overrideBody,
            };
          },
        }
      : generator;

  const agent = new ReplyExecutionAgent({
    queue,
    safetyGate: new RuleBasedReplySafetyGate(),
    safetyEventSink: new SupabaseSafetyEventSink(),
    generator: runtimeGenerator,
    writer,
    idempotency: new SupabaseIdempotencyStore("reply"),
  });

  await agent.runOnce({ workerId: "phase1-smoke-worker", now: new Date() });

  const supabase = createAdminClient();
  const { data: task, error: taskError } = await supabase
    .from("persona_tasks")
    .select("id, status, result_id, error_message")
    .eq("id", decision.taskId)
    .single<{
      id: string;
      status: string;
      result_id: string | null;
      error_message: string | null;
    }>();

  if (taskError) {
    throw new Error(`load task result failed: ${taskError.message}`);
  }

  log(`Task ${task.id} status: ${task.status}`, task.status === "DONE" ? "success" : "warning");
  if (task.result_id) {
    log(`Created comment id: ${task.result_id}`, "success");
    log("You can refresh the post page to see the new reply.", "info");
  }
  if (task.error_message) {
    log(`Task error: ${task.error_message}`, "warning");
  }

  if (!args.antiRepeatCheck) {
    return;
  }

  if (!args.body || args.body.trim().length === 0) {
    throw new Error("--anti-repeat-check requires --body to ensure deterministic similarity");
  }

  if (task.status !== "DONE") {
    throw new Error(`anti-repeat-check requires first task DONE, got ${task.status}`);
  }

  const secondIntent = {
    ...intent,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    payload: {
      ...intent.payload,
      idempotencyKey: `${idempotencyKeyBase}:2`,
    },
  };

  const secondStoredIntent = await intentRepo.upsertIntent({
    intentType: secondIntent.type,
    sourceTable: secondIntent.sourceTable,
    sourceId: secondIntent.sourceId,
    sourceCreatedAt: secondIntent.createdAt,
    payload: secondIntent.payload,
  });

  const secondDecisions = await dispatchIntents({
    intents: [secondIntent],
    personas: [persona],
    policy: loadDispatcherPolicy(),
    now: new Date(),
    makeTaskId: () => randomUUID(),
    createTask: async (taskInput) => {
      const localSupabase = createAdminClient();
      const { error } = await localSupabase.from("persona_tasks").insert({
        id: taskInput.id,
        persona_id: taskInput.personaId,
        source_intent_id: secondStoredIntent.id,
        task_type: taskInput.taskType,
        payload: taskInput.payload,
        idempotency_key: String(taskInput.payload.idempotencyKey ?? ""),
        status: taskInput.status,
        scheduled_at: taskInput.scheduledAt.toISOString(),
        retry_count: taskInput.retryCount,
        max_retries: taskInput.maxRetries,
        created_at: taskInput.createdAt.toISOString(),
      });

      if (error) {
        throw new Error(`insert second persona_task failed: ${error.message}`);
      }
    },
  });

  const secondDecision = secondDecisions[0];
  if (
    !secondDecision ||
    !secondDecision.dispatched ||
    !secondDecision.taskId ||
    !secondDecision.personaId
  ) {
    throw new Error(`second dispatch skipped: ${secondDecision?.reasons.join(",") ?? "unknown"}`);
  }

  await intentRepo.markDispatched({
    intentId: secondStoredIntent.id,
    personaId: secondDecision.personaId,
    reasons: secondDecision.reasons,
  });

  await agent.runOnce({ workerId: "phase1-smoke-worker", now: new Date() });

  const { data: secondTask, error: secondTaskError } = await supabase
    .from("persona_tasks")
    .select("id, status, error_message")
    .eq("id", secondDecision.taskId)
    .single<{ id: string; status: string; error_message: string | null }>();

  if (secondTaskError) {
    throw new Error(`load second task result failed: ${secondTaskError.message}`);
  }

  log(`Second task ${secondTask.id} status: ${secondTask.status}`, "info");
  log(`Second task reason: ${secondTask.error_message ?? "n/a"}`, "info");

  if (
    secondTask.status !== "SKIPPED" ||
    secondTask.error_message !== SafetyReasonCode.similarToRecentReply
  ) {
    throw new Error(
      `anti-repeat check failed, expected SKIPPED/${SafetyReasonCode.similarToRecentReply}, got ${secondTask.status}/${secondTask.error_message}`,
    );
  }

  log("Anti-repeat check passed: second similar reply was blocked.", "success");
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  log(`Smoke script failed: ${message}`, "error");
  process.exit(1);
});
