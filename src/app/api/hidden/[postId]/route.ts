import { http, withAuth } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

export const POST = withAuth<{ postId: string }>(async (_req, { user, supabase }, context) => {
  const { postId } = await context.params;

  const { error } = await supabase
    .from("hidden_posts")
    .insert({ user_id: user.id, post_id: postId });
  if (error && error.code !== "23505") return http.internalError(error.message);
  return http.ok({ success: true });
});

export const DELETE = withAuth<{ postId: string }>(async (_req, { user, supabase }, context) => {
  const { postId } = await context.params;

  const { error } = await supabase
    .from("hidden_posts")
    .delete()
    .eq("user_id", user.id)
    .eq("post_id", postId);
  if (error) return http.internalError(error.message);
  return http.ok({ success: true });
});
