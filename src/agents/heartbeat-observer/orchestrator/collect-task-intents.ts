import {
  SupabaseHeartbeatSource,
  type HeartbeatEventSourceName,
} from "@/lib/ai/data-sources/supabase-heartbeat-source";
import { SupabaseTaskIntentRepository } from "@/lib/ai/contracts/task-intent-repository";
import { createAdminClient } from "@/lib/supabase/admin";

export type CollectTaskIntentsSummary = {
  scannedBySource: Record<HeartbeatEventSourceName, number>;
  createdIntents: number;
  skippedEvents: number;
};

function latestTimestamp(events: Array<{ createdAt: string }>): Date | null {
  if (!events.length) return null;
  let max = new Date(events[0]!.createdAt);
  for (const event of events) {
    const at = new Date(event.createdAt);
    if (at.getTime() > max.getTime()) {
      max = at;
    }
  }
  return max;
}

export async function collectTaskIntents(options?: {
  source?: SupabaseHeartbeatSource;
  intentRepo?: SupabaseTaskIntentRepository;
  sources?: HeartbeatEventSourceName[];
  isPostInteractable?: (postId: string) => Promise<boolean>;
}): Promise<CollectTaskIntentsSummary> {
  const source = options?.source ?? new SupabaseHeartbeatSource();
  const intentRepo = options?.intentRepo ?? new SupabaseTaskIntentRepository();
  const sources: HeartbeatEventSourceName[] = options?.sources ?? [
    "posts",
    "comments",
    "votes",
    "poll_votes",
    "notifications",
  ];

  const summary: CollectTaskIntentsSummary = {
    scannedBySource: {
      posts: 0,
      comments: 0,
      votes: 0,
      poll_votes: 0,
      notifications: 0,
    },
    createdIntents: 0,
    skippedEvents: 0,
  };
  const postInteractableCache = new Map<string, boolean>();

  const isPostInteractableDefault = async (postId: string): Promise<boolean> => {
    const cached = postInteractableCache.get(postId);
    if (cached !== undefined) {
      return cached;
    }

    const supabase = createAdminClient();
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("status, board_id")
      .eq("id", postId)
      .maybeSingle<{ status: string; board_id: string }>();

    if (postError || !post || post.status === "ARCHIVED" || post.status === "DELETED") {
      postInteractableCache.set(postId, false);
      return false;
    }

    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("is_archived")
      .eq("id", post.board_id)
      .maybeSingle<{ is_archived: boolean }>();

    const interactable = !boardError && Boolean(board) && board.is_archived !== true;
    postInteractableCache.set(postId, interactable);
    return interactable;
  };
  const isPostInteractable = options?.isPostInteractable ?? isPostInteractableDefault;

  for (const sourceName of sources) {
    const events = await source.fetchRecentEvents(sourceName);
    summary.scannedBySource[sourceName] = events.length;

    for (const event of events) {
      if (sourceName === "posts") {
        if (!(await isPostInteractable(event.sourceId))) {
          summary.skippedEvents += 1;
          continue;
        }

        const authorId = event.payload.authorId;
        if (typeof authorId !== "string" || !authorId) {
          summary.skippedEvents += 1;
          continue;
        }

        await intentRepo.upsertIntent({
          intentType: "reply",
          sourceTable: "posts",
          sourceId: event.sourceId,
          sourceCreatedAt: event.createdAt,
          payload: {
            postId: event.sourceId,
            parentCommentId: null,
            trigger: "new_post",
            sourceName,
          },
        });

        summary.createdIntents += 1;
        continue;
      }

      if (sourceName === "comments") {
        const authorId = event.payload.authorId;
        const postId = event.payload.postId;

        if (typeof authorId !== "string" || !authorId || typeof postId !== "string" || !postId) {
          summary.skippedEvents += 1;
          continue;
        }
        if (!(await isPostInteractable(postId))) {
          summary.skippedEvents += 1;
          continue;
        }

        await intentRepo.upsertIntent({
          intentType: "reply",
          sourceTable: "comments",
          sourceId: event.sourceId,
          sourceCreatedAt: event.createdAt,
          payload: {
            postId,
            parentCommentId: event.sourceId,
            trigger: "new_comment",
            sourceName,
          },
        });

        summary.createdIntents += 1;
        continue;
      }

      // Reply-only phase: keep other sources observed but not dispatched.
      summary.skippedEvents += 1;
    }

    const watermark = latestTimestamp(events);
    if (watermark) {
      const checkpoint = await source.getCheckpoint(sourceName);
      await source.upsertCheckpoint({
        sourceName,
        lastCapturedAt: watermark,
        safetyOverlapSeconds: checkpoint.safetyOverlapSeconds,
      });
    }
  }

  return summary;
}
