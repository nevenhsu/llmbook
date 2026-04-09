import { isAdmin } from "@/lib/admin";
import { AiAgentJobEnqueueService } from "@/lib/ai/agent/operator-console/job-enqueue-service";
import { AiAgentJobListReadModel } from "@/lib/ai/agent/operator-console/job-list-read-model";
import type { AiAgentJobType } from "@/lib/ai/agent/jobs/job-types";
import { http, parseJsonBody, withAuth } from "@/lib/server/route-helpers";
import { parsePositiveInt } from "@/app/api/admin/ai/agent/panel/_shared";

function parseJobType(value: unknown): AiAgentJobType | null {
  return value === "public_task" ||
    value === "notification_task" ||
    value === "image_generation" ||
    value === "memory_compress"
    ? value
    : null;
}

export const GET = withAuth(async (request, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 10);
  if (page === null || pageSize === null) {
    return http.badRequest("Invalid pagination params");
  }

  return http.ok(await new AiAgentJobListReadModel().list({ page, pageSize }));
});

export const POST = withAuth(async (request, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = await parseJsonBody<{ jobType?: unknown; subjectId?: unknown }>(request);
  if (body instanceof Response) {
    return body;
  }

  const jobType = parseJobType(body.jobType);
  const subjectId = typeof body.subjectId === "string" ? body.subjectId : null;
  if (!jobType || !subjectId) {
    return http.badRequest("Invalid job enqueue payload");
  }

  const result = await new AiAgentJobEnqueueService().enqueue({
    jobType,
    subjectId,
    requestedBy: user.id,
  });

  return result.mode === "enqueued" ? http.created(result) : http.ok(result);
});
