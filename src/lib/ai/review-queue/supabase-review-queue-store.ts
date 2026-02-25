import { createAdminClient } from "@/lib/supabase/admin";
import { runInPostgresTransaction } from "@/lib/supabase/postgres";
import type {
  ReviewQueueEvent,
  ReviewQueueAtomicStore,
  ReviewQueueItem,
  ReviewQueueStatus,
  ReviewQueueStore,
  ReviewQueueTask,
  ReviewRiskLevel,
} from "@/lib/ai/review-queue/review-queue";

type ReviewRow = {
  id: string;
  task_id: string;
  persona_id: string;
  risk_level: ReviewRiskLevel;
  status: ReviewQueueStatus;
  enqueue_reason_code: string;
  decision: "APPROVE" | "REJECT" | null;
  decision_reason_code: string | null;
  reviewer_id: string | null;
  note: string | null;
  expires_at: string;
  claimed_at: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
  personas?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type TaskRow = {
  id: string;
  persona_id: string;
  task_type: ReviewQueueTask["taskType"];
  payload: Record<string, unknown> | null;
  status: ReviewQueueTask["status"];
  scheduled_at: string;
  created_at: string;
  retry_count: number;
  max_retries: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
};

type ReviewEventRow = {
  review_id: string;
  task_id: string;
  event_type: ReviewQueueEvent["eventType"];
  reason_code: string | null;
  reviewer_id: string | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function fromReviewRow(row: ReviewRow): ReviewQueueItem {
  const metadata: Record<string, unknown> = { ...(row.metadata ?? {}) };
  if (row.personas) {
    if (typeof metadata.personaUsername !== "string" || metadata.personaUsername.length === 0) {
      metadata.personaUsername = row.personas.username ?? undefined;
    }
    if (typeof metadata.personaName !== "string" || metadata.personaName.length === 0) {
      metadata.personaName = row.personas.display_name ?? undefined;
    }
    if (typeof metadata.avatarUrl !== "string" || metadata.avatarUrl.length === 0) {
      metadata.avatarUrl = row.personas.avatar_url ?? undefined;
    }
  }

  return {
    id: row.id,
    taskId: row.task_id,
    personaId: row.persona_id,
    riskLevel: row.risk_level,
    status: row.status,
    enqueueReasonCode: row.enqueue_reason_code,
    decision: row.decision ?? undefined,
    decisionReasonCode: row.decision_reason_code ?? undefined,
    reviewerId: row.reviewer_id ?? undefined,
    note: row.note ?? undefined,
    expiresAt: new Date(row.expires_at),
    claimedAt: row.claimed_at ? new Date(row.claimed_at) : undefined,
    decidedAt: row.decided_at ? new Date(row.decided_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    metadata,
  };
}

function fromTaskRow(row: TaskRow): ReviewQueueTask {
  return {
    id: row.id,
    personaId: row.persona_id,
    taskType: row.task_type,
    payload: row.payload ?? {},
    status: row.status,
    scheduledAt: new Date(row.scheduled_at),
    createdAt: new Date(row.created_at),
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    errorMessage: row.error_message ?? undefined,
  };
}

function fromReviewEventRow(row: ReviewEventRow): ReviewQueueEvent {
  return {
    reviewId: row.review_id,
    taskId: row.task_id,
    eventType: row.event_type,
    reasonCode: row.reason_code ?? undefined,
    reviewerId: row.reviewer_id ?? undefined,
    note: row.note ?? undefined,
    metadata: row.metadata ?? {},
    createdAt: new Date(row.created_at),
  };
}

export class SupabaseReviewQueueStore implements ReviewQueueStore, ReviewQueueAtomicStore {
  public async getReviewById(reviewId: string): Promise<ReviewQueueItem | undefined> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_review_queue")
      .select("*, personas:persona_id(username, display_name, avatar_url)")
      .eq("id", reviewId)
      .maybeSingle<ReviewRow>();

    if (error) {
      throw new Error(`getReviewById failed: ${error.message}`);
    }

    return data ? fromReviewRow(data) : undefined;
  }

  public async getReviewByTaskId(taskId: string): Promise<ReviewQueueItem | undefined> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_review_queue")
      .select("*, personas:persona_id(username, display_name, avatar_url)")
      .eq("task_id", taskId)
      .maybeSingle<ReviewRow>();

    if (error) {
      throw new Error(`getReviewByTaskId failed: ${error.message}`);
    }

    return data ? fromReviewRow(data) : undefined;
  }

  public async listReviews(input: {
    statuses?: ReviewQueueStatus[];
    limit?: number;
    cursor?: Date;
  }): Promise<ReviewQueueItem[]> {
    const supabase = createAdminClient();
    let query = supabase
      .from("ai_review_queue")
      .select("*, personas:persona_id(username, display_name, avatar_url)")
      .order("created_at", { ascending: false });

    if (input.statuses?.length) {
      query = query.in("status", input.statuses);
    }
    if (input.cursor) {
      query = query.lt("created_at", input.cursor.toISOString());
    }
    if (input.limit && input.limit > 0) {
      query = query.limit(input.limit);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`listReviews failed: ${error.message}`);
    }

    return (data ?? []).map((row) => fromReviewRow(row as ReviewRow));
  }

  public async countReviews(input: { statuses?: ReviewQueueStatus[] }): Promise<number> {
    const supabase = createAdminClient();
    let query = supabase.from("ai_review_queue").select("*", { count: "exact", head: true });
    if (input.statuses?.length) {
      query = query.in("status", input.statuses);
    }

    const { count, error } = await query;
    if (error) {
      throw new Error(`countReviews failed: ${error.message}`);
    }

    return count ?? 0;
  }

  public async listReviewEvents(input: {
    reviewId?: string;
    limit?: number;
  }): Promise<ReviewQueueEvent[]> {
    const supabase = createAdminClient();
    let query = supabase
      .from("ai_review_events")
      .select("*")
      .order("created_at", { ascending: false });

    if (input.reviewId) {
      query = query.eq("review_id", input.reviewId);
    }
    if (input.limit && input.limit > 0) {
      query = query.limit(input.limit);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`listReviewEvents failed: ${error.message}`);
    }

    return (data ?? []).map((row) => fromReviewEventRow(row as ReviewEventRow));
  }

  public async createReview(input: {
    taskId: string;
    personaId: string;
    riskLevel: ReviewRiskLevel;
    enqueueReasonCode: string;
    note?: string;
    now: Date;
    metadata?: Record<string, unknown>;
  }): Promise<ReviewQueueItem> {
    const supabase = createAdminClient();
    const existing = await this.getReviewByTaskId(input.taskId);
    if (existing) {
      return existing;
    }

    const { data, error } = await supabase
      .from("ai_review_queue")
      .insert({
        task_id: input.taskId,
        persona_id: input.personaId,
        risk_level: input.riskLevel,
        enqueue_reason_code: input.enqueueReasonCode,
        note: input.note ?? null,
        metadata: input.metadata ?? {},
        created_at: input.now.toISOString(),
        updated_at: input.now.toISOString(),
        expires_at: new Date(input.now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("*, personas:persona_id(username, display_name, avatar_url)")
      .single<ReviewRow>();

    if (error) {
      throw new Error(`createReview failed: ${error.message}`);
    }

    return fromReviewRow(data);
  }

  public async claimReview(input: {
    reviewId: string;
    reviewerId: string;
    now: Date;
  }): Promise<ReviewQueueItem | null> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("ai_review_queue")
      .update({
        status: "IN_REVIEW",
        reviewer_id: input.reviewerId,
        claimed_at: input.now.toISOString(),
        updated_at: input.now.toISOString(),
      })
      .eq("id", input.reviewId)
      .eq("status", "PENDING")
      .select("*, personas:persona_id(username, display_name, avatar_url)")
      .maybeSingle<ReviewRow>();

    if (error) {
      throw new Error(`claimReview failed: ${error.message}`);
    }

    if (data) {
      return fromReviewRow(data);
    }

    const already = await this.getReviewById(input.reviewId);
    if (already && already.status === "IN_REVIEW" && already.reviewerId === input.reviewerId) {
      return already;
    }

    return null;
  }

  public async claimAtomic(input: {
    reviewId: string;
    reviewerId: string;
    now: Date;
  }): Promise<ReviewQueueItem | null> {
    return runInPostgresTransaction(async (client) => {
      const updated = await client.query(
        `update public.ai_review_queue
         set status = 'IN_REVIEW',
             reviewer_id = $2,
             claimed_at = $3,
             updated_at = $3
         where id = $1
           and status = 'PENDING'
         returning *`,
        [input.reviewId, input.reviewerId, input.now.toISOString()],
      );

      let row = updated.rows[0] as ReviewRow | undefined;
      if (!row) {
        const existing = await client.query(
          `select *
           from public.ai_review_queue
           where id = $1
             and status = 'IN_REVIEW'
             and reviewer_id = $2`,
          [input.reviewId, input.reviewerId],
        );
        row = existing.rows[0] as ReviewRow | undefined;
        if (!row) {
          return null;
        }
      }

      await client.query(
        `insert into public.ai_review_events (
           review_id, task_id, event_type, reviewer_id, created_at
         ) values ($1, $2, 'CLAIMED', $3, $4)`,
        [row.id, row.task_id, input.reviewerId, input.now.toISOString()],
      );

      return fromReviewRow(row);
    });
  }

  public async decideReview(input: {
    reviewId: string;
    reviewerId: string;
    status: "APPROVED" | "REJECTED";
    decision: "APPROVE" | "REJECT";
    reasonCode: string;
    note?: string;
    now: Date;
  }): Promise<ReviewQueueItem | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ai_review_queue")
      .update({
        status: input.status,
        decision: input.decision,
        decision_reason_code: input.reasonCode,
        reviewer_id: input.reviewerId,
        note: input.note ?? null,
        decided_at: input.now.toISOString(),
        updated_at: input.now.toISOString(),
      })
      .eq("id", input.reviewId)
      .in("status", ["PENDING", "IN_REVIEW"])
      .select("*, personas:persona_id(username, display_name, avatar_url)")
      .maybeSingle<ReviewRow>();

    if (error) {
      throw new Error(`decideReview failed: ${error.message}`);
    }

    return data ? fromReviewRow(data) : null;
  }

  public async approveAtomic(input: {
    reviewId: string;
    reviewerId: string;
    reasonCode: string;
    note?: string;
    now: Date;
  }): Promise<ReviewQueueItem | null> {
    return runInPostgresTransaction(async (client) => {
      const reviewRes = await client.query(
        `select *
           from public.ai_review_queue
           where id = $1
           for update`,
        [input.reviewId],
      );
      const review = reviewRes.rows[0] as ReviewRow | undefined;
      if (!review || !["PENDING", "IN_REVIEW"].includes(review.status)) {
        return null;
      }

      const taskRes = await client.query(
        `select *
           from public.persona_tasks
           where id = $1
           for update`,
        [review.task_id],
      );
      const task = taskRes.rows[0] as
        | {
            id: string;
            persona_id: string;
            task_type: string;
            status: string;
            retry_count: number;
          }
        | undefined;
      if (!task) {
        throw new Error(`task not found for review ${input.reviewId}`);
      }

      if (!["RUNNING", "IN_REVIEW", "PENDING"].includes(task.status)) {
        throw new Error(`task ${task.id} invalid status ${task.status} for review approve`);
      }

      const nowIso = input.now.toISOString();
      const updatedReviewRes = await client.query(
        `update public.ai_review_queue
           set status = 'APPROVED',
               decision = 'APPROVE',
               decision_reason_code = $2,
               reviewer_id = $3,
               note = $4,
               decided_at = $5,
               updated_at = $5
           where id = $1
           returning *`,
        [input.reviewId, input.reasonCode, input.reviewerId, input.note ?? null, nowIso],
      );
      const updatedReview = updatedReviewRes.rows[0] as ReviewRow;

      await client.query(
        `update public.persona_tasks
           set status = 'PENDING',
               scheduled_at = $2,
               started_at = null,
               completed_at = null,
               lease_owner = null,
               lease_until = null,
               error_message = null
           where id = $1`,
        [review.task_id, nowIso],
      );

      await client.query(
        `insert into public.ai_review_events (
             review_id, task_id, event_type, reason_code, reviewer_id, note, created_at
           ) values ($1, $2, 'APPROVED', $3, $4, $5, $6)`,
        [review.id, review.task_id, input.reasonCode, input.reviewerId, input.note ?? null, nowIso],
      );

      await client.query(
        `insert into public.task_transition_events (
             task_id, persona_id, task_type, from_status, to_status, reason_code, worker_id, retry_count, created_at
           ) values ($1, $2, $3, $4, 'PENDING', 'REVIEW_APPROVED', $5, $6, $7)`,
        [
          task.id,
          task.persona_id,
          task.task_type,
          task.status,
          `reviewer:${input.reviewerId}`,
          task.retry_count,
          nowIso,
        ],
      );

      return fromReviewRow(updatedReview);
    });
  }

  public async rejectAtomic(input: {
    reviewId: string;
    reviewerId: string;
    reasonCode: string;
    note?: string;
    now: Date;
  }): Promise<ReviewQueueItem | null> {
    return runInPostgresTransaction(async (client) => {
      const reviewRes = await client.query(
        `select *
           from public.ai_review_queue
           where id = $1
           for update`,
        [input.reviewId],
      );
      const review = reviewRes.rows[0] as ReviewRow | undefined;
      if (!review || !["PENDING", "IN_REVIEW"].includes(review.status)) {
        return null;
      }

      const taskRes = await client.query(
        `select *
           from public.persona_tasks
           where id = $1
           for update`,
        [review.task_id],
      );
      const task = taskRes.rows[0] as
        | {
            id: string;
            persona_id: string;
            task_type: string;
            status: string;
            retry_count: number;
          }
        | undefined;
      if (!task) {
        throw new Error(`task not found for review ${input.reviewId}`);
      }

      if (!["RUNNING", "IN_REVIEW", "PENDING"].includes(task.status)) {
        throw new Error(`task ${task.id} invalid status ${task.status} for review reject`);
      }

      const nowIso = input.now.toISOString();
      const updatedReviewRes = await client.query(
        `update public.ai_review_queue
           set status = 'REJECTED',
               decision = 'REJECT',
               decision_reason_code = $2,
               reviewer_id = $3,
               note = $4,
               decided_at = $5,
               updated_at = $5
           where id = $1
           returning *`,
        [input.reviewId, input.reasonCode, input.reviewerId, input.note ?? null, nowIso],
      );
      const updatedReview = updatedReviewRes.rows[0] as ReviewRow;

      await client.query(
        `update public.persona_tasks
           set status = 'SKIPPED',
               completed_at = $2,
               lease_owner = null,
               lease_until = null,
               error_message = $3
           where id = $1`,
        [review.task_id, nowIso, input.reasonCode],
      );

      await client.query(
        `insert into public.ai_review_events (
             review_id, task_id, event_type, reason_code, reviewer_id, note, created_at
           ) values ($1, $2, 'REJECTED', $3, $4, $5, $6)`,
        [review.id, review.task_id, input.reasonCode, input.reviewerId, input.note ?? null, nowIso],
      );

      await client.query(
        `insert into public.task_transition_events (
             task_id, persona_id, task_type, from_status, to_status, reason_code, worker_id, retry_count, created_at
           ) values ($1, $2, $3, $4, 'SKIPPED', 'REVIEW_REJECTED', $5, $6, $7)`,
        [
          task.id,
          task.persona_id,
          task.task_type,
          task.status,
          `reviewer:${input.reviewerId}`,
          task.retry_count,
          nowIso,
        ],
      );

      return fromReviewRow(updatedReview);
    });
  }

  public async expireDue(input: { now: Date; reasonCode: string }): Promise<ReviewQueueItem[]> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("ai_review_queue")
      .update({
        status: "EXPIRED",
        decision: null,
        decision_reason_code: input.reasonCode,
        decided_at: input.now.toISOString(),
        updated_at: input.now.toISOString(),
      })
      .in("status", ["PENDING", "IN_REVIEW"])
      .lte("expires_at", input.now.toISOString())
      .select("*, personas:persona_id(username, display_name, avatar_url)");

    if (error) {
      throw new Error(`expireDue failed: ${error.message}`);
    }

    return (data ?? []).map((row) => fromReviewRow(row as ReviewRow));
  }

  public async expireDueAtomic(input: { now: Date }): Promise<number> {
    return runInPostgresTransaction(async (client) => {
      const nowIso = input.now.toISOString();
      const dueRes = await client.query(
        `select *
           from public.ai_review_queue
           where status in ('PENDING', 'IN_REVIEW')
             and expires_at <= $1
           for update skip locked`,
        [nowIso],
      );

      const due = dueRes.rows as ReviewRow[];
      let count = 0;

      for (const review of due) {
        const taskRes = await client.query(
          `select *
             from public.persona_tasks
             where id = $1
             for update`,
          [review.task_id],
        );
        const task = taskRes.rows[0] as
          | {
              id: string;
              persona_id: string;
              task_type: string;
              status: string;
              retry_count: number;
            }
          | undefined;

        if (!task) {
          throw new Error(`task not found for review ${review.id}`);
        }
        if (!["RUNNING", "IN_REVIEW", "PENDING"].includes(task.status)) {
          throw new Error(`task ${task.id} invalid status ${task.status} for review expire`);
        }

        await client.query(
          `update public.ai_review_queue
             set status = 'EXPIRED',
                 decision = null,
                 decision_reason_code = 'review_timeout_expired',
                 decided_at = $2,
                 updated_at = $2
             where id = $1`,
          [review.id, nowIso],
        );

        await client.query(
          `update public.persona_tasks
             set status = 'SKIPPED',
                 completed_at = $2,
                 lease_owner = null,
                 lease_until = null,
                 error_message = 'review_timeout_expired'
             where id = $1`,
          [review.task_id, nowIso],
        );

        await client.query(
          `insert into public.ai_review_events (
               review_id, task_id, event_type, reason_code, created_at
             ) values ($1, $2, 'EXPIRED', 'review_timeout_expired', $3)`,
          [review.id, review.task_id, nowIso],
        );

        await client.query(
          `insert into public.task_transition_events (
               task_id, persona_id, task_type, from_status, to_status, reason_code, retry_count, created_at
             ) values ($1, $2, $3, $4, 'SKIPPED', 'REVIEW_EXPIRED', $5, $6)`,
          [task.id, task.persona_id, task.task_type, task.status, task.retry_count, nowIso],
        );

        count += 1;
      }

      return count;
    });
  }

  public async getTaskById(taskId: string): Promise<ReviewQueueTask | undefined> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("persona_tasks")
      .select("*")
      .eq("id", taskId)
      .maybeSingle<TaskRow>();

    if (error) {
      throw new Error(`getTaskById failed: ${error.message}`);
    }

    return data ? fromTaskRow(data) : undefined;
  }

  public async updateTaskForReviewDecision(input: {
    taskId: string;
    status: "PENDING" | "SKIPPED";
    reasonCode?: string;
    now: Date;
  }): Promise<ReviewQueueTask | null> {
    const supabase = createAdminClient();
    const patch =
      input.status === "PENDING"
        ? {
            status: "PENDING",
            scheduled_at: input.now.toISOString(),
            started_at: null,
            completed_at: null,
            lease_owner: null,
            lease_until: null,
            error_message: null,
          }
        : {
            status: "SKIPPED",
            completed_at: input.now.toISOString(),
            lease_owner: null,
            lease_until: null,
            error_message: input.reasonCode ?? null,
          };

    const { data, error } = await supabase
      .from("persona_tasks")
      .update(patch)
      .eq("id", input.taskId)
      .in("status", ["IN_REVIEW", "PENDING", "RUNNING"])
      .select("*")
      .maybeSingle<TaskRow>();

    if (error) {
      throw new Error(`updateTaskForReviewDecision failed: ${error.message}`);
    }

    return data ? fromTaskRow(data) : null;
  }

  public async recordEvent(event: ReviewQueueEvent): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from("ai_review_events").insert({
      review_id: event.reviewId,
      task_id: event.taskId,
      event_type: event.eventType,
      reason_code: event.reasonCode ?? null,
      reviewer_id: event.reviewerId ?? null,
      note: event.note ?? null,
      metadata: event.metadata ?? {},
      created_at: event.createdAt.toISOString(),
    });

    if (error) {
      throw new Error(`recordEvent failed: ${error.message}`);
    }
  }
}
