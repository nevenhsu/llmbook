"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import PostRow from "@/components/post/PostRow";
import Link from "next/link";
import PaginationClient from "@/components/ui/PaginationClient";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { voteComment } from "@/lib/api/votes";
import { useVote } from "@/hooks/use-vote";
import VotePill from "@/components/ui/VotePill";
import { toVoteValue } from "@/lib/vote-value";
import type { FeedPost, FormattedComment, VoteValue } from "@/lib/posts/query-builder";
import {
  buildPostsQueryParams as buildPostsQueryParamsLib,
  getNextCursor as getNextCursorLib,
  calculateHasMore as calculateHasMoreLib,
  type PaginatedResponse,
} from "@/lib/pagination";

function CommentVoteRow({
  commentId,
  initialScore,
  initialUserVote,
}: {
  commentId: string;
  initialScore: number;
  initialUserVote: VoteValue;
}) {
  const { score, userVote, handleVote, voteDisabled } = useVote({
    id: commentId,
    initialScore,
    initialUserVote,
    voteFn: voteComment,
  });
  return (
    <VotePill
      score={score}
      userVote={userVote}
      onVote={handleVote}
      disabled={voteDisabled}
      size="sm"
    />
  );
}

interface ProfilePostListProps {
  posts: FeedPost[];
  comments?: FormattedComment[];
  displayName: string;
  username: string;
  tab: string;
  userId?: string;
  authorId?: string;
  personaId?: string;
  isOwnProfile?: boolean;
  postsCount?: number;
  commentsCount?: number;
  savedCount?: number;
}

const DEFAULT_LIMIT = 10;

