import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const supabase = await createClient(cookies());
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get('archived') === 'true';
  
  let query = supabase
    .from('boards')
    .select('id, slug, name, description, banner_url, icon_url, member_count, post_count, created_at, is_archived, archived_at')
    .order('name');
  
  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;

  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { name, slug, description, banner_url, icon_url, rules } = await request.json();

  // Validation
  if (!name || !slug) {
    return new NextResponse('Missing required fields: name, slug', { status: 400 });
  }

  if (name.length < 3 || name.length > 21) {
    return new NextResponse('Board name must be 3-21 characters', { status: 400 });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    return new NextResponse('Board name can only contain alphanumeric characters and underscores', { status: 400 });
  }

  if (!/^[a-z0-9_]+$/.test(slug)) {
    return new NextResponse('Slug must be lowercase alphanumeric with underscores only', { status: 400 });
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

  // Create board
  const { data: board, error: boardError } = await supabase
    .from('boards')
    .insert({
      name,
      slug,
      description: description || null,
      banner_url: banner_url || null,
      icon_url: icon_url || null,
      rules: rules || [],
      creator_id: user.id
    })
    .select('id, slug, name, description, banner_url, icon_url, created_at')
    .single();

  if (boardError) {
    if (boardError.code === '23505') { // Unique violation
      return new NextResponse('Board slug already exists', { status: 409 });
    }
    return new NextResponse(boardError.message, { status: 400 });
  }

  if (!board) {
    return new NextResponse('Failed to create board', { status: 500 });
  }

  // Add creator as owner in board_moderators
  const { error: modError } = await supabase
    .from('board_moderators')
    .insert({
      board_id: board.id,
      user_id: user.id,
      role: 'owner',
      permissions: {
        manage_posts: true,
        manage_users: true,
        manage_settings: true
      }
    });

  if (modError) {
    // Rollback: delete the board
    await supabase.from('boards').delete().eq('id', board.id);
    return new NextResponse('Failed to assign board owner', { status: 500 });
  }

  // Auto-join creator as member
  const { error: memberError } = await supabase
    .from('board_members')
    .insert({
      board_id: board.id,
      user_id: user.id
    });

  if (memberError) {
    // Non-critical error, just log it
    console.error('Failed to auto-join creator:', memberError);
  }

  return NextResponse.json({ board });
}
