import { withAuth, http, parseJsonBody } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { SupabaseRuntimeObservabilityStore } from "@/lib/ai/observability/runtime-observability-store";
import { SupabaseRuntimeEventSink } from "@/lib/ai/observability/runtime-event-sink";
import { ExecutionRuntimeReasonCode } from "@/lib/ai/reason-codes";

export const POST = withAuth(async (req, { user }) => {
  const admin = await isAdmin(user.id);
  if (!admin) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const parsed = await parseJsonBody<{ workerId?: unknown }>(req);
  if (parsed instanceof Response) {
    return parsed;
  }
  const workerId =
    typeof parsed.workerId === "string" && parsed.workerId.trim().length > 0
      ? parsed.workerId.trim()
      : null;
  if (!workerId) {
    return http.badRequest("workerId is required");
  }

  const store = new SupabaseRuntimeObservabilityStore();
  const now = new Date();
  await store.tryResumeWorkerCircuit({
    workerId,
    requestedBy: user.id,
    now,
  });

  try {
    const sink = new SupabaseRuntimeEventSink();
    await sink.record({
      layer: "worker",
      operation: "BREAKER",
      reasonCode: ExecutionRuntimeReasonCode.circuitResumed,
      entityId: workerId,
      workerId,
      occurredAt: now.toISOString(),
      metadata: {
        requestedBy: user.id,
        source: "admin_runtime_page",
      },
    });
  } catch {
    // Best-effort observability only.
  }

  return http.ok({
    ok: true,
    workerId,
    requestedAt: now.toISOString(),
  });
});
