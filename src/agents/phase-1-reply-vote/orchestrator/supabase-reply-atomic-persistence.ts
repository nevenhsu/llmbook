import type { ReplyAtomicPersistence } from "@/agents/phase-1-reply-vote/orchestrator/reply-execution-agent";
import type { QueueTask } from "@/lib/ai/task-queue/task-queue";
import { runInPostgresTransaction } from "@/lib/supabase/postgres";

export class SupabaseReplyAtomicPersistence implements ReplyAtomicPersistence {
  public async writeIdempotentAndComplete(input: {
    task: QueueTask;
    workerId: string;
    now: Date;
    text: string;
    parentCommentId?: string;
    idempotencyKey: string;
  }): Promise<{ resultId: string } | null> {
    return runInPostgresTransaction(async (tx) => {
      const postId = input.task.payload.postId;
      if (typeof postId !== "string" || !postId) {
        throw new Error("payload.postId is required");
      }

      const existingRes = await tx.query(
        `select result_id
         from public.task_idempotency_keys
         where task_type = 'reply'
           and idempotency_key = $1`,
        [input.idempotencyKey],
      );
      const existingId = (existingRes.rows[0] as { result_id?: string } | undefined)?.result_id;
      if (existingId) {
        await tx.query(
          `update public.persona_tasks
           set status = 'DONE',
               completed_at = $3,
               result_id = $2,
               result_type = 'comment',
               error_message = null,
               lease_owner = null,
               lease_until = null
           where id = $1
             and status = 'RUNNING'
             and lease_owner = $4`,
          [input.task.id, existingId, input.now.toISOString(), input.workerId],
        );

        return { resultId: existingId };
      }

      const commentRes = await tx.query(
        `insert into public.comments (post_id, parent_id, author_id, persona_id, body)
         values ($1, $2, null, $3, $4)
         returning id`,
        [postId, input.parentCommentId ?? null, input.task.personaId, input.text],
      );

      const resultId = (commentRes.rows[0] as { id?: string } | undefined)?.id;
      if (!resultId) {
        throw new Error("failed to create comment");
      }

      await tx.query(
        `insert into public.task_idempotency_keys (
           task_type, idempotency_key, result_id, result_type, task_id, updated_at
         ) values ('reply', $1, $2, 'comment', $3, $4)
         on conflict (task_type, idempotency_key)
         do update set
           result_id = excluded.result_id,
           result_type = excluded.result_type,
           task_id = excluded.task_id,
           updated_at = excluded.updated_at`,
        [input.idempotencyKey, resultId, input.task.id, input.now.toISOString()],
      );

      const taskRes = await tx.query(
        `update public.persona_tasks
         set status = 'DONE',
             completed_at = $3,
             result_id = $2,
             result_type = 'comment',
             error_message = null,
             lease_owner = null,
             lease_until = null
         where id = $1
           and status = 'RUNNING'
           and lease_owner = $4
         returning persona_id, task_type, retry_count`,
        [input.task.id, resultId, input.now.toISOString(), input.workerId],
      );

      const updatedTask = taskRes.rows[0] as
        | { persona_id: string; task_type: string; retry_count: number }
        | undefined;

      if (!updatedTask) {
        throw new Error(`task ${input.task.id} is not claim-owned by ${input.workerId}`);
      }

      await tx.query(
        `insert into public.task_transition_events (
           task_id, persona_id, task_type, from_status, to_status, reason_code, worker_id, retry_count, created_at
         ) values ($1, $2, $3, 'RUNNING', 'DONE', 'COMPLETED', $4, $5, $6)`,
        [
          input.task.id,
          updatedTask.persona_id,
          updatedTask.task_type,
          input.workerId,
          updatedTask.retry_count,
          input.now.toISOString(),
        ],
      );

      return { resultId };
    });
  }
}
