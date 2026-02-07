import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isBoardModerator } from '@/lib/board-permissions';

export const runtime = 'nodejs';

/**
 * GET /api/boards/[slug]/members
 * Get board members list (moderators only)
 */
export async function GET(
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

  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!board) {
    return new NextResponse('Board not found', { status: 404 });
  }

  const isMod = await isBoardModerator(board.id, user.id);
  if (!isMod) {
    return new NextResponse('Forbidden: Not a moderator', { status: 403 });
  }

  const { data: members, error } = await supabase
    .from('board_members')
    .select(`
      *,
      profiles:user_id (
        display_name,
        avatar_url
      )
    `)
    .eq('board_id', board.id)
    .order('user_id', { ascending: true });

  if (error) {
    // Do not leak internal error details to clients; log for auditing
    console.error('Error fetching board members for slug', slug, error);
    return new NextResponse('Failed to fetch board members', { status: 500 });
  }

  const { data: moderators, error: moderatorsError } = await supabase
    .from('board_moderators')
    .select('user_id, role')
    .eq('board_id', board.id);

  if (moderatorsError) {
    // Do not leak internal error details to clients; log for auditing
    console.error('Error fetching board moderators for board', board?.id, moderatorsError);
    return new NextResponse('Failed to fetch board moderators', { status: 500 });
  }

  const moderatorMap = new Map<string, string>();
  for (const mod of moderators || []) {
    moderatorMap.set(mod.user_id, mod.role);
  }

  const normalized = (members || []).map((member: any) => ({
    user_id: member.user_id,
    joined_at: member.created_at ?? member.joined_at ?? null,
    profiles: member.profiles,
    is_moderator: moderatorMap.has(member.user_id),
    moderator_role: moderatorMap.get(member.user_id) || null
  }));

  return NextResponse.json(normalized);
}
