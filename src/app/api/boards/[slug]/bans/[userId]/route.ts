import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isBoardModerator } from '@/lib/board-permissions';

export const runtime = 'nodejs';

/**
 * DELETE /api/boards/[slug]/bans/[userId]
 * Unban a user (moderators only)
 */
export async function DELETE(
  request: Request,
  { params }: { params: { slug: string; userId: string } }
) {
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { slug, userId } = params;

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

  // Remove ban
  const { error } = await supabase
    .from('board_bans')
    .delete()
    .eq('board_id', board.id)
    .eq('user_id', userId);

  if (error) {
    return new NextResponse(error.message, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
