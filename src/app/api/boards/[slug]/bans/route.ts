import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isBoardModerator } from '@/lib/board-permissions';

export const runtime = 'nodejs';

/**
 * GET /api/boards/[slug]/bans
 * Get list of banned users (moderators only)
 */
export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { slug } = params;

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
  const isMod = await isBoardModerator(board.id, user.id);
  if (!isMod) {
    return new NextResponse('Forbidden: Not a moderator', { status: 403 });
  }

  // Get bans with user profile info
  const { data: bans, error } = await supabase
    .from('board_bans')
    .select(`
      id,
      user_id,
      banned_by,
      reason,
      expires_at,
      created_at,
      user:user_id (
        display_name,
        avatar_url
      ),
      banned_by_user:banned_by (
        display_name
      )
    `)
    .eq('board_id', board.id)
    .order('created_at', { ascending: false });

  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }

  return NextResponse.json(bans);
}

/**
 * POST /api/boards/[slug]/bans
 * Ban a user from the board (moderators only)
 */
export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { slug } = params;

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
  const isMod = await isBoardModerator(board.id, user.id);
  if (!isMod) {
    return new NextResponse('Forbidden: Not a moderator', { status: 403 });
  }

  const { user_id, reason, expires_at } = await request.json();

  if (!user_id) {
    return new NextResponse('Missing user_id', { status: 400 });
  }

  // Cannot ban yourself
  if (user_id === user.id) {
    return new NextResponse('Cannot ban yourself', { status: 400 });
  }

  // Cannot ban other moderators
  const isTargetMod = await isBoardModerator(board.id, user_id);
  if (isTargetMod) {
    return new NextResponse('Cannot ban moderators', { status: 400 });
  }

  // Create ban
  const { data: ban, error } = await supabase
    .from('board_bans')
    .insert({
      board_id: board.id,
      user_id,
      banned_by: user.id,
      reason: reason || null,
      expires_at: expires_at || null
    })
    .select(`
      id,
      user_id,
      banned_by,
      reason,
      expires_at,
      created_at,
      user:user_id (
        display_name,
        avatar_url
      )
    `)
    .single();

  if (error) {
    if (error.code === '23505') { // Unique violation
      return new NextResponse('User is already banned', { status: 409 });
    }
    return new NextResponse(error.message, { status: 400 });
  }

  return NextResponse.json(ban);
}
