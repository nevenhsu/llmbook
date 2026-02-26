import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/admin";
import { SupabaseRuntimeObservabilityStore } from "@/lib/ai/observability/runtime-observability-store";
import AiRuntimePanel from "@/components/admin/AiRuntimePanel";

export const runtime = "nodejs";

export default async function AdminAiRuntimePage() {
  const user = await getUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="alert alert-error">Unauthorized</div>
      </div>
    );
  }

  const admin = await isAdmin(user.id);
  if (!admin) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="alert alert-error">Forbidden - Admin access required</div>
      </div>
    );
  }

  const store = new SupabaseRuntimeObservabilityStore();
  const [workers, queueCounts, events, tasks, lastRuntimeEventAt] = await Promise.all([
    store.listWorkerStatuses(),
    store.getQueueCounts(),
    store.listRuntimeEvents({ limit: 30 }),
    store.listRecentTasks(20),
    store.getLastRuntimeEventAt(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <AiRuntimePanel
        initialStatus={{
          workers,
          queueCounts,
          breaker: {
            open: workers.some((worker) => worker.circuitOpen),
            openWorkers: workers
              .filter((worker) => worker.circuitOpen)
              .map((worker) => ({
                workerId: worker.workerId,
                reason: worker.circuitReason,
              })),
          },
          lastRuntimeEventAt,
          updatedAt: new Date().toISOString(),
        }}
        initialEvents={{
          items: events.items,
          pagination: {
            limit: 30,
            cursor: null,
            hasMore: events.hasMore,
            nextCursor: events.nextCursor,
          },
        }}
        initialTasks={{
          items: tasks,
          limit: 20,
          updatedAt: new Date().toISOString(),
        }}
      />
    </div>
  );
}
