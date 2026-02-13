import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/get-user';
import PostMeta from '@/components/post/PostMeta';
import PostDetailVote from '@/components/post/PostDetailVote';
import CommentThread from '@/components/comment/CommentThread';
import SafeHtml from '@/components/ui/SafeHtml';
import PollDisplay from '@/components/post/PollDisplay';
import Link from 'next/link';
import { Archive } from 'lucide-react';
import { notFound } from 'next/navigation';
import PostActionsWrapper from '@/components/post/PostActionsWrapper';
import { getBoardBySlug } from '@/lib/boards/get-board-by-slug';

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function PostDetailPage({ params }: PageProps) {
  const { slug, id } = await params;
  const supabase = await createClient();
  const user = await getUser();

  const board = await getBoardBySlug(slug);

  if (!board) {
    notFound();
  }

  // Get the post and verify it belongs to this board
  const { data: post } = await supabase
    .from('posts')
    .select(`
      id, title, body, created_at, updated_at, score, comment_count, persona_id, post_type, status, author_id,
      profiles(username, display_name, avatar_url),
      personas(username, display_name, avatar_url),
      media(url)
    `)
    .eq('id', id)
    .eq('board_id', board.id)
    .maybeSingle() as { data: any | null };

  if (!post) {
    notFound();
  }

  // Get poll options if it's a poll post
  let pollOptions = null;
  let userPollVote = null;
  if (post.post_type === 'poll') {
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

  const isPersona = !!post.persona_id;
  const author = isPersona ? post.personas : post.profiles;
  const authorData = Array.isArray(author) ? author[0] : author;
  const authorName = authorData?.display_name ?? 'Anonymous';
  const authorUsername = authorData?.username ?? null;
  const authorAvatar = authorData?.avatar_url ?? null;

  // Get user vote
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
    <article className="bg-base-200 border border-neutral rounded-md overflow-hidden flex flex-col">
      <div className="flex">
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
          
          <h1 className="text-2xl sm:text-3xl font-bold text-base-content mt-2 mb-2 font-display">
            {post.title}
          </h1>

          {/* Show "Edited" badge if post was updated */}
          {post.updated_at && new Date(post.updated_at).getTime() > new Date(post.created_at).getTime() + 60000 && (
            <p className="text-xs text-base-content/50 mb-4">
              <span className="inline-flex items-center gap-1">
                <span className="font-semibold">Edited</span>
                <span>·</span>
                <time dateTime={post.updated_at}>
                  {new Date(post.updated_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </time>
              </span>
            </p>
          )}

          {/* ARCHIVED banner */}
          {post.status === 'ARCHIVED' && (
            <div className="rounded-box bg-warning/10 border border-warning px-4 py-3 mb-4">
              <div className="flex items-center gap-2">
                <Archive size={16} className="text-warning shrink-0" />
                <p className="text-sm text-warning font-semibold">This post has been archived by moderators</p>
              </div>
            </div>
          )}

          {/* DELETED state - show message instead of content */}
          {post.status === 'DELETED' ? (
            <div className="rounded-box bg-error/10 border border-error px-6 py-8 text-center mb-4">
              <p className="text-lg font-semibold text-error mb-2">
                This post has been deleted
              </p>
              <p className="text-sm text-base-content/70">
                The content is no longer available.
              </p>
            </div>
          ) : (
            /* Show content for PUBLISHED and ARCHIVED posts */
            <>
              {post.post_type === 'poll' ? (
                <PollDisplay
                  postId={id}
                  initialOptions={pollOptions || []}
                  initialUserVote={userPollVote}
                />
              ) : (
                <>
                  <SafeHtml html={post.body} className="tiptap-html text-sm text-base-content mb-4" />

                  {post.media?.map((m: any, i: number) => (
                    <div key={i} className="mt-4 rounded-md overflow-hidden border border-neutral bg-black">
                      <img src={m.url} alt="" className="max-w-full h-auto mx-auto" />
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          <div className="mt-4 pt-2 border-t border-neutral">
            <PostActionsWrapper
              postId={id} 
              boardSlug={slug} 
              commentCount={post.comment_count ?? 0}
              authorId={post.author_id}
              status={post.status}
              inDetailPage={true}
            />
          </div>
        </div>
      </div>

      <div className="bg-base-200 border-t border-neutral p-4">
        <CommentThread postId={id} userId={user?.id} isArchived={post.status === 'ARCHIVED'} />
      </div>
    </article>
  );
}
