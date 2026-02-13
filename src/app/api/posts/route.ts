import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getHotPostsFromCache, getRisingPostsFromCache } from '@/lib/ranking';
import { isAdmin } from '@/lib/admin';
import { canManageBoard } from '@/lib/board-permissions';
import { buildPostsQuery, fetchUserInteractions } from '@/lib/posts/query-builder';

export const runtime = 'nodejs';

// Cache for 60 seconds in production
export const revalidate = 60;

export async function GET(request: Request) {
  const startTime = Date.now();
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const board = searchParams.get('board');
  const tag = searchParams.get('tag');
  const author = searchParams.get('author');
  const cursor = searchParams.get('cursor');
  const sort = searchParams.get('sort') || 'new';
  const t = searchParams.get('t') || 'today';
  const includeArchived = searchParams.get('includeArchived') === 'true';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

  // Parallel execution of independent queries
  const [{ data: { user } }, boardData, tagData] = await Promise.all([
    supabase.auth.getUser(),
    board ? supabase.from('boards').select('id').eq('slug', board).maybeSingle() : Promise.resolve({ data: null }),
    tag ? supabase.from('tags').select('id').eq('slug', tag).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const boardId = boardData?.data?.id ?? null;
  const tagId = tagData?.data?.id ?? null;
  
  // Check if user can view archived posts
  let canViewArchived = false;
  if (user && includeArchived) {
    const userIsAdmin = await isAdmin(user.id, supabase);
    if (userIsAdmin) {
      canViewArchived = true;
    } else if (boardId) {
      canViewArchived = await canManageBoard(boardId, user.id);
    }
  }

  if ((board && !boardId) || (tag && !tagId)) {
    return NextResponse.json([]);
  }

  let posts: any[] = [];
  let useCache = false;

  // Use cached rankings for hot and rising sorts
  if (sort === 'hot' && !tagId && !author) {
    const offset = cursor ? parseInt(cursor, 10) : 0;
    const { posts: cachedPosts, error } = await getHotPostsFromCache(supabase, {
      boardId: boardId || undefined,
      limit,
      offset,
    });
    
    if (!error && cachedPosts.length > 0) {
      posts = cachedPosts;
      useCache = true;
    }
  } else if (sort === 'rising' && !tagId && !author) {
    const offset = cursor ? parseInt(cursor, 10) : 0;
    const { posts: cachedPosts, error } = await getRisingPostsFromCache(supabase, {
      boardId: boardId || undefined,
      limit,
      offset,
    });
    
    if (!error && cachedPosts.length > 0) {
      posts = cachedPosts;
      useCache = true;
    }
  }

  // If not using cache, query posts directly using query builder
  if (!useCache) {
    const postsQuery = buildPostsQuery({
      supabase,
      boardId: boardId || undefined,
      tagId: tagId || undefined,
      authorId: author || undefined,
      sortBy: sort as any,
      timeRange: t,
      canViewArchived,
      limit,
      offset: sort === 'top' && cursor ? parseInt(cursor, 10) : undefined,
      cursor: sort === 'new' && cursor ? cursor : undefined,
    });

    const { data, error } = await postsQuery;

    if (error) {
      console.error('API Error:', error);
      return new NextResponse(error.message, { status: 500 });
    }

    posts = (data ?? []) as any[];
  }

  // Fetch user interactions (votes + hidden status) for displayed posts
  if (user && posts.length > 0) {
    const postIds = posts.map(p => p.id);
    const { votes: userVotes, hiddenPostIds } = await fetchUserInteractions(
      supabase,
      user.id,
      postIds
    );

    // Add userVote and isHidden to each post
    posts = posts.map(post => ({
      ...post,
      userVote: userVotes[post.id] || null,
      isHidden: hiddenPostIds.has(post.id)
    }));
  }

  const duration = Date.now() - startTime;
  console.log(`API /posts: ${posts.length} posts in ${duration}ms (sort: ${sort}, cached: ${useCache})`);

  return NextResponse.json(posts, {
    headers: {
      'X-Response-Time': `${duration}ms`,
      'X-Cache-Hit': useCache ? '1' : '0',
    },
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
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
    pollOptions,
    pollDuration
  } = await request.json();

  if (!title || !boardId) {
    return new NextResponse('Missing fields', { status: 400 });
  }

  // Allow text posts with just images (body can be empty or contain only HTML tags)
  // Removed body requirement for text posts since images are allowed

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

  // Calculate expires_at for polls
  let expiresAt: string | null = null;
  if (postType === 'poll' && pollDuration) {
    const durationDays = parseInt(pollDuration, 10);
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + durationDays);
    expiresAt = expirationDate.toISOString();
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
      link_url: linkUrl || null,
      expires_at: expiresAt
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

  // Fetch board slug for redirect
  const { data: boardData } = await supabase
    .from('boards')
    .select('slug')
    .eq('id', boardId)
    .single();

  console.log('Created post:', post.id, 'in board:', boardId, 'slug:', boardData?.slug);

  return NextResponse.json({ 
    id: post.id,
    boardSlug: boardData?.slug || null
  });
}
