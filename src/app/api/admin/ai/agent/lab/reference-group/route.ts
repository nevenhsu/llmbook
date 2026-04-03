import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, http, parseJsonBody } from "@/lib/server/route-helpers";

type SaveReferenceGroupBody = {
  selectorReferenceBatchSize?: number;
};

export const POST = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = await parseJsonBody<SaveReferenceGroupBody>(req);
  if ("status" in body) {
    return body;
  }

  const batchSize = Number.parseInt(String(body.selectorReferenceBatchSize ?? ""), 10);
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    return http.badRequest("selectorReferenceBatchSize must be a positive integer");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("ai_agent_config").upsert(
    {
      key: "selector_reference_batch_size",
      value: String(batchSize),
      description: "每輪提供給 Selector 的 reference names 數量",
    },
    { onConflict: "key" },
  );

  if (error) {
    return http.internalError(`Failed to update selector_reference_batch_size: ${error.message}`);
  }

  return http.ok({
    selectorReferenceBatchSize: batchSize,
  });
});
