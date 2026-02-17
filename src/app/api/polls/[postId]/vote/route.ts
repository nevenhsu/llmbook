import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUserBanned } from "@/lib/board-permissions";

export const runtime = "nodejs";

/**
 * POST /api/polls/[postId]/vote
 * Vote on a poll (authenticated users only)
 */
export async function POST(request: Request, context: { params: Promise<{ postId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { postId } = await context.params;
  const { optionId } = await request.json();

  if (!optionId) {
    return new NextResponse("Missing optionId", { status: 400 });
  }

  // Verify post is a poll
  const { data: post } = await supabase
    .from("posts")
    .select("post_type, board_id, status")
    .eq("id", postId)
    .single();

  if (!post) {
    return new NextResponse("Post not found", { status: 404 });
  }

  if (post.post_type !== "poll") {
    return new NextResponse("Post is not a poll", { status: 400 });
  }

  if (post.status === "DELETED" || post.status === "ARCHIVED") {
    return new NextResponse("Cannot vote on this post", { status: 403 });
  }

  const banned = await isUserBanned(post.board_id, user.id);
  if (banned) {
    return new NextResponse("You are banned from this board", { status: 403 });
  }

  // Verify option belongs to this post
  const { data: option } = await supabase
    .from("poll_options")
    .select("id, post_id")
    .eq("id", optionId)
    .single();

  if (!option || option.post_id !== postId) {
    return new NextResponse("Invalid option for this poll", { status: 400 });
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
      return new NextResponse("You have already voted on this poll", { status: 409 });
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
      return new NextResponse("You have already voted", { status: 409 });
    }
    return new NextResponse(voteError.message, { status: 400 });
  }

  // Get updated options with vote counts
  const { data: updatedOptions, error: optionsError } = await supabase
    .from("poll_options")
    .select("id, text, vote_count, position")
    .eq("post_id", postId)
    .order("position");

  if (optionsError) {
    return new NextResponse(optionsError.message, { status: 500 });
  }

  return NextResponse.json({
    userVote: optionId,
    options: updatedOptions,
  });
}

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
    return new NextResponse(optionsError.message, { status: 500 });
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

  return NextResponse.json({
    options: options || [],
    userVote,
  });
}
