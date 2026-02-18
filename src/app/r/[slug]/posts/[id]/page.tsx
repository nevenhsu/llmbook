import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import PostMeta from "@/components/post/PostMeta";
import PostDetailVote from "@/components/post/PostDetailVote";
import CommentThread from "@/components/comment/CommentThread";
import SafeHtml from "@/components/ui/SafeHtml";
import PollDisplay from "@/components/post/PollDisplay";
import { Archive, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import PostActionsWrapper from "@/components/post/PostActionsWrapper";
import { getBoardBySlug } from "@/lib/boards/get-board-by-slug";
import { transformPostToFeedFormat } from "@/lib/posts/query-builder";
import { getPostForDetail } from "@/lib/posts/get-post-by-id";
import TagList from "@/components/post/TagList";
import type { PostPageProps } from "@/types/pages";

export default async function PostDetailPage({ params }: PostPageProps) {
  const { slug, id } = await params;
  const supabase = await createClient();
  const user = await getUser();

  const board = await getBoardBySlug(slug);

  if (!board) {
    notFound();
  }

  // Get the post and verify it belongs to this board
  const postData = await getPostForDetail(id, board.id);

  if (!postData) {
    notFound();
  }

  // Get poll options if it's a poll post
  let pollOptions = null;
  let userPollVote = null;
  if (postData.post_type === "poll") {
    const { data: options } = await supabase
      .from("poll_options")
      .select("id, text, vote_count, position")
      .eq("post_id", id)
      .order("position");
    pollOptions = options;

    if (user && options) {
      const optionIds = options.map((o) => o.id);
      const { data: vote } = await supabase
        .from("poll_votes")
        .select("option_id")
        .eq("user_id", user.id)
        .in("option_id", optionIds)
        .maybeSingle();
      userPollVote = vote?.option_id || null;
    }
  }

  // Get user interactions
  let userVote: 1 | -1 | null = null;
  let isHidden = false;
  let isSaved = false;

  if (user) {
    const [voteRes, hiddenRes, savedRes] = await Promise.all([
      supabase.from("votes").select("value").eq("user_id", user.id).eq("post_id", id).maybeSingle(),
      supabase
        .from("hidden_posts")
        .select("post_id")
        .eq("user_id", user.id)
        .eq("post_id", id)
        .maybeSingle(),
      supabase
        .from("saved_posts")
        .select("post_id")
        .eq("user_id", user.id)
        .eq("post_id", id)
        .maybeSingle(),
    ]);

    userVote = (voteRes.data?.value as 1 | -1) ?? null;
    isHidden = !!hiddenRes.data;
    isSaved = !!savedRes.data;
  }

  // Transform post to standard format
  const post = transformPostToFeedFormat(postData, { userVote, isHidden, isSaved });

  return (
    <article className="bg-base-200 border-neutral flex flex-col overflow-hidden rounded-md border">
      <div className="flex">
        <div className="bg-base-100/30 border-neutral flex w-10 flex-col items-center border-r py-2">
          <PostDetailVote
            postId={id}
            initialScore={post.score ?? 0}
            initialUserVote={userVote}
            status={post.status}
          />
        </div>

        <div className="flex-1 p-4">
          <PostMeta
            boardName={post.boardName}
            boardSlug={post.boardSlug}
            authorName={post.authorName}
            authorUsername={post.authorUsername}
            authorAvatarUrl={post.authorAvatarUrl}
            isPersona={post.isPersona}
            createdAt={post.createdAt}
          />

          <h1 className="text-base-content font-display mt-2 mb-2 text-2xl font-bold sm:text-3xl">
            {post.title}
          </h1>

          <TagList tags={post.tags ?? []} className="mb-3" />

          {/* Show "Edited" badge if post was updated */}
          {post.updatedAt &&
            new Date(post.updatedAt).getTime() > new Date(post.createdAt).getTime() + 60000 && (
              <p className="text-base-content/50 mb-4 text-xs">
                <span className="inline-flex items-center gap-1">
                  <span className="font-semibold">Edited</span>
                  <span>·</span>
                  <time dateTime={post.updatedAt}>
                    {new Date(post.updatedAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </span>
              </p>
            )}

          {/* ARCHIVED banner */}
          {post.status === "ARCHIVED" && (
            <div className="rounded-box bg-warning/10 border-warning mb-4 border px-4 py-3">
              <div className="flex items-center gap-2">
                <Archive size={16} className="text-warning shrink-0" />
                <p className="text-warning text-sm font-semibold">
                  This post has been archived by moderators
                </p>
              </div>
            </div>
          )}

          {/* DELETED banner */}
          {post.status === "DELETED" && (
            <div className="rounded-box bg-error/10 border-error mb-4 border px-6 py-8 text-center">
              <div className="flex flex-col items-center gap-2">
                <Trash2 size={24} className="text-error mb-2" />
                <p className="text-error text-lg font-bold">This post has been deleted</p>
                <p className="text-base-content/60 text-sm">
                  The content is no longer public but the record is kept for historical purposes.
                </p>
              </div>
            </div>
          )}

          {/* Show content ONLY for non-DELETED posts */}
          {post.status !== "DELETED" && (
            <>
              {postData.post_type === "poll" ? (
                <PollDisplay
                  postId={id}
                  initialOptions={pollOptions || []}
                  initialUserVote={userPollVote}
                />
              ) : (
                <>
                  <SafeHtml
                    html={postData.body}
                    className="tiptap-html text-base-content mb-4 text-sm"
                  />

                  {postData.media?.map((m, i: number) => (
                    <div
                      key={i}
                      className="border-neutral mt-4 overflow-hidden rounded-md border bg-black"
                    >
                      <img src={m.url} alt="" className="mx-auto h-auto max-w-full" />
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          <div className="border-neutral mt-4 border-t pt-2">
            <PostActionsWrapper
              postId={id}
              boardSlug={slug}
              commentCount={post.commentCount}
              authorId={post.authorId}
              status={post.status}
              inDetailPage={true}
              isHidden={isHidden}
              isSaved={isSaved}
            />
          </div>
        </div>
      </div>

      {post.status !== "DELETED" && (
        <div className="bg-base-200 border-neutral border-t p-4">
          <CommentThread
            postId={id}
            userId={user?.id}
            isArchived={post.status === "ARCHIVED"}
            isDeleted={post.status === "DELETED"}
          />
        </div>
      )}
    </article>
  );
}
