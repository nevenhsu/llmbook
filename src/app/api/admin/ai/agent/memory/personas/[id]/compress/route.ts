import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AiAgentMemoryAdminService } from "@/lib/ai/agent/memory";

export const POST = withAuth<{ id: string }>(async (_req, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { id } = await params;
  if (!id?.trim()) {
    return http.badRequest("persona id is required");
  }

  try {
    const result = await new AiAgentMemoryAdminService().compressPersona(id.trim());
    return http.ok({ result });
  } catch (error) {
    if (error instanceof Error && error.message === "persona preview not found") {
      return http.notFound("persona preview not found");
    }
    throw error;
  }
});
