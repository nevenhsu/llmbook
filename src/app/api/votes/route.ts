import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { NOTIFICATION_TYPES } from "@/types/notification";
import { withAuth, http, parseJsonBody, validateBody } from "@/lib/server/route-helpers";
import { isUserBanned } from "@/lib/board-permissions";
import { shouldNotifyUpvote, getReachedMilestone } from "@/lib/notification-throttle";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// POST /api/votes - Cast or update a vote
export const POST = withAuth(async (req, { user, supabase }) => {
  // Parse and validate body
  const bodyResult = await parseJsonBody<{ postId?: string; commentId?: string; value: number }>(
    req,
  );
  if (bodyResult instanceof NextResponse) return bodyResult;

  const validation = validateBody(bodyResult, ["value"]);
  if (!validation.valid) return validation.response;

  const { postId, commentId, value } = validation.data;

  // Validate value is 1 or -1
  if (![1, -1].includes(value)) {
    return http.badRequest("Invalid input");
  }

  // Must have either postId or commentId
  if (!postId && !commentId) {
    return http.badRequest("Invalid input");
  }

  const targetField = postId ? "post_id" : "comment_id";
  const targetId = postId || commentId;

  let boardId: string | null = null;

  if (postId) {
    const { data: post } = await supabase
      .from("posts")
      .select("board_id, status")
      .eq("id", postId)
      .single();

    if (!post) return http.notFound("Post not found");
    if (post.status === "DELETED" || post.status === "ARCHIVED") {
      return http.forbidden("Cannot vote on this post");
    }

    boardId = post.board_id || null;
  }

  if (commentId) {
    const { data: comment } = await supabase
      .from("comments")
      .select("post_id")
      .eq("id", commentId)
      .single();

    if (comment?.post_id) {
      const { data: post } = await supabase
        .from("posts")
        .select("board_id, status")
        .eq("id", comment.post_id)
        .single();

      if (post?.status === "DELETED" || post?.status === "ARCHIVED") {
        return http.forbidden("Cannot vote on this post");
      }

      boardId = post?.board_id || null;
    }
  }

  if (boardId) {
    const banned = await isUserBanned(boardId, user.id, supabase);
    if (banned) {
      return http.forbidden("You are banned from this board");
    }
  }

  // Check for existing vote
  const { data: existingVote } = await supabase
    .from("votes")
    .select("id, value")
    .eq("user_id", user.id)
    .eq(targetField, targetId)
    .maybeSingle();

  if (existingVote) {
    if (existingVote.value === value) {
      // Toggle off
      await supabase.from("votes").delete().eq("id", existingVote.id);
    } else {
      // Change vote
      await supabase.from("votes").update({ value }).eq("id", existingVote.id);
    }
  } else {
    // New vote
    await supabase.from("votes").insert({
      user_id: user.id,
      [targetField]: targetId,
      value,
    });

    // Trigger notification for upvote
    if (value === 1) {
      await triggerUpvoteNotification(supabase, postId, commentId, user.id);
    }
  }

  // Fetch updated score
  const { data: updatedTarget } = await supabase
    .from(postId ? "posts" : "comments")
    .select("score")
    .eq("id", targetId)
    .single();

  return http.ok({ score: updatedTarget?.score ?? 0 });
});

// Helper to trigger notifications with milestone throttling
async function triggerUpvoteNotification(
  supabase: SupabaseClient,
  postId: string | undefined,
  commentId: string | undefined,
  voterId: string,
) {
  if (postId) {
    const { data: post } = await supabase
      .from("posts")
      .select("author_id, title, score")
      .eq("id", postId)
      .single();

    if (post?.author_id && post.author_id !== voterId) {
      // Calculate old score (before this upvote)
      const newScore = post.score;
      const oldScore = newScore - 1;

      // Only notify if we crossed a milestone
      if (shouldNotifyUpvote(oldScore, newScore)) {
        const milestone = getReachedMilestone(oldScore, newScore);
        await createNotification(post.author_id, NOTIFICATION_TYPES.POST_UPVOTE, {
          postId,
          postTitle: post.title,
          milestone: milestone || undefined,
        });
      }
    }
  } else if (commentId) {
    const { data: comment } = await supabase
      .from("comments")
      .select("author_id, post_id, score")
      .eq("id", commentId)
      .single();

    if (comment?.author_id && comment.author_id !== voterId) {
      // Calculate old score (before this upvote)
      const newScore = comment.score;
      const oldScore = newScore - 1;

      // Only notify if we crossed a milestone
      if (shouldNotifyUpvote(oldScore, newScore)) {
        const milestone = getReachedMilestone(oldScore, newScore);
        await createNotification(comment.author_id, NOTIFICATION_TYPES.COMMENT_UPVOTE, {
          postId: comment.post_id,
          commentId,
          milestone: milestone || undefined,
        });
      }
    }
  }
}