export default function ProfilePostList({
  posts: initialPosts,
  comments: initialComments,
  displayName,
  username,
  tab,
  userId,
  authorId,
  personaId,
  isOwnProfile,
  postsCount = 0,
  commentsCount = 0,
  savedCount = 0,
}: ProfilePostListProps) {
  // State
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsHasMore, setPostsHasMore] = useState(
    calculateHasMoreLib(initialPosts, DEFAULT_LIMIT),
  );
  const [postsCursor, setPostsCursor] = useState<string | undefined>(
    getNextCursorLib(initialPosts),
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);

  // Detection for mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const totalItems = tab === "posts" ? postsCount : tab === "comments" ? commentsCount : savedCount;
  const totalPages = Math.ceil(totalItems / DEFAULT_LIMIT);

  const handlePageChange = async (page: number) => {
    if (page === currentPage || page < 1 || page > totalPages) return;

    setPostsLoading(true);
    setCurrentPage(page);

    try {
      const offset = (page - 1) * DEFAULT_LIMIT;
      let url = "";

      if (tab === "posts") {
        const params = new URLSearchParams();
        if (authorId) params.append("author", authorId);
        if (personaId) params.append("persona", personaId);
        params.append("sort", "new");
        params.append("limit", DEFAULT_LIMIT.toString());
        params.append("offset", offset.toString());
        url = `/api/posts?${params.toString()}`;
      } else if (tab === "comments") {
        const params = new URLSearchParams();
        if (authorId) params.append("authorId", authorId);
        if (personaId) params.append("personaId", personaId);
        params.append("limit", DEFAULT_LIMIT.toString());
        params.append("offset", offset.toString());
        url = `/api/profile/comments?${params.toString()}`;
      } else if (tab === "saved") {
        url = `/api/profile/saved?limit=${DEFAULT_LIMIT}&offset=${offset}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (tab === "posts") {
        const items = (Array.isArray(data?.items) ? data.items : []) as FeedPost[];
        setPosts(items);
        setPostsHasMore(
          typeof data?.hasMore === "boolean" ? data.hasMore : items.length >= DEFAULT_LIMIT,
        );
        setPostsCursor(typeof data?.nextCursor === "string" ? data.nextCursor : undefined);
      } else if (tab === "comments") {
        const items = (Array.isArray(data?.items) ? data.items : []) as FormattedComment[];
        setComments(items);
        setCommentsHasMore(
          typeof data?.hasMore === "boolean" ? data.hasMore : items.length >= DEFAULT_LIMIT,
        );
        setCommentsCursor(typeof data?.nextCursor === "string" ? data.nextCursor : undefined);
      } else if (tab === "saved") {
        const items = (Array.isArray(data?.items) ? data.items : []) as FeedPost[];
        setSavedPosts(items);
        setSavedHasMore(
          typeof data?.hasMore === "boolean" ? data.hasMore : items.length >= DEFAULT_LIMIT,
        );
        setSavedCursor(typeof data?.nextCursor === "string" ? data.nextCursor : undefined);
      }

      // Scroll to top of list
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Failed to change page:", err);
    } finally {
      setPostsLoading(false);
    }
  };

  // Comments state
  const [comments, setComments] = useState<FormattedComment[]>(initialComments ?? []);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsHasMore, setCommentsHasMore] = useState(
    calculateHasMoreLib(initialComments ?? [], DEFAULT_LIMIT),
  );
  const [commentsCursor, setCommentsCursor] = useState<string | undefined>(
    getNextCursorLib(initialComments ?? []),
  );

  // Saved posts state
  const [savedPosts, setSavedPosts] = useState<FeedPost[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedHasMore, setSavedHasMore] = useState(true);
  const [savedCursor, setSavedCursor] = useState<string | undefined>(undefined);
  const [hasLoadedSaved, setHasLoadedSaved] = useState(false);

  const loadMoreSaved = useCallback(async () => {
    if (savedLoading || !savedHasMore || !isOwnProfile) return;

    setSavedLoading(true);
    try {
      const params = new URLSearchParams();
      if (savedCursor) params.append("cursor", savedCursor);
      params.append("limit", DEFAULT_LIMIT.toString());

      const res = await fetch(`/api/profile/saved?${params}`);
      if (!res.ok) throw new Error("Failed to load saved posts");

      const data = await res.json();
      const newPosts = (Array.isArray(data?.items) ? data.items : []) as FeedPost[];

      setSavedHasMore(
        typeof data?.hasMore === "boolean"
          ? data.hasMore
          : calculateHasMoreLib(newPosts, DEFAULT_LIMIT),
      );
      setSavedCursor(typeof data?.nextCursor === "string" ? data.nextCursor : undefined);
      setSavedPosts((prev) => [...prev, ...newPosts]);
    } catch (err) {
      console.error("Failed to load more saved posts:", err);
    } finally {
      setSavedLoading(false);
    }
  }, [isOwnProfile, savedCursor, savedHasMore, savedLoading]);

  // Reset state when tab changes
  useEffect(() => {
    setCurrentPage(1);
    if (tab === "posts") {
      setPosts(initialPosts);
      setPostsHasMore(calculateHasMoreLib(initialPosts, DEFAULT_LIMIT));
      setPostsCursor(getNextCursorLib(initialPosts));
    } else if (tab === "comments") {
      setComments(initialComments ?? []);
      setCommentsHasMore(calculateHasMoreLib(initialComments ?? [], DEFAULT_LIMIT));
      setCommentsCursor(getNextCursorLib(initialComments ?? []));
    } else if (tab === "saved" && isOwnProfile && !hasLoadedSaved) {
      // Initial load of saved posts
      loadMoreSaved();
      setHasLoadedSaved(true);
    }
  }, [tab, initialPosts, initialComments, isOwnProfile, hasLoadedSaved, loadMoreSaved]);

  const loadMorePosts = useCallback(async () => {
    if (postsLoading || !postsHasMore || (!authorId && !personaId)) return;

    setPostsLoading(true);
    try {
      const params = buildPostsQueryParamsLib({
        author: authorId || undefined,
        sort: "new",
        limit: DEFAULT_LIMIT,
        cursor: postsCursor,
      });

      const res = await fetch(`/api/posts?${params}`);
      if (!res.ok) throw new Error("Failed to load posts");

      const data = (await res.json()) as PaginatedResponse<FeedPost>;
      const newPosts = Array.isArray(data?.items) ? data.items : [];

      setPostsHasMore(!!data?.hasMore);
      setPostsCursor(
        typeof data?.nextCursor === "string" ? data.nextCursor : getNextCursorLib(newPosts),
      );
      setPosts((prev) => [...prev, ...newPosts]);
    } catch (err) {
      console.error("Failed to load more posts:", err);
    } finally {
      setPostsLoading(false);
    }
  }, [authorId, personaId, postsCursor, postsHasMore, postsLoading]);

  const loadMoreComments = useCallback(async () => {
    if (commentsLoading || !commentsHasMore || (!authorId && !personaId)) return;

    setCommentsLoading(true);
    try {
      const params = new URLSearchParams();
      if (authorId) params.append("authorId", authorId);
      if (personaId) params.append("personaId", personaId);
      if (commentsCursor) params.append("cursor", commentsCursor);
      params.append("limit", DEFAULT_LIMIT.toString());
      params.append("sort", "new");

      const res = await fetch(`/api/profile/comments?${params}`);
      if (!res.ok) throw new Error("Failed to load comments");

      const data = (await res.json()) as PaginatedResponse<FormattedComment>;
      const newComments = Array.isArray(data?.items) ? data.items : [];

      setCommentsHasMore(!!data?.hasMore);
      setCommentsCursor(
        typeof data?.nextCursor === "string" ? data.nextCursor : getNextCursorLib(newComments),
      );
      setComments((prev) => [...prev, ...newComments]);
    } catch (err) {
      console.error("Failed to load more comments:", err);
    } finally {
      setCommentsLoading(false);
    }
  }, [authorId, personaId, commentsCursor, commentsHasMore, commentsLoading]);

  // Get current items based on tab
  const getCurrentItems = () => {
    switch (tab) {
      case "posts":
        return posts;
      case "comments":
        return comments;
      case "saved":
        return savedPosts;
      default:
        return posts;
    }
  };

  const getIsLoading = () => {
    switch (tab) {
      case "posts":
        return postsLoading;
      case "comments":
        return commentsLoading;
      case "saved":
        return savedLoading;
      default:
        return false;
    }
  };

  const getHasMore = () => {
    switch (tab) {
      case "posts":
        return postsHasMore;
      case "comments":
        return commentsHasMore;
      case "saved":
        return savedHasMore;
      default:
        return false;
    }
  };

  const items = getCurrentItems();
  const isLoading = getIsLoading();
  const hasMore = getHasMore();

  const handleInfiniteLoad = useCallback(() => {
    if (tab === "posts") {
      void loadMorePosts();
      return;
    }
    if (tab === "comments") {
      void loadMoreComments();
      return;
    }
    if (tab === "saved") {
      void loadMoreSaved();
    }
  }, [loadMoreComments, loadMorePosts, loadMoreSaved, tab]);

  const loadMoreRef = useInfiniteScroll(handleInfiniteLoad, hasMore, isLoading, {
    enabled: !isMobile,
  });

  if (items.length === 0 && !isLoading) {
    return (
      <div className="rounded-2xl px-5 py-14 text-center sm:py-20">
        <div className="bg-base-300 text-base-content/70 mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full">
          <Sparkles size={24} />
        </div>
        <h2 className="text-base-content text-lg font-semibold">No {tab} yet</h2>
        <p className="text-base-content/70 mt-1 text-sm">
          {displayName || username} 還沒有內容，開始互動來建立第一筆資料。
        </p>
      </div>
    );
  }

  // Render comments
  if (tab === "comments") {
    return (
      <>
        <div className="bg-base-200 border-neutral divide-neutral divide-y overflow-hidden rounded-2xl border">
          {comments.map((comment) => {
            return (
              <div key={comment.id} className="hover:bg-base-100/50 p-4 transition-colors">
                <div className="text-base-content/70 mb-2 text-xs">
                  評論於{" "}
                  <Link
                    href={`/r/${comment.boardSlug || "unknown"}/posts/${comment.postId}`}
                    className="text-base-content font-semibold hover:underline"
                  >
                    {comment.postTitle}
                  </Link>
                  {comment.boardSlug && (
                    <>
                      {" "}
                      在{" "}
                      <Link
                        href={`/r/${comment.boardSlug}`}
                        className="text-accent hover:underline"
                      >
                        r/{comment.boardSlug}
                      </Link>
                    </>
                  )}
                </div>
                <p className="text-base-content text-sm">{comment.body}</p>
                <div className="text-base-content/60 mt-2 flex items-center gap-3 text-xs">
                  <CommentVoteRow
                    commentId={comment.id}
                    initialScore={comment.score ?? 0}
                    initialUserVote={toVoteValue(comment.userVote)}
                  />
                  <span>•</span>
                  <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination/Infinite Scroll Controls */}
        {isMobile ? (
          <div className="flex justify-center py-6">
            <PaginationClient
              page={currentPage}
              totalPages={totalPages}
              onPageChange={(p) => void handlePageChange(p)}
              joinClassName="border-neutral border"
              buttonClassName="bg-base-100"
              activeButtonClassName="btn-primary"
            />
          </div>
        ) : (
          <>
            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center py-4">
                {isLoading && <Loader2 size={24} className="text-base-content/50 animate-spin" />}
              </div>
            )}

            {!hasMore && comments.length > 0 && (
              <div className="text-base-content/50 py-8 text-center text-sm">
                You've reached the end
              </div>
            )}
          </>
        )}
      </>
    );
  }

  // Render posts (posts or saved tabs)
  const currentPosts = tab === "saved" ? savedPosts : posts;

  return (
    <>
      <div className="flex flex-col gap-3">
        {currentPosts.map((post: FeedPost) => (
          <PostRow key={post.id} {...post} userId={userId} variant="card" />
        ))}
      </div>

      {/* Pagination/Infinite Scroll Controls */}
      {isMobile ? (
        <div className="flex justify-center py-6">
          <PaginationClient
            page={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => void handlePageChange(p)}
            joinClassName="border-neutral border"
            buttonClassName="bg-base-100"
            activeButtonClassName="btn-primary"
          />
        </div>
      ) : (
        <>
          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-4">
              {isLoading && <Loader2 size={24} className="text-base-content/50 animate-spin" />}
            </div>
          )}

          {!hasMore && currentPosts.length > 0 && (
            <div className="text-base-content/50 py-8 text-center text-sm">
              You've reached the end
            </div>
          )}
        </>
      )}
    </>
  );
}
