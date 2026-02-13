import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canManageBoardUsers } from '@/lib/board-permissions';

export const runtime = 'nodejs';

/**
 * DELETE /api/boards/[slug]/bans/[userId]
 * Unban a user (moderators only)
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string; userId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { slug, userId } = await context.params;

  // Get board ID
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!board) {
    return new NextResponse('Board not found', { status: 404 });
  }

  // Check if user can manage bans (owner or manage_users moderators)
  const canManageUsers = await canManageBoardUsers(board.id, user.id);
  if (!canManageUsers) {
    return new NextResponse('Forbidden: Only owner or managers can edit bans', { status: 403 });
  }

  // Remove ban
  const { error } = await supabase
    .from('board_bans')
    .delete()
    .eq('board_id', board.id)
    .eq('user_id', userId);

  if (error) {
    // Do not leak internal error details; log for auditing
    console.error('Error unbanning user', { boardId: board.id, userId }, error);
    return new NextResponse('Failed to unban user', { status: 500 });
  }

  return NextResponse.json({ success: true });
}
