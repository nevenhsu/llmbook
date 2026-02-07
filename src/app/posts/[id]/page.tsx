import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import PostMeta from '@/components/post/PostMeta';
import VotePill from '@/components/ui/VotePill';
import PostActions from '@/components/post/PostActions';
import CommentForm from '@/components/comment/CommentForm';
import CommentThread from '@/components/comment/CommentThread';
import SafeHtml from '@/components/ui/SafeHtml';
import PollDisplay from '@/components/post/PollDisplay';
import Link from 'next/link';

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
      id, title, body, created_at, score, comment_count, persona_id, post_type,
      boards!inner(id, name, slug, description),
      profiles(display_name, avatar_url),
      personas(display_name, avatar_url, slug),
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
      <div className="bg-surface p-6 rounded-md border border-border-default">
        <h1 className="text-xl font-semibold text-text-primary">Post not found</h1>
        <Link href="/" className="text-accent-link hover:underline mt-4 inline-block">
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

  let userVote: 1 | -1 | null = null;
  if (user) {
    const { data: vote } = await supabase
      .from('votes')
      .select('value')
      .eq('user_id', user.id)
      .eq('post_id', id)
      .maybeSingle();
    userVote = vote?.value ?? null;
  }

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        <article className="bg-canvas border border-border-default rounded-md overflow-hidden flex">
          <div className="w-10 bg-surface/30 flex flex-col items-center py-2 border-r border-border-default">
            <VotePill score={post.score ?? 0} userVote={userVote as any} onVote={() => {}} orientation="vertical" size="md" />
          </div>

          <div className="flex-1 p-4">
            <PostMeta 
              boardName={board?.name ?? ''} 
              boardSlug={board?.slug ?? ''} 
              authorName={authorName} 
              isPersona={isPersona}
              createdAt={post.created_at} 
            />
            
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary mt-2 mb-4 font-display">
              {post.title}
            </h1>

            {post.post_type === 'poll' ? (
              <PollDisplay
                postId={id}
                initialOptions={pollOptions || []}
                initialUserVote={userPollVote}
              />
            ) : (
              <>
                <SafeHtml html={post.body} className="text-sm text-text-primary mb-4" />

                {post.media?.map((m: any, i: number) => (
                  <div key={i} className="mt-4 rounded-md overflow-hidden border border-border-default bg-black">
                    <img src={m.url} alt="" className="max-w-full h-auto mx-auto" />
                  </div>
                ))}
              </>
            )}

            <div className="mt-4 pt-2 border-t border-border-default">
              <PostActions postId={id} commentCount={post.comment_count ?? 0} />
            </div>
          </div>
        </article>

        <div className="mt-4 bg-canvas border border-border-default rounded-md p-4">
          {user ? (
            <CommentForm postId={id} onSubmit={() => {}} />
          ) : (
            <div className="py-4 text-center border border-dashed border-border-default rounded-md">
              <p className="text-sm text-text-secondary">
                <Link href="/login" className="text-accent-link hover:underline">Log in</Link> or <Link href="/register" className="text-accent-link hover:underline">sign up</Link> to leave a comment
              </p>
            </div>
          )}
          
          <CommentThread postId={id} userId={user?.id} />
        </div>
      </div>

      <aside className="hidden lg:block w-[312px] space-y-4">
        {board && (
          <div className="bg-surface rounded-md border border-border-default p-4">
            <h3 className="font-bold text-text-primary mb-2">About r/{board.name}</h3>
            <p className="text-sm text-text-secondary mb-4">{board.description}</p>
            <div className="flex items-center justify-between text-xs text-text-primary border-t border-border-default pt-4">
              <div className="flex flex-col">
                <span className="font-bold">1.2k</span>
                <span className="text-text-secondary">Members</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold">42</span>
                <span className="text-text-secondary">Online</span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
