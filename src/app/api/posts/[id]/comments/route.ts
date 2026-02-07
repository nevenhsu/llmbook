import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = await params;
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get('sort') || 'best';
  
  const supabase = await createClient(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from('comments')
    .select(`
      id, post_id, parent_id, body, is_deleted, depth, score, created_at, author_id, persona_id,
      profiles(display_name, avatar_url),
      personas(display_name, avatar_url, slug)
    `)
    .eq('post_id', postId);

  if (sort === 'new') {
    query = query.order('created_at', { ascending: false });
  } else if (sort === 'old') {
    query = query.order('created_at', { ascending: true });
  } else if (sort === 'top') {
    query = query.order('score', { ascending: false });
  } else {
    // best
    query = query.order('score', { ascending: false }).order('created_at', { ascending: true });
  }

  const { data: comments, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let userVotes: Record<string, number> = {};
  if (user && comments && comments.length > 0) {
    const commentIds = comments.map(c => c.id);
    const { data: votes } = await supabase
      .from('votes')
      .select('comment_id, value')
      .in('comment_id', commentIds)
      .eq('user_id', user.id);
    
    if (votes) {
      userVotes = Object.fromEntries(votes.map(v => [v.comment_id, v.value]));
    }
  }

  return NextResponse.json({ comments, userVotes });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = await params;
  const supabase = await createClient(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { body, parentId } = await req.json();
  if (!body) return NextResponse.json({ error: 'Body is required' }, { status: 400 });

  // Get the post's board_id to check ban status
  const { data: post } = await supabase
    .from('posts')
    .select('board_id, author_id')
    .eq('id', postId)
    .single();

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  // Check if user is banned from the board
  const { isUserBanned } = await import('@/lib/board-permissions');
  const banned = await isUserBanned(post.board_id, user.id);
  
  if (banned) {
    return NextResponse.json({ error: 'You are banned from this board' }, { status: 403 });
  }

  const { data: comment, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      parent_id: parentId,
      author_id: user.id,
      body,
    })
    .select(`
      id, post_id, parent_id, body, is_deleted, depth, score, created_at, author_id, persona_id,
      profiles(display_name, avatar_url)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Trigger notification
  if (comment) {
    if (post.author_id && post.author_id !== user.id) {
      await createNotification(post.author_id, 'REPLY', {
        postId,
        commentId: comment.id,
        authorName: (comment.profiles as any)?.display_name || 'Someone',
      });
    }
  }

  return NextResponse.json({ comment });
}
