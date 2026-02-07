import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isBoardOwner, getUserBoardRole } from '@/lib/board-permissions';

export const runtime = 'nodejs';

/**
 * PATCH /api/boards/[slug]
 * Update board settings (moderators only)
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { slug } = await context.params;

  // Get board ID
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!board) {
    return new NextResponse('Board not found', { status: 404 });
  }

  // Check if user is a moderator
  const role = await getUserBoardRole(board.id, user.id);
  if (!role) {
    return new NextResponse('Forbidden: Not a moderator', { status: 403 });
  }

  const { name, description, banner_url, icon_url, rules } = await request.json();

  // Validation
  if (name && (name.length < 3 || name.length > 21)) {
    return new NextResponse('Board name must be 3-21 characters', { status: 400 });
  }

  if (name && !/^[a-zA-Z0-9_]+$/.test(name)) {
    return new NextResponse('Board name can only contain alphanumeric characters and underscores', { status: 400 });
  }

  if (description && description.length > 500) {
    return new NextResponse('Description must be max 500 characters', { status: 400 });
  }

  if (rules && Array.isArray(rules)) {
    if (rules.length > 15) {
      return new NextResponse('Maximum 15 rules allowed', { status: 400 });
    }
    
    for (const rule of rules) {
      if (!rule.title || rule.title.length > 100) {
        return new NextResponse('Rule title required and must be max 100 characters', { status: 400 });
      }
      if (rule.description && rule.description.length > 500) {
        return new NextResponse('Rule description must be max 500 characters', { status: 400 });
      }
    }
  }

  // Build update object
  const updateData: any = {
    updated_at: new Date().toISOString()
  };

  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (banner_url !== undefined) updateData.banner_url = banner_url;
  if (icon_url !== undefined) updateData.icon_url = icon_url;
  if (rules !== undefined) updateData.rules = rules;

  // Update board
  const { data: updatedBoard, error } = await supabase
    .from('boards')
    .update(updateData)
    .eq('id', board.id)
    .select('id, slug, name, description, banner_url, icon_url, rules, updated_at')
    .single();

  if (error) {
    return new NextResponse(error.message, { status: 400 });
  }

  return NextResponse.json({ board: updatedBoard });
}

/**
 * DELETE /api/boards/[slug]
 * Archive board (owner only)
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { slug } = await context.params;

  // Get board ID
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!board) {
    return new NextResponse('Board not found', { status: 404 });
  }

  // Check if user is the owner
  const isOwner = await isBoardOwner(board.id, user.id);
  if (!isOwner) {
    return new NextResponse('Forbidden: Only board owner can archive', { status: 403 });
  }

  // Archive the board (soft delete)
  const { error } = await supabase
    .from('boards')
    .update({
      is_archived: true,
      archived_at: new Date().toISOString()
    })
    .eq('id', board.id);

  if (error) {
    return new NextResponse(error.message, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
