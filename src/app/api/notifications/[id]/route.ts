import { withAuth, http } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

// DELETE /api/notifications/[id] - Soft delete a notification
export const DELETE = withAuth(
  async (req, { user, supabase }, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const { error } = await supabase
      .from("notifications")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting notification:", error);
      return http.internalError();
    }

    return http.ok({ success: true });
  },
);
