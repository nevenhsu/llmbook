import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { hotScore, getTimeRangeDate } from '@/lib/ranking';

export const runtime = 'nodejs';

// Cache for 60 seconds in production
export const revalidate = 60;

export async function GET(request: Request) {
  const startTime = Date.now();
  const supabase = await createClient(cookies());
  const { searchParams } = new URL(request.url);
  const board = searchParams.get('board');
  const tag = searchParams.get('tag');
  const author = searchParams.get('author');
  const cursor = searchParams.get('cursor');
  const sort = searchParams.get('sort') || 'new';
  const t = searchParams.get('t') || 'today';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

  // Parallel execution of independent queries
  const [{ data: { user } }, boardData, tagData] = await Promise.all([
    supabase.auth.getUser(),
    board ? supabase.from('boards').select('id').eq('slug', board).maybeSingle() : Promise.resolve({ data: null }),
    tag ? supabase.from('tags').select('id').eq('slug', tag).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const boardId = boardData?.data?.id ?? null;
  const tagId = tagData?.data?.id ?? null;

  if ((board && !boardId) || (tag && !tagId)) {
    return NextResponse.json([]);
  }

  // Build base query with minimal fields
  // Exclude 'body' to reduce payload size - only fetch title and metadata
  let query = supabase
    .from('posts')
    .select(
      `id,title,created_at,score,comment_count,board_id,author_id,persona_id,
       boards!inner(name,slug),
       profiles(display_name,avatar_url),
       personas(display_name,avatar_url),
       media(url),
       post_tags(tag:tags(name))`
    )
    .eq('status', 'PUBLISHED');

  // Only query hidden posts if user is logged in
  if (user?.id) {
    const { data: hidden } = await supabase
      .from('hidden_posts')
      .select('post_id')
      .eq('user_id', user.id)
      .limit(100); // Limit hidden posts check
    
    if (hidden && hidden.length > 0) {
      query = query.not('id', 'in', `(${hidden.map(h => h.post_id).join(',')})`);
    }
  }

  if (boardId) {
    query = query.eq('board_id', boardId);
  }

  if (author) {
    query = query.eq('author_id', author);
  }

  if (tagId) {
    query = query
      .select(
        `id,title,created_at,score,comment_count,board_id,author_id,persona_id,
         boards!inner(name,slug),
         profiles(display_name,avatar_url),
         personas(display_name,avatar_url),
         media(url),
         post_tags!inner(tag:tags(name))`
      )
      .eq('post_tags.tag_id', tagId);
  }

  if (cursor) {
    const date = new Date(cursor);
    if (!Number.isNaN(date.getTime())) {
      query = query.lt('created_at', date.toISOString());
    }
  }

  // Apply sort-specific filters
  if (sort === 'top') {
    const since = getTimeRangeDate(t);
    if (since) query = query.gte('created_at', since);
    query = query.order('score', { ascending: false });
  } else if (sort === 'hot') {
    // For hot sort, only fetch recent posts (last 7 days)
    const since = getTimeRangeDate('week');
    if (since) query = query.gte('created_at', since);
    query = query.order('score', { ascending: false });
  } else if (sort === 'rising') {
    // For rising sort, only fetch last 3 days
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', since);
    query = query.order('created_at', { ascending: false });
  } else {
    // new
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query.limit(limit);
  
  if (error) {
    console.error('API Error:', error);
    return new NextResponse(error.message, { status: 500 });
  }

  let posts = (data ?? []) as any[];
  
  // Apply hot ranking algorithm
  if (sort === 'hot') {
    posts = posts.sort((a, b) => 
      hotScore(b.score, b.comment_count || 0, b.created_at) - 
      hotScore(a.score, a.comment_count || 0, a.created_at)
    );
  }

  const duration = Date.now() - startTime;
  console.log(`API /posts: ${posts.length} posts in ${duration}ms (sort: ${sort})`);

  return NextResponse.json(posts, {
    headers: {
      'X-Response-Time': `${duration}ms`,
    },
  });
}

export async function POST(request: Request) {
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { 
    title, 
    body, 
    boardId, 
    tagIds, 
    mediaIds,
    postType = 'text',
    linkUrl,
    pollOptions
  } = await request.json();

  if (!title || !boardId) {
    return new NextResponse('Missing fields', { status: 400 });
  }

  if (postType === 'text' && !body) {
    return new NextResponse('Body required for text posts', { status: 400 });
  }

  if (postType === 'link' && !linkUrl) {
    return new NextResponse('Link URL required for link posts', { status: 400 });
  }

  if (postType === 'poll') {
    if (!Array.isArray(pollOptions) || pollOptions.length < 2 || pollOptions.length > 6) {
      return new NextResponse('Poll must have 2-6 options', { status: 400 });
    }
  }

  // Check if user is banned from the board
  const { canPostInBoard, isUserBanned } = await import('@/lib/board-permissions');
  const canPost = await canPostInBoard(boardId, user.id);
  
  if (!canPost) {
    const banned = await isUserBanned(boardId, user.id);
    if (banned) {
      return new NextResponse('You are banned from this board', { status: 403 });
    }
    return new NextResponse('Cannot post in this board', { status: 403 });
  }

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      title,
      body: body || null,
      board_id: boardId,
      author_id: user.id,
      status: 'PUBLISHED',
      post_type: postType,
      link_url: linkUrl || null
    })
    .select('id')
    .single();

  if (error || !post) {
    return new NextResponse(error?.message ?? 'Could not create post', { status: 400 });
  }

  // Create poll options if poll post
  if (postType === 'poll' && Array.isArray(pollOptions)) {
    const optionsToInsert = pollOptions.map((option: { text: string }, idx: number) => ({
      post_id: post.id,
      text: option.text,
      position: idx
    }));

    const { error: pollError } = await supabase
      .from('poll_options')
      .insert(optionsToInsert);

    if (pollError) {
      // Rollback: delete the post
      await supabase.from('posts').delete().eq('id', post.id);
      return new NextResponse('Failed to create poll options', { status: 400 });
    }
  }

  if (Array.isArray(tagIds) && tagIds.length > 0) {
    const tagRows = tagIds.map((tagId: string) => ({ post_id: post.id, tag_id: tagId }));
    const { error: tagError } = await supabase.from('post_tags').insert(tagRows);
    if (tagError) {
      return new NextResponse(tagError.message, { status: 400 });
    }
  }

  if (Array.isArray(mediaIds) && mediaIds.length > 0) {
    const { error: mediaError } = await supabase
      .from('media')
      .update({ post_id: post.id })
      .in('id', mediaIds)
      .eq('user_id', user.id);

    if (mediaError) {
      return new NextResponse(mediaError.message, { status: 400 });
    }
  }

  return NextResponse.json({ id: post.id });
}
