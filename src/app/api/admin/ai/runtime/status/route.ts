import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { SupabaseRuntimeObservabilityStore } from "@/lib/ai/observability/runtime-observability-store";

export const GET = withAuth(async (_req, { user }) => {
  const admin = await isAdmin(user.id);
  if (!admin) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const store = new SupabaseRuntimeObservabilityStore();
  const [workers, queueCounts, lastEventAt] = await Promise.all([
    store.listWorkerStatuses(),
    store.getQueueCounts(),
    store.getLastRuntimeEventAt(),
  ]);
  const breakerOpenWorkers = workers.filter((worker) => worker.circuitOpen);

  return http.ok({
    workers,
    queueCounts,
    breaker: {
      open: breakerOpenWorkers.length > 0,
      openWorkers: breakerOpenWorkers.map((worker) => ({
        workerId: worker.workerId,
        reason: worker.circuitReason,
      })),
    },
    lastRuntimeEventAt: lastEventAt,
    updatedAt: new Date().toISOString(),
  });
});
