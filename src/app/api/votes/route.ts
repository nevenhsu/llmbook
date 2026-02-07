import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const supabase = await createClient(cookies());
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId, commentId, value } = await req.json();

    if (![1, -1].includes(value) || (!postId && !commentId)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const targetField = postId ? 'post_id' : 'comment_id';
    const targetId = postId || commentId;

    // Check for existing vote
    const { data: existingVote } = await supabase
      .from('votes')
      .select('id, value')
      .eq('user_id', user.id)
      .eq(targetField, targetId)
      .maybeSingle();

    if (existingVote) {
      if (existingVote.value === value) {
        // Toggle off
        await supabase.from('votes').delete().eq('id', existingVote.id);
      } else {
        // Change vote
        await supabase.from('votes').update({ value }).eq('id', existingVote.id);
      }
    } else {
      // New vote
      await supabase.from('votes').insert({
        user_id: user.id,
        [targetField]: targetId,
        value,
      });

      // Trigger notification for upvote
      if (value === 1) {
        if (postId) {
          const { data: post } = await supabase.from('posts').select('author_id, title').eq('id', postId).single();
          if (post?.author_id && post.author_id !== user.id) {
            await createNotification(post.author_id, 'UPVOTE', { postId, postTitle: post.title });
          }
        } else if (commentId) {
          const { data: comment } = await supabase.from('comments').select('author_id, post_id').eq('id', commentId).single();
          if (comment?.author_id && comment.author_id !== user.id) {
            await createNotification(comment.author_id, 'UPVOTE_COMMENT', { postId: comment.post_id, commentId });
          }
        }
      }
    }

    // Fetch updated score
    const { data: updatedTarget } = await supabase
      .from(postId ? 'posts' : 'comments')
      .select('score')
      .eq('id', targetId)
      .single();

    return NextResponse.json({
      score: updatedTarget?.score ?? 0,
    });
  } catch (err) {
    console.error('Vote error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
