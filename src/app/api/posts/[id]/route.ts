import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { canManageBoardPosts } from "@/lib/board-permissions";
import { http, parseJsonBody, withAuth } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      `id,title,body,status,created_at,
       boards(name,slug),
       profiles(username, display_name),
       media(id,url),
       post_tags(tag:tags(name,slug))`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return http.notFound("Not found");
  }

  // Strip body for deleted posts
  if (data.status === "DELETED") {
    data.body = null;
  }

  return NextResponse.json(data);
}

export const DELETE = withAuth<{ id: string }>(async (_request, { user, supabase }, context) => {
  const { id } = await context.params;
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, author_id, status")
    .eq("id", id)
    .maybeSingle();

  if (postError || !post) {
    return http.notFound("Not found");
  }

  if (post.author_id !== user.id) {
    return http.forbidden("Forbidden: Only author can delete");
  }

  if (post.status === "DELETED") {
    return http.ok({ success: true });
  }

  const { error: updateError } = await supabase
    .from("posts")
    .update({
      status: "DELETED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("author_id", user.id);

  if (updateError) {
    return http.badRequest(updateError.message);
  }

  return http.ok({ success: true });
});

export const PATCH = withAuth<{ id: string }>(async (request, { user, supabase }, context) => {
  const { id } = await context.params;

  const payload = await parseJsonBody<{
    status?: unknown;
    title?: unknown;
    body?: unknown;
    tagIds?: unknown;
    newPollOptions?: unknown;
  }>(request);
  if (payload instanceof NextResponse) {
    return payload;
  }

  const nextStatus = payload.status;
  const title = payload.title;
  const body = payload.body;
  const tagIds = payload.tagIds;
  const newPollOptions = payload.newPollOptions;

  // Fetch post with author info
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, author_id, board_id, post_type")
    .eq("id", id)
    .maybeSingle();

  if (postError || !post) {
    return http.notFound("Not found");
  }

  // Handle status update (Archive/Unarchive - admin/moderator only)
  if (nextStatus && (nextStatus === "ARCHIVED" || nextStatus === "PUBLISHED")) {
    const userIsAdmin = await isAdmin(user.id);
    const canManagePosts =
      userIsAdmin || (await canManageBoardPosts(post.board_id, user.id, supabase));

    if (!canManagePosts) {
      return http.forbidden("Forbidden: Missing manage_posts permission");
    }

    const { data: updatedPost, error: updateError } = await supabase
      .from("posts")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, status")
      .single();

    if (updateError) {
      return http.badRequest(updateError.message);
    }

    return http.ok({ post: updatedPost });
  }

  // Handle content update (author only)
  if (post.author_id !== user.id) {
    return http.forbidden("Forbidden: Only author can edit content");
  }

  // Build update object
  const updates: {
    updated_at: string;
    title?: string;
    body?: string | null;
  } = { updated_at: new Date().toISOString() };

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      return http.badRequest("Title is required");
    }
    updates.title = title.trim();
  }

  if (body !== undefined) {
    if (typeof body === "string" || body === null) {
      updates.body = body;
    } else {
      return http.badRequest("Invalid body");
    }
  }

  // Update post
  const { error: updateError } = await supabase.from("posts").update(updates).eq("id", id);

  if (updateError) {
    return http.badRequest(updateError.message);
  }

  // Update tags if provided
  if (tagIds !== undefined && Array.isArray(tagIds)) {
    // Delete existing tags
    await supabase.from("post_tags").delete().eq("post_id", id);

    // Insert new tags
    if (tagIds.length > 0) {
      const tagInserts = tagIds.map((tagId) => ({
        post_id: id,
        tag_id: tagId,
      }));
      await supabase.from("post_tags").insert(tagInserts);
    }
  }

  // Add new poll options if provided (for poll posts only)
  if (
    newPollOptions &&
    Array.isArray(newPollOptions) &&
    newPollOptions.length > 0 &&
    post.post_type === "poll"
  ) {
    const trimmedNewOptions = newPollOptions
      .filter((opt: unknown): opt is string => typeof opt === "string")
      .map((opt) => opt.trim())
      .filter((opt) => opt.length > 0);

    // Append options at the end by position
    const { data: lastOption } = await supabase
      .from("poll_options")
      .select("position")
      .eq("post_id", id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const startPosition = (lastOption?.position ?? -1) + 1;

    const optionInserts = trimmedNewOptions.map((text, idx) => ({
      post_id: id,
      text,
      position: startPosition + idx,
    }));

    if (optionInserts.length > 0) {
      await supabase.from("poll_options").insert(optionInserts);
    }
  }

  return http.ok({ success: true });
});
