import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUserBoardRole } from '@/lib/board-permissions';
import BoardSettingsForm from '@/components/board/BoardSettingsForm';

export default async function BoardSettingsPage({
  params
}: {
  params: { slug: string };
}) {
  const supabase = await createClient(cookies());
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { slug } = params;

  // Get board
  const { data: board } = await supabase
    .from('boards')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!board) {
    redirect('/');
  }

  // Check if user is a moderator
  const role = await getUserBoardRole(board.id, user.id);
  if (!role) {
    redirect(`/boards/${slug}`);
  }

  // Get moderators
  const { data: moderators } = await supabase
    .from('board_moderators')
    .select(`
      id,
      user_id,
      role,
      permissions,
      created_at,
      profiles:user_id (
        display_name,
        avatar_url
      )
    `)
    .eq('board_id', board.id)
    .order('created_at', { ascending: true });

  // Get bans
  const { data: bans } = await supabase
    .from('board_bans')
    .select(`
      id,
      user_id,
      banned_by,
      reason,
      expires_at,
      created_at,
      profiles:user_id (
        display_name,
        avatar_url
      )
    `)
    .eq('board_id', board.id)
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-6">Board Settings: r/{slug}</h1>
      <BoardSettingsForm
        board={board}
        moderators={moderators || []}
        bans={bans || []}
        userRole={role}
      />
    </div>
  );
}
