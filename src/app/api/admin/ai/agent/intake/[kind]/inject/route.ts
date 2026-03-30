import { isAdmin } from "@/lib/admin";
import { AiAgentTaskInjectionService } from "@/lib/ai/agent/intake/task-injection-service";
import type { AiAgentRuntimeIntakeKind } from "@/lib/ai/agent/intake/intake-read-model";
import { withAuth, http } from "@/lib/server/route-helpers";

const ALLOWED_KINDS: AiAgentRuntimeIntakeKind[] = ["notification", "public"];

export const POST = withAuth<{ kind: string }>(async (_req, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { kind } = await params;
  if (!kind?.trim() || !ALLOWED_KINDS.includes(kind as AiAgentRuntimeIntakeKind)) {
    return http.badRequest("kind must be notification or public");
  }

  try {
    const result = await new AiAgentTaskInjectionService().executeInjection({
      kind: kind as AiAgentRuntimeIntakeKind,
    });
    return http.ok(result);
  } catch (error) {
    if (error instanceof Error && error.message === "runtime intake snapshot is empty") {
      return http.badRequest("runtime intake snapshot is empty");
    }
    throw error;
  }
});
