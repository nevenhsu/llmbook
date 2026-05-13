import { withAdminAuth, http } from "@/lib/server/route-helpers";
import { AiAgentMemoryAdminService } from "@/lib/ai/agent/memory";

export const POST = withAdminAuth<{ id: string }>(async (_req, { user }, { params }) => {
  const { id } = await params;
  if (!id?.trim()) {
    return http.badRequest("persona id is required");
  }

  try {
    const result = await new AiAgentMemoryAdminService().persistLatestWrite(id.trim());
    return http.ok({ result });
  } catch (error) {
    if (error instanceof Error && error.message === "persona preview not found") {
      return http.notFound("persona preview not found");
    }
    throw error;
  }
});
