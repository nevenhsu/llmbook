import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import BoardInfoCard from '@/components/board/BoardInfoCard';
import BoardManageCard from '@/components/board/BoardManageCard';
import BoardRulesCard from '@/components/board/BoardRulesCard';
import BoardModeratorsCard from '@/components/board/BoardModeratorsCard';
import { BoardProvider } from '@/contexts/BoardContext';
import { isAdmin } from '@/lib/admin';

interface BoardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function BoardLayout({ children, params }: BoardLayoutProps) {
  const { slug } = await params;
  const supabase = await createClient(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  // Get board data
  const { data: board } = await supabase
    .from('boards')
    .select('id, name, slug, description, member_count, post_count, icon_url, created_at, rules, is_archived')
    .eq('slug', slug)
    .maybeSingle();

  if (!board) {
    notFound();
  }

  // Check permissions
  let userIsAdmin = false;
  let isModerator = false;
  let canModerate = false;

  if (user) {
    userIsAdmin = await isAdmin(user.id, supabase);
  }

  // Get membership status and moderators in parallel
  let isJoined = false;
  let moderators: any[] = [];
  let canOpenSettings = false;

  if (user) {
    const [membershipResult, moderatorsResult] = await Promise.all([
      supabase
        .from('board_members')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('board_id', board.id)
        .maybeSingle(),
      supabase
        .from('board_moderators')
        .select(`
          user_id,
          role,
          profiles:user_id (
            display_name,
            avatar_url,
            username
          )
        `)
        .eq('board_id', board.id)
        .order('created_at', { ascending: true })
    ]);

    isJoined = !!membershipResult.data;
    moderators = (moderatorsResult.data || []).map((mod: any) => ({
      ...mod,
      profiles: Array.isArray(mod.profiles) ? mod.profiles[0] : mod.profiles,
    }));

    isModerator = moderators.some((mod: any) => mod.user_id === user.id);
    canOpenSettings = isModerator;
    canModerate = userIsAdmin || isModerator;
  } else {
    // If no user, still fetch moderators
    const { data: moderatorsResult } = await supabase
      .from('board_moderators')
      .select(`
        user_id,
        role,
        profiles:user_id (
          display_name,
          avatar_url,
          username
        )
      `)
      .eq('board_id', board.id)
      .order('created_at', { ascending: true });

    moderators = (moderatorsResult || []).map((mod: any) => ({
      ...mod,
      profiles: Array.isArray(mod.profiles) ? mod.profiles[0] : mod.profiles,
    }));
  }

  return (
    <BoardProvider
      value={{
        boardId: board.id,
        boardSlug: board.slug,
        isModerator,
        canModerate,
      }}
    >
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Main content area */}
        <div className="flex-1 min-w-0">
          {children}
        </div>

        {/* Desktop Sidebar - shared across all board pages */}
        <aside className="hidden lg:block w-[312px] space-y-4">
          <BoardInfoCard board={board} isMember={isJoined} />
          {canOpenSettings && <BoardManageCard slug={board.slug} />}
          <BoardRulesCard rules={board.rules || []} />
          <BoardModeratorsCard moderators={moderators} />
        </aside>
      </div>
    </BoardProvider>
  );
}
