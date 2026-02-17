import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import PostForm from '@/components/create-post/PostForm';

export default async function NewPostPage() {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's joined boards (最多10個，按加入時間排序)
  const { data: joinedBoards } = await supabase
    .from('board_members')
    .select('boards(id,name,slug)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })
    .limit(10);

  const userBoards = joinedBoards
    ?.map(jb => {
      const board = jb.boards as any;
      if (!board || typeof board !== 'object' || Array.isArray(board)) return null;
      return {
        id: board.id as string,
        name: board.name as string,
        slug: board.slug as string,
      };
    })
    .filter((b): b is { id: string; name: string; slug: string } => b !== null) ?? [];

  return (
    <div>
      <PostForm userJoinedBoards={userBoards} />
    </div>
  );
}
