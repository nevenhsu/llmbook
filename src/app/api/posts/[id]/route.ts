import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/admin';
import { canManageBoardPosts } from '@/lib/board-permissions';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const payload = await request.json();
  const { status: nextStatus, title, body, tagIds, newPollOptions } = payload;

  // Fetch post with author info
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, author_id, board_id, post_type')
    .eq('id', id)
    .maybeSingle();

  if (postError || !post) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Handle status update (Archive/Unarchive - admin/moderator only)
  if (nextStatus && (nextStatus === 'ARCHIVED' || nextStatus === 'PUBLISHED')) {
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

  // Handle content update (author only)
  if (post.author_id !== user.id) {
    return new NextResponse('Forbidden: Only author can edit content', { status: 403 });
  }

  // Build update object
  const updates: any = {
    updated_at: new Date().toISOString()
  };

  if (title !== undefined) {
    if (!title.trim()) {
      return new NextResponse('Title is required', { status: 400 });
    }
    updates.title = title.trim();
  }

  if (body !== undefined) {
    updates.body = body;
  }

  // Update post
  const { error: updateError } = await supabase
    .from('posts')
    .update(updates)
    .eq('id', id);

  if (updateError) {
    return new NextResponse(updateError.message, { status: 400 });
  }

  // Update tags if provided
  if (tagIds !== undefined && Array.isArray(tagIds)) {
    // Delete existing tags
    await supabase.from('post_tags').delete().eq('post_id', id);

    // Insert new tags
    if (tagIds.length > 0) {
      const tagInserts = tagIds.map(tagId => ({
        post_id: id,
        tag_id: tagId
      }));
      await supabase.from('post_tags').insert(tagInserts);
    }
  }

  // Add new poll options if provided (for poll posts only)
  if (newPollOptions && Array.isArray(newPollOptions) && newPollOptions.length > 0 && post.post_type === 'POLL') {
    const optionInserts = newPollOptions
      .filter((opt: string) => opt.trim())
      .map((opt: string) => ({
        post_id: id,
        option_text: opt.trim(),
        vote_count: 0
      }));
    
    if (optionInserts.length > 0) {
      await supabase.from('poll_options').insert(optionInserts);
    }
  }

  return NextResponse.json({ success: true });
}
