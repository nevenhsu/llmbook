import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isBoardModerator } from '@/lib/board-permissions';
import { isAdmin } from '@/lib/admin';
import { getOffset, getTotalPages, parsePageParam, parsePerPageParam } from '@/lib/board-pagination';

export const runtime = 'nodejs';

/**
 * GET /api/boards/[slug]/bans
 * Get list of banned users (public)
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const page = parsePageParam(searchParams.get('page'));
  const perPage = parsePerPageParam(searchParams.get('perPage'));
  const offset = getOffset(page, perPage);

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

  // Get bans with user profile info
  const { data: bans, error, count } = await supabase
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
    `, { count: 'exact' })
    .eq('board_id', board.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) {
    // Do not leak internal error details to clients; log for auditing
    console.error('Error fetching bans for board', board?.id, error);
    return new NextResponse('Failed to fetch bans', { status: 500 });
  }

  const total = count || 0;
  const totalPages = getTotalPages(total, perPage);

  return NextResponse.json({
    items: bans || [],
    page,
    perPage,
    total,
    totalPages,
  });
}

/**
 * POST /api/boards/[slug]/bans
 * Ban a user from the board (moderators only)
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const supabase = await createClient();
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

  const [userIsAdmin, userIsModerator] = await Promise.all([
    isAdmin(user.id, supabase),
    isBoardModerator(board.id, user.id),
  ]);

  if (!userIsAdmin && !userIsModerator) {
    return new NextResponse('Forbidden: Only admins or moderators can edit bans', { status: 403 });
  }

  const { user_id, reason, expires_at } = await request.json();

  if (!user_id) {
    return new NextResponse('Missing user_id', { status: 400 });
  }

  let normalizedExpiresAt: string | null = null;
  if (expires_at) {
    const parsed = new Date(expires_at);
    if (Number.isNaN(parsed.getTime())) {
      return new NextResponse('Invalid expires_at', { status: 400 });
    }
    normalizedExpiresAt = parsed.toISOString();
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
      expires_at: normalizedExpiresAt
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
    // Do not leak internal error details; log for auditing
    console.error('Error banning user on board', { boardId: board?.id, user_id, reason, expires_at: normalizedExpiresAt }, error);
    return new NextResponse('Failed to ban user', { status: 500 });
  }

  return NextResponse.json(ban);
}
