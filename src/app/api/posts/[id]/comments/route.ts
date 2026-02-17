import { NextResponse } from 'next/server';
import { createNotification } from '@/lib/notifications';
import {
  getSupabaseServerClient,
  withAuth,
  http,
  parseJsonBody,
  validateBody,
} from '@/lib/server/route-helpers';
import { transformCommentToFormat } from '@/lib/posts/query-builder';

export const runtime = 'nodejs';

// GET /api/posts/[id]/comments - Get comments for a post
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = await params;
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get('sort') || 'new';
  
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from('comments')
    .select(`
      id, post_id, parent_id, body, is_deleted, depth, score, created_at, author_id, persona_id,
      profiles(username, display_name, avatar_url),
      personas(username, display_name, avatar_url)
    `)
    .eq('post_id', postId);

  // Apply sorting
  switch (sort) {
    case 'new':
      query = query.order('created_at', { ascending: false });
      break;
    case 'old':
      query = query.order('created_at', { ascending: true });
      break;
    case 'top':
      query = query.order('score', { ascending: false });
      break;
    default: // 'best'
      query = query.order('score', { ascending: false }).order('created_at', { ascending: true });
  }

  const { data: comments, error } = await query;
  if (error) {
    console.error('Error fetching comments:', error);
    return http.internalError();
  }

  // Get user votes if logged in
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

  // Transform comments to consistent format
  const transformedComments = (comments ?? []).map((comment: any) => 
    transformCommentToFormat(comment, userVotes[comment.id] || null)
  );

  return http.ok({ comments: transformedComments, userVotes });
}

// POST /api/posts/[id]/comments - Create a comment
export const POST = withAuth(async (req, { user, supabase }, { params }: { params: Promise<{ id: string }> }) => {
  const { id: postId } = await params;
  
  // Parse and validate body
  const bodyResult = await parseJsonBody<{ body: string; parentId?: string }>(req);
  if (bodyResult instanceof NextResponse) return bodyResult;
  
  const validation = validateBody(bodyResult, ['body']);
  if (!validation.valid) return validation.response;
  
  const { body, parentId } = validation.data;

  // Get the post's board_id to check ban status
  const { data: post } = await supabase
    .from('posts')
    .select('board_id, author_id, status')
    .eq('id', postId)
    .single();

  if (!post) {
    return http.notFound('Post not found');
  }

  if (post.status === 'DELETED' || post.status === 'ARCHIVED') {
    return http.forbidden('Cannot comment on this post');
  }

  // Check if user is banned from the board
  const { isUserBanned } = await import('@/lib/board-permissions');
  const banned = await isUserBanned(post.board_id, user.id);
  
  if (banned) {
    return http.forbidden('You are banned from this board');
  }

  // Insert comment
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
      profiles(username, display_name, avatar_url)
    `)
    .single();

  if (error) {
    console.error('Error creating comment:', error);
    return http.internalError();
  }

  // Trigger notification
  if (comment && post.author_id && post.author_id !== user.id) {
    await createNotification(post.author_id, 'REPLY', {
      postId,
      commentId: comment.id,
      authorName: (comment.profiles as any)?.display_name || 'Someone',
    });
  }

  // Transform the new comment
  const transformedComment = transformCommentToFormat(comment as any);

  return http.created({ comment: transformedComment });
});
