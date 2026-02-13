import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canManageBoardUsers } from '@/lib/board-permissions';
import { getBoardBySlug } from '@/lib/boards/get-board-by-slug';
import BoardMemberManagement from '@/components/board/BoardMemberManagement';

export default async function BoardMemberPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const supabase = await createClient(cookies());
  const adminClient = createAdminClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { slug } = await params;
  const board = await getBoardBySlug(slug);

  if (!board) {
    redirect('/');
  }

  const canEditBans = user ? await canManageBoardUsers(board.id, user.id) : false;

  if (!canEditBans) {
    redirect(`/r/${board.slug}`);
  }

  const { data: members } = await adminClient
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

  const { data: moderators } = await adminClient
    .from('board_moderators')
    .select('user_id')
    .eq('board_id', board.id);

  const { data: bans } = await adminClient
    .from('board_bans')
    .select(`
      id,
      user_id,
      reason,
      expires_at,
      created_at,
      user:user_id (
        display_name,
        avatar_url
      )
    `)
    .eq('board_id', board.id)
    .order('created_at', { ascending: false });

  const moderatorIds = new Set((moderators || []).map((mod: any) => mod.user_id));
  const normalizedMembers = (members || []).map((member: any) => ({
    user_id: member.user_id,
    joined_at: member.created_at ?? member.joined_at ?? null,
    profiles: member.profiles,
    is_moderator: moderatorIds.has(member.user_id)
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">r/{board.slug} Members</h1>
          <p className="text-sm opacity-75">Manage members and bans in a dedicated page.</p>
        </div>
        <Link href={`/r/${board.slug}`} className="btn btn-outline btn-sm border border-neutral hover:border-neutral">
          Back to Board
        </Link>
      </div>

      <BoardMemberManagement
        boardSlug={board.slug}
        currentUserId={user?.id || ''}
        canEditBans={canEditBans}
        members={normalizedMembers}
        bans={(bans as any[]) || []}
      />
    </div>
  );
}
