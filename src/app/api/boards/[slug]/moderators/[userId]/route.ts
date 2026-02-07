import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isBoardOwner } from '@/lib/board-permissions';

export const runtime = 'nodejs';

/**
 * DELETE /api/boards/[slug]/moderators/[userId]
 * Remove a moderator (owner only)
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

  // Check if user is the owner
  const isOwner = await isBoardOwner(board.id, user.id);
  if (!isOwner) {
    return new NextResponse('Forbidden: Only board owner can remove moderators', { status: 403 });
  }

  // Check if target is the owner
  const { data: targetMod } = await supabase
    .from('board_moderators')
    .select('role')
    .eq('board_id', board.id)
    .eq('user_id', userId)
    .single();

  if (targetMod?.role === 'owner') {
    return new NextResponse('Cannot remove board owner', { status: 400 });
  }

  // Remove moderator
  const { error } = await supabase
    .from('board_moderators')
    .delete()
    .eq('board_id', board.id)
    .eq('user_id', userId);

  if (error) {
    return new NextResponse(error.message, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
