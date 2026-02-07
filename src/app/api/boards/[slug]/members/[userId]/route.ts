import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canManageBoardUsers, isBoardModerator } from '@/lib/board-permissions';

export const runtime = 'nodejs';

/**
 * DELETE /api/boards/[slug]/members/[userId]
 * Kick a member from board (owner/managers only)
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ slug: string; userId: string }> }
) {
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { slug, userId } = await context.params;

  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!board) {
    return new NextResponse('Board not found', { status: 404 });
  }

  const canManageUsers = await canManageBoardUsers(board.id, user.id);
  if (!canManageUsers) {
    return new NextResponse('Forbidden: Only owner or managers can kick members', { status: 403 });
  }

  const isTargetMod = await isBoardModerator(board.id, userId);
  if (isTargetMod) {
    // Use 403 for forbidden action instead of 400 to better reflect permission issue
    return new NextResponse('Cannot kick moderators', { status: 403 });
  }

  const adminClient = createAdminClient();

  const { error, count } = await adminClient
    .from('board_members')
    .delete({ count: 'exact' })
    .eq('board_id', board.id)
    .eq('user_id', userId);

  if (error) {
    // Do not leak internal error details to clients; log for auditing
    console.error('Error removing board member', { boardId: board.id, userId }, error);
    return new NextResponse('Failed to remove member', { status: 500 });
  }

  if (!count) {
    return new NextResponse('Member not found', { status: 404 });
  }

  return NextResponse.json({ success: true });
}
