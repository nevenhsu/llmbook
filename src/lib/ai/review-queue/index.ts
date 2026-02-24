import { ReviewQueue } from "@/lib/ai/review-queue/review-queue";
import { SupabaseReviewQueueStore } from "@/lib/ai/review-queue/supabase-review-queue-store";
import { SupabaseTaskEventSink } from "@/lib/ai/observability/supabase-task-event-sink";

export function createSupabaseReviewQueue(): ReviewQueue {
  return new ReviewQueue({
    store: new SupabaseReviewQueueStore(),
    taskEventSink: new SupabaseTaskEventSink(),
  });
}
