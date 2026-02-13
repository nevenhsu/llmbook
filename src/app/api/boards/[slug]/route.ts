import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { canManageBoard } from '@/lib/board-permissions';
import { isAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

/**
 * PATCH /api/boards/[slug]
 * Update board settings and archived state
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

  const payload = await request.json();
  const { name, description, banner_url, rules, is_archived } = payload;
  const hasSettingsUpdate =
    name !== undefined ||
    description !== undefined ||
    banner_url !== undefined ||
    rules !== undefined;
  const hasUnarchiveRequest = is_archived === false;

  if (!hasSettingsUpdate && !hasUnarchiveRequest) {
    return new NextResponse('No valid fields to update', { status: 400 });
  }

  const userIsAdmin = await isAdmin(user.id, supabase);

  if (hasSettingsUpdate && !userIsAdmin) {
    const canManageSettings = await canManageBoard(board.id, user.id);
    if (!canManageSettings) {
      return new NextResponse('Forbidden: Missing manage_settings permission', { status: 403 });
    }
  }

  if (hasUnarchiveRequest && !userIsAdmin) {
    return new NextResponse('Forbidden: Only admins can unarchive', { status: 403 });
  }

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
  if (rules !== undefined) updateData.rules = rules;
  if (hasUnarchiveRequest) {
    updateData.is_archived = false;
    updateData.archived_at = null;
  }

  // Update board
  const { data: updatedBoard, error } = await supabase
    .from('boards')
    .update(updateData)
    .eq('id', board.id)
    .select('id, slug, name, description, banner_url, rules, updated_at')
    .single();

  if (error) {
    return new NextResponse(error.message, { status: 400 });
  }

  return NextResponse.json({ board: updatedBoard });
}

/**
 * DELETE /api/boards/[slug]
 * Archive board (admin only)
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

  const userIsAdmin = await isAdmin(user.id, supabase);
  if (!userIsAdmin) {
    return new NextResponse('Forbidden: Only admins can archive', { status: 403 });
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
