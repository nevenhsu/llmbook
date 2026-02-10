import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/admin';
import { canManageBoardPosts } from '@/lib/board-permissions';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient(cookies());
  const { data, error } = await supabase
    .from("posts")
    .select(
      `id,title,body,created_at,
       boards(name,slug),
       profiles(username, display_name),
       media(id,url),
       post_tags(tag:tags(name,slug))`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return new NextResponse('Not found', { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, author_id, status')
    .eq('id', id)
    .maybeSingle();

  if (postError || !post) {
    return new NextResponse('Not found', { status: 404 });
  }

  if (post.author_id !== user.id) {
    return new NextResponse('Forbidden: Only author can delete', { status: 403 });
  }

  if (post.status === 'DELETED') {
    return NextResponse.json({ success: true });
  }

  const { error: updateError } = await supabase
    .from('posts')
    .update({
      status: 'DELETED',
      body: '[deleted]',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('author_id', user.id);

  if (updateError) {
    return new NextResponse(updateError.message, { status: 400 });
  }

  await Promise.all([
    supabase.from('votes').delete().eq('post_id', id),
    supabase.from('saved_posts').delete().eq('post_id', id),
    supabase.from('hidden_posts').delete().eq('post_id', id),
    supabase.from('media').delete().eq('post_id', id),
    supabase.from('post_tags').delete().eq('post_id', id),
    supabase.from('poll_options').delete().eq('post_id', id)
  ]);

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const payload = await request.json();
  const nextStatus = payload?.status;

  if (nextStatus !== 'ARCHIVED' && nextStatus !== 'PUBLISHED') {
    return new NextResponse('Only ARCHIVED and PUBLISHED status updates are supported', { status: 400 });
  }

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, board_id')
    .eq('id', id)
    .maybeSingle();

  if (postError || !post) {
    return new NextResponse('Not found', { status: 404 });
  }

  const userIsAdmin = await isAdmin(user.id, supabase);
  const canManagePosts = userIsAdmin || await canManageBoardPosts(post.board_id, user.id);

  if (!canManagePosts) {
    return new NextResponse('Forbidden: Missing manage_posts permission', { status: 403 });
  }

  const { data: updatedPost, error: updateError } = await supabase
    .from('posts')
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select('id, status')
    .single();

  if (updateError) {
    return new NextResponse(updateError.message, { status: 400 });
  }

  return NextResponse.json({ post: updatedPost });
}
