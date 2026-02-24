import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchIntents } from "@/agents/task-dispatcher/orchestrator/dispatch-intents";
import { createReplyDispatchPrecheck } from "@/agents/task-dispatcher/precheck/reply-dispatch-precheck";
import {
  loadDispatcherPolicy,
  type DispatcherPolicy,
} from "@/agents/task-dispatcher/policy/reply-only-policy";
import {
  SupabaseTaskIntentRepository,
  type StoredIntent,
} from "@/lib/ai/contracts/task-intent-repository";
import type { PersonaProfile } from "@/lib/ai/contracts/task-intents";
import type { QueueTask } from "@/lib/ai/task-queue/task-queue";

async function listActivePersonas(limit: number): Promise<PersonaProfile[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("personas")
    .select("id, status")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`list active personas failed: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({ id: row.id, status: "active" }));
}

async function insertPersonaTask(task: QueueTask): Promise<void> {
  const supabase = createAdminClient();
  const sourceIntentId =
    typeof task.payload.sourceIntentId === "string" ? task.payload.sourceIntentId : null;
  const idempotencyKey = sourceIntentId ? `intent:${sourceIntentId}` : `task:${task.id}`;

  const { error } = await supabase.from("persona_tasks").insert({
    id: task.id,
    persona_id: task.personaId,
    source_intent_id: sourceIntentId,
    task_type: task.taskType,
    payload: task.payload,
    idempotency_key: idempotencyKey,
    status: task.status,
    scheduled_at: task.scheduledAt.toISOString(),
    retry_count: task.retryCount,
    max_retries: task.maxRetries,
    created_at: task.createdAt.toISOString(),
  });

  if (error) {
    throw new Error(`insert persona_task failed: ${error.message}`);
  }
}

export type DispatchNewIntentsSummary = {
  scanned: number;
  dispatched: number;
  skipped: number;
};

export async function dispatchNewIntents(options?: {
  intentRepo?: SupabaseTaskIntentRepository;
  batchSize?: number;
  policy?: DispatcherPolicy;
  listPersonas?: (limit: number) => Promise<PersonaProfile[]>;
  createTask?: (task: QueueTask) => Promise<void>;
}): Promise<DispatchNewIntentsSummary> {
  const intentRepo = options?.intentRepo ?? new SupabaseTaskIntentRepository();
  const intents = await intentRepo.listNewIntents(options?.batchSize ?? 100);

  if (!intents.length) {
    return { scanned: 0, dispatched: 0, skipped: 0 };
  }

  const personas = await (options?.listPersonas ?? listActivePersonas)(50);
  const policy = options?.policy ?? loadDispatcherPolicy();
  const precheck = createReplyDispatchPrecheck({ policy });
  const decisions = await dispatchIntents({
    intents,
    personas,
    policy,
    now: new Date(),
    makeTaskId: () => randomUUID(),
    createTask: options?.createTask ?? insertPersonaTask,
    precheck,
  });

  let dispatched = 0;
  let skipped = 0;

  for (let i = 0; i < decisions.length; i += 1) {
    const decision = decisions[i];
    const intent = intents[i] as StoredIntent | undefined;
    if (!decision || !intent) continue;

    if (decision.dispatched && decision.personaId) {
      await intentRepo.markDispatched({
        intentId: intent.id,
        personaId: decision.personaId,
        reasons: decision.reasons,
      });
      dispatched += 1;
    } else {
      await intentRepo.markSkipped({
        intentId: intent.id,
        reasons: decision.reasons,
      });
      skipped += 1;
    }
  }

  return {
    scanned: intents.length,
    dispatched,
    skipped,
  };
}
