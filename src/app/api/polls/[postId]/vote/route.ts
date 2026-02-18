import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUserBanned } from "@/lib/board-permissions";
import { http, parseJsonBody, withAuth } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

/**
 * POST /api/polls/[postId]/vote
 * Vote on a poll (authenticated users only)
 */
export const POST = withAuth<{ postId: string }>(async (request, { user, supabase }, context) => {
  const { postId } = await context.params;
  const body = await parseJsonBody<{ optionId?: unknown }>(request);
  if (body instanceof NextResponse) {
    return body;
  }

  const optionId = body.optionId;
  if (!optionId || typeof optionId !== "string") {
    return http.badRequest("Missing optionId");
  }

  // Verify post is a poll
  const { data: post } = await supabase
    .from("posts")
    .select("post_type, board_id, status")
    .eq("id", postId)
    .single();

  if (!post) {
    return http.notFound("Post not found");
  }

  if (post.post_type !== "poll") {
    return http.badRequest("Post is not a poll");
  }

  if (post.status === "DELETED" || post.status === "ARCHIVED") {
    return http.forbidden("Cannot vote on this post");
  }

  const banned = await isUserBanned(post.board_id, user.id, supabase);
  if (banned) {
    return http.forbidden("You are banned from this board");
  }

  // Verify option belongs to this post
  const { data: option } = await supabase
    .from("poll_options")
    .select("id, post_id")
    .eq("id", optionId)
    .single();

  if (!option || option.post_id !== postId) {
    return http.badRequest("Invalid option for this poll");
  }

  // Check if user already voted
  const { data: existingVote } = await supabase
    .from("poll_votes")
    .select("option_id")
    .eq("user_id", user.id)
    .eq("option_id", optionId)
    .maybeSingle();

  // Also check if user voted on any option for this poll
  const { data: allOptions } = await supabase
    .from("poll_options")
    .select("id")
    .eq("post_id", postId);

  if (allOptions) {
    const optionIds = allOptions.map((o) => o.id);
    const { data: anyVote } = await supabase
      .from("poll_votes")
      .select("option_id")
      .eq("user_id", user.id)
      .in("option_id", optionIds)
      .maybeSingle();

    if (anyVote) {
      return http.conflict("You have already voted on this poll");
    }
  }

  // Record vote
  const { error: voteError } = await supabase.from("poll_votes").insert({
    user_id: user.id,
    option_id: optionId,
  });

  if (voteError) {
    if (voteError.code === "23505") {
      // Unique violation
      return http.conflict("You have already voted");
    }
    return http.badRequest(voteError.message);
  }

  // Get updated options with vote counts
  const { data: updatedOptions, error: optionsError } = await supabase
    .from("poll_options")
    .select("id, text, vote_count, position")
    .eq("post_id", postId)
    .order("position");

  if (optionsError) {
    return http.internalError(optionsError.message);
  }

  return http.ok({
    userVote: optionId,
    options: updatedOptions,
  });
});

/**
 * GET /api/polls/[postId]/vote
 * Get poll results and user's vote if any
 */
export async function GET(request: Request, context: { params: Promise<{ postId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { postId } = await context.params;

  // Get poll options
  const { data: options, error: optionsError } = await supabase
    .from("poll_options")
    .select("id, text, vote_count, position")
    .eq("post_id", postId)
    .order("position");

  if (optionsError) {
    return http.internalError(optionsError.message);
  }

  let userVote = null;

  // If user is logged in, get their vote
  if (user && options) {
    const optionIds = options.map((o) => o.id);
    const { data: vote } = await supabase
      .from("poll_votes")
      .select("option_id")
      .eq("user_id", user.id)
      .in("option_id", optionIds)
      .maybeSingle();

    if (vote) {
      userVote = vote.option_id;
    }
  }

  return http.ok({
    options: options || [],
    userVote,
  });
}
