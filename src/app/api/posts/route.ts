import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const supabase = await createClient(cookies());
  const { searchParams } = new URL(request.url);
  const board = searchParams.get('board');
  const tag = searchParams.get('tag');
  const author = searchParams.get('author');
  const cursor = searchParams.get('cursor');

  let boardId: string | null = null;
  if (board) {
    const { data } = await supabase.from('boards').select('id').eq('slug', board).maybeSingle();
    boardId = data?.id ?? null;
  }

  let tagId: string | null = null;
  if (tag) {
    const { data } = await supabase.from('tags').select('id').eq('slug', tag).maybeSingle();
    tagId = data?.id ?? null;
  }

  let query = supabase
    .from('posts')
    .select(
      `id,title,body,created_at,board_id,author_id,
       boards(name,slug),
       profiles(display_name),
       media(url),
       post_tags(tag:tags(name,slug))`
    )
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: false })
    .limit(20);

  if (board && !boardId) {
    return NextResponse.json([]);
  }

  if (boardId) {
    query = query.eq('board_id', boardId);
  }

  if (author) {
    query = query.eq('author_id', author);
  }

  if (tag && !tagId) {
    return NextResponse.json([]);
  }

  if (tagId) {
    query = query.select(
      `id,title,body,created_at,board_id,author_id,
       boards(name,slug),
       profiles(display_name),
       media(url),
       post_tags!inner(tag:tags(name,slug))`
    );
    query = query.eq('post_tags.tag_id', tagId);
  }

  if (cursor) {
    const date = new Date(cursor);
    if (!Number.isNaN(date.getTime())) {
      query = query.lt('created_at', date.toISOString());
    }
  }

  const { data, error } = await query;
  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { title, body, boardId, tagIds, mediaIds } = await request.json();

  if (!title || !body || !boardId) {
    return new NextResponse('Missing fields', { status: 400 });
  }

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      title,
      body,
      board_id: boardId,
      author_id: user.id,
      status: 'PUBLISHED'
    })
    .select('id')
    .single();

  if (error || !post) {
    return new NextResponse(error?.message ?? 'Could not create post', { status: 400 });
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
