import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { runInPostgresTransaction } from "@/lib/supabase/postgres";
import { dispatchIntents } from "@/agents/task-dispatcher/orchestrator/dispatch-intents";
import {
  createReplyDispatchPrecheck,
  type ReplyDispatchPrecheck,
} from "@/agents/task-dispatcher/precheck/reply-dispatch-precheck";
import { type DispatcherPolicy } from "@/agents/task-dispatcher/policy/reply-only-policy";
import {
  SupabaseTaskIntentRepository,
  type StoredIntent,
} from "@/lib/ai/contracts/task-intent-repository";
import type { PersonaProfile } from "@/lib/ai/contracts/task-intents";
import type { QueueTask } from "@/lib/ai/task-queue/task-queue";
import type { DispatchDecision } from "@/agents/task-dispatcher/orchestrator/dispatch-intents";
import {
  CachedReplyPolicyProvider,
  type ReplyPolicyProvider,
} from "@/lib/ai/policy/policy-control-plane";

const defaultPolicyProvider = new CachedReplyPolicyProvider();

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

async function persistDispatchDecisionAtomic(input: {
  intent: StoredIntent;
  decision: DispatchDecision;
  task?: QueueTask;
  now: Date;
}): Promise<"DISPATCHED" | "SKIPPED"> {
  return runInPostgresTransaction(async (tx) => {
    if (input.decision.dispatched && input.decision.personaId && input.task) {
      const sourceIntentId =
        typeof input.task.payload.sourceIntentId === "string"
          ? input.task.payload.sourceIntentId
          : null;
      const idempotencyKey = sourceIntentId ? `intent:${sourceIntentId}` : `task:${input.task.id}`;

      await tx.query(
        `insert into public.persona_tasks (
           id, persona_id, source_intent_id, task_type, payload, idempotency_key, status, scheduled_at, retry_count, max_retries, created_at
         ) values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)`,
        [
          input.task.id,
          input.task.personaId,
          sourceIntentId,
          input.task.taskType,
          JSON.stringify(input.task.payload),
          idempotencyKey,
          input.task.status,
          input.task.scheduledAt.toISOString(),
          input.task.retryCount,
          input.task.maxRetries,
          input.task.createdAt.toISOString(),
        ],
      );

      await tx.query(
        `update public.task_intents
         set status = 'DISPATCHED',
             selected_persona_id = $2,
             decision_reason_codes = $3::text[],
             updated_at = $4
         where id = $1`,
        [
          input.intent.id,
          input.decision.personaId,
          input.decision.reasons,
          input.now.toISOString(),
        ],
      );

      return "DISPATCHED";
    }

    await tx.query(
      `update public.task_intents
       set status = 'SKIPPED',
           decision_reason_codes = $2::text[],
           updated_at = $3
       where id = $1`,
      [input.intent.id, input.decision.reasons, input.now.toISOString()],
    );

    return "SKIPPED";
  });
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
  policyProvider?: ReplyPolicyProvider;
  precheck?: ReplyDispatchPrecheck;
  listPersonas?: (limit: number) => Promise<PersonaProfile[]>;
  createTask?: (task: QueueTask) => Promise<void>;
  persistDecisionAtomic?: (input: {
    intent: StoredIntent;
    decision: DispatchDecision;
    task?: QueueTask;
    now: Date;
  }) => Promise<"DISPATCHED" | "SKIPPED">;
}): Promise<DispatchNewIntentsSummary> {
  const intentRepo = options?.intentRepo ?? new SupabaseTaskIntentRepository();
  const useAtomicPersist =
    Boolean(options?.persistDecisionAtomic) || (!options?.intentRepo && !options?.createTask);
  const intents = await intentRepo.listNewIntents(options?.batchSize ?? 100);

  if (!intents.length) {
    return { scanned: 0, dispatched: 0, skipped: 0 };
  }

  const personas = await (options?.listPersonas ?? listActivePersonas)(50);
  const policy = options?.policy
    ? options.policy
    : await (options?.policyProvider ?? defaultPolicyProvider).getReplyPolicy();
  const precheck = options?.precheck ?? createReplyDispatchPrecheck({ policy });
  const taskByIntentId = new Map<string, QueueTask>();
  const createTaskForDispatch = async (task: QueueTask): Promise<void> => {
    if (useAtomicPersist) {
      const sourceIntentId =
        typeof task.payload.sourceIntentId === "string" ? task.payload.sourceIntentId : null;
      if (sourceIntentId) {
        taskByIntentId.set(sourceIntentId, task);
      }
    }

    if (options?.createTask) {
      await options.createTask(task);
      return;
    }

    if (!useAtomicPersist) {
      await insertPersonaTask(task);
    }
  };

  const decisions = await dispatchIntents({
    intents,
    personas,
    policy,
    now: new Date(),
    makeTaskId: () => randomUUID(),
    createTask: createTaskForDispatch,
    precheck,
  });

  let dispatched = 0;
  let skipped = 0;

  for (let i = 0; i < decisions.length; i += 1) {
    const decision = decisions[i];
    const intent = intents[i] as StoredIntent | undefined;
    if (!decision || !intent) continue;

    if (useAtomicPersist) {
      const task = taskByIntentId.get(intent.id);
      const persisted = await (options?.persistDecisionAtomic ?? persistDispatchDecisionAtomic)({
        intent,
        decision,
        task,
        now: new Date(),
      });

      if (persisted === "DISPATCHED") {
        dispatched += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

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
