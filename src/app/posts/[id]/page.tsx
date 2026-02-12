import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import PostMeta from '@/components/post/PostMeta';
import PostDetailVote from '@/components/post/PostDetailVote';
import PostActions from '@/components/post/PostActions';
import CommentForm from '@/components/comment/CommentForm';
import CommentThread from '@/components/comment/CommentThread';
import SafeHtml from '@/components/ui/SafeHtml';
import PollDisplay from '@/components/post/PollDisplay';
import BoardInfoCard from '@/components/board/BoardInfoCard';
import BoardRulesCard from '@/components/board/BoardRulesCard';
import BoardModeratorsCard from '@/components/board/BoardModeratorsCard';
import Link from 'next/link';
import { Archive } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient(cookies());
  const { data: { user } } = await supabase.auth.getUser();

  const { data: post } = await supabase
    .from('posts')
    .select(`
      id, title, body, created_at, score, comment_count, persona_id, post_type, status, board_id,
      boards!inner(id, name, slug, description, member_count, post_count, icon_url, created_at, rules),
      profiles(username, display_name, avatar_url),
      personas(username, display_name, avatar_url, slug),
      media(url)
    `)
    .eq('id', id)
    .maybeSingle() as { data: any | null };

  // Get poll options if it's a poll post
  let pollOptions = null;
  let userPollVote = null;
  if (post?.post_type === 'poll') {
    const { data: options } = await supabase
      .from('poll_options')
      .select('id, text, vote_count, position')
      .eq('post_id', id)
      .order('position');
    pollOptions = options;

    if (user && options) {
      const optionIds = options.map(o => o.id);
      const { data: vote } = await supabase
        .from('poll_votes')
        .select('option_id')
        .eq('user_id', user.id)
        .in('option_id', optionIds)
        .maybeSingle();
      userPollVote = vote?.option_id || null;
    }
  }

  if (!post) {
    return (
      <div className="bg-base-100 p-6 rounded-md border border-neutral">
        <h1 className="text-xl font-semibold text-base-content">Post not found</h1>
        <Link href="/" className="text-accent mt-4 inline-block">
          Back to feed
        </Link>
      </div>
    );
  }

  const board = Array.isArray(post.boards) ? post.boards[0] : post.boards;
  const isPersona = !!post.persona_id;
  const author = isPersona ? post.personas : post.profiles;
  const authorData = Array.isArray(author) ? author[0] : author;
  const authorName = authorData?.display_name ?? 'Anonymous';
  const authorUsername = authorData?.username ?? null;
  const authorAvatar = authorData?.avatar_url ?? null;

  let userVote: 1 | -1 | null = null;
  let isJoined = false;
  if (user) {
    const { data: vote } = await supabase
      .from('votes')
      .select('value')
      .eq('user_id', user.id)
      .eq('post_id', id)
      .maybeSingle();
    userVote = vote?.value ?? null;

    // Check if user is a member of the board
    if (board?.id) {
      const { data: membership } = await supabase
        .from('board_members')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('board_id', board.id)
        .maybeSingle();
      isJoined = !!membership;
    }
  }

  // Get moderators
  let moderators: any[] = [];
  if (board?.id) {
    const { data: modData } = await supabase
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
    moderators = (modData || []).map((mod: any) => ({
      ...mod,
      profiles: Array.isArray(mod.profiles) ? mod.profiles[0] : mod.profiles,
    }));
  }

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        <article className="bg-base-200 border border-neutral rounded-md overflow-hidden flex">
          <div className="w-10 bg-base-100/30 flex flex-col items-center py-2 border-r border-neutral">
            <PostDetailVote 
              postId={id} 
              initialScore={post.score ?? 0} 
              initialUserVote={userVote} 
            />
          </div>

          <div className="flex-1 p-4">
            <PostMeta 
              boardName={board?.name ?? ''} 
              boardSlug={board?.slug ?? ''} 
              authorName={authorName}
              authorUsername={authorUsername}
              authorAvatarUrl={authorAvatar}
              isPersona={isPersona}
              createdAt={post.created_at} 
            />
            
            <h1 className="text-2xl sm:text-3xl font-bold text-base-content mt-2 mb-4 font-display">
              {post.title}
            </h1>

            {post.status === 'ARCHIVED' && (
              <div className="rounded-box bg-warning/10 border border-warning px-4 py-3 mb-4">
                <div className="flex items-center gap-2">
                  <Archive size={16} className="text-warning shrink-0" />
                  <p className="text-sm text-warning">This post has been archived by moderators</p>
                </div>
              </div>
            )}

            {post.post_type === 'poll' ? (
              <PollDisplay
                postId={id}
                initialOptions={pollOptions || []}
                initialUserVote={userPollVote}
              />
            ) : (
              <>
                <SafeHtml html={post.body} className="text-sm text-base-content mb-4" />

                {post.media?.map((m: any, i: number) => (
                  <div key={i} className="mt-4 rounded-md overflow-hidden border border-neutral bg-black">
                    <img src={m.url} alt="" className="max-w-full h-auto mx-auto" />
                  </div>
                ))}
              </>
            )}

            <div className="mt-4 pt-2 border-t border-neutral">
              <PostActions postId={id} commentCount={post.comment_count ?? 0} />
            </div>
          </div>
        </article>

        <div className="mt-4 bg-base-200 border border-neutral rounded-md p-4">
          {user ? (
            <CommentForm postId={id} />
          ) : (
            <div className="py-4 text-center border border-dashed border-neutral rounded-md">
              <p className="text-sm text-base-content/70">
                <Link href="/login" className="text-accent">Log in</Link> or <Link href="/register" className="text-accent">sign up</Link> to leave a comment
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 bg-base-200 border border-neutral rounded-md p-4">
          <CommentThread postId={id} userId={user?.id} />
        </div>
      </div>

      <aside className="hidden lg:block w-[312px] space-y-4">
        {board && (
          <>
            <BoardInfoCard board={board} isMember={isJoined} />
            <BoardRulesCard rules={board.rules || []} />
            <BoardModeratorsCard moderators={moderators} />
          </>
        )}
      </aside>
    </div>
  );
}
