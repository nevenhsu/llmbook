"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import PostRow from "@/components/post/PostRow";
import Link from "next/link";
import { votePost, voteComment } from "@/lib/api/votes";
import { applyVote } from "@/lib/optimistic/vote";
import { useLoginModal } from "@/contexts/LoginModalContext";
import { ApiError } from "@/lib/api/fetch-json";
import {
  buildPostsQueryParams,
  getNextCursor,
  calculateHasMore,
} from "@/lib/pagination";

interface ProfilePostListProps {
  posts: any[];
  comments?: any[];
  displayName: string;
  username: string;
  tab: string;
  userId?: string;
  authorId?: string;
  personaId?: string;
  isOwnProfile?: boolean;
}

const DEFAULT_LIMIT = 20;

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
}: ProfilePostListProps) {
  const { openLoginModal } = useLoginModal();
  // Posts state
  const [posts, setPosts] = useState(initialPosts);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsHasMore, setPostsHasMore] = useState(calculateHasMore(initialPosts, DEFAULT_LIMIT));
  const [postsCursor, setPostsCursor] = useState<string | undefined>(getNextCursor(initialPosts));
  
  // Comments state
  const [comments, setComments] = useState(initialComments ?? []);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsHasMore, setCommentsHasMore] = useState(calculateHasMore(initialComments ?? [], DEFAULT_LIMIT));
  const [commentsCursor, setCommentsCursor] = useState<string | undefined>(getNextCursor(initialComments ?? []));
  const [commentVotes, setCommentVotes] = useState<Record<string, 1 | -1>>({});
  
  // Saved posts state
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedHasMore, setSavedHasMore] = useState(true);
  const [savedCursor, setSavedCursor] = useState<string | undefined>(undefined);
  const [hasLoadedSaved, setHasLoadedSaved] = useState(false);

  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Reset state when tab changes
  useEffect(() => {
    if (tab === 'posts') {
      setPosts(initialPosts);
      setPostsHasMore(calculateHasMore(initialPosts, DEFAULT_LIMIT));
      setPostsCursor(getNextCursor(initialPosts));
    } else if (tab === 'comments') {
      setComments(initialComments ?? []);
      setCommentsHasMore(calculateHasMore(initialComments ?? [], DEFAULT_LIMIT));
      setCommentsCursor(getNextCursor(initialComments ?? []));
    } else if (tab === 'saved' && isOwnProfile && !hasLoadedSaved) {
      // Initial load of saved posts
      loadMoreSaved();
      setHasLoadedSaved(true);
    }
  }, [tab, initialPosts, initialComments, isOwnProfile, hasLoadedSaved]);

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (tab === 'posts' && postsHasMore && !postsLoading) {
            loadMorePosts();
          } else if (tab === 'comments' && commentsHasMore && !commentsLoading) {
            loadMoreComments();
          } else if (tab === 'saved' && savedHasMore && !savedLoading) {
            loadMoreSaved();
          }
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [tab, postsHasMore, postsLoading, commentsHasMore, commentsLoading, savedHasMore, savedLoading, postsCursor, commentsCursor, savedCursor]);

  const loadMorePosts = async () => {
    if (postsLoading || !postsHasMore || (!authorId && !personaId)) return;

    setPostsLoading(true);
    try {
      const params = buildPostsQueryParams({
        author: authorId || undefined,
        sort: 'new',
        limit: DEFAULT_LIMIT,
        cursor: postsCursor,
      });

      const res = await fetch(`/api/posts?${params}`);
      if (!res.ok) throw new Error('Failed to load posts');

      const newPosts = await res.json();
      
      setPostsHasMore(calculateHasMore(newPosts, DEFAULT_LIMIT));
      setPostsCursor(getNextCursor(newPosts));
      setPosts(prev => [...prev, ...newPosts]);
    } catch (err) {
      console.error('Failed to load more posts:', err);
    } finally {
      setPostsLoading(false);
    }
  };

  const loadMoreComments = async () => {
    if (commentsLoading || !commentsHasMore || (!authorId && !personaId)) return;

    setCommentsLoading(true);
    try {
      const params = new URLSearchParams();
      if (authorId) params.append('authorId', authorId);
      if (personaId) params.append('personaId', personaId);
      if (commentsCursor) params.append('cursor', commentsCursor);
      params.append('limit', DEFAULT_LIMIT.toString());
      params.append('sort', 'new');

      const res = await fetch(`/api/profile/comments?${params}`);
      if (!res.ok) throw new Error('Failed to load comments');

      const data = await res.json();
      const newComments = data.comments ?? [];
      
      setCommentsHasMore(calculateHasMore(newComments, DEFAULT_LIMIT));
      setCommentsCursor(getNextCursor(newComments));
      setComments(prev => [...prev, ...newComments]);
      
      // Merge user votes
      if (data.userVotes) {
        setCommentVotes(prev => ({ ...prev, ...data.userVotes }));
      }
    } catch (err) {
      console.error('Failed to load more comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const loadMoreSaved = async () => {
    if (savedLoading || !savedHasMore || !isOwnProfile) return;

    setSavedLoading(true);
    try {
      const params = new URLSearchParams();
      if (savedCursor) params.append('cursor', savedCursor);
      params.append('limit', DEFAULT_LIMIT.toString());

      const res = await fetch(`/api/profile/saved?${params}`);
      if (!res.ok) throw new Error('Failed to load saved posts');

      const data = await res.json();
      const newPosts = data.posts ?? [];
      
      setSavedHasMore(calculateHasMore(newPosts, DEFAULT_LIMIT));
      // Use last saved_at as cursor
      const lastSavedAt = data.savedAt?.[data.savedAt.length - 1];
      setSavedCursor(lastSavedAt);
      setSavedPosts(prev => [...prev, ...newPosts]);
    } catch (err) {
      console.error('Failed to load more saved posts:', err);
    } finally {
      setSavedLoading(false);
    }
  };

  const handlePostVote = async (postId: string, value: 1 | -1) => {
    const postList = tab === 'saved' ? savedPosts : posts;
    const post = postList.find((p: any) => p.id === postId);
    if (!post) return;

    const oldPosts = [...postList];
    
    const optimisticResult = applyVote(
      { score: post.score || 0, userVote: post.userVote },
      value
    );

    const updatePosts = (prev: any[]) => prev.map((p: any) => 
      p.id === postId 
        ? { ...p, score: optimisticResult.score, userVote: optimisticResult.userVote }
        : p
    );

    if (tab === 'saved') {
      setSavedPosts(updatePosts);
    } else {
      setPosts(updatePosts);
    }

    try {
      const data = await votePost(postId, value);
      const reconcilePosts = (prev: any[]) => prev.map((p: any) => 
        p.id === postId ? { ...p, score: data.score } : p
      );
      
      if (tab === 'saved') {
        setSavedPosts(reconcilePosts);
      } else {
        setPosts(reconcilePosts);
      }
    } catch (err) {
      console.error('Failed to vote:', err);
      if (err instanceof ApiError && err.status === 401) {
        openLoginModal();
      }
      if (tab === 'saved') {
        setSavedPosts(oldPosts);
      } else {
        setPosts(oldPosts);
      }
    }
  };

  const handleCommentVote = async (commentId: string, value: 1 | -1) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    const prevVote = commentVotes[commentId] || null;
    const oldComments = [...comments];
    
    // Optimistic update
    const optimisticResult = applyVote(
      { score: comment.score || 0, userVote: prevVote },
      value
    );
    
    setCommentVotes(prev => ({
      ...prev,
      [commentId]: optimisticResult.userVote as 1 | -1,
    }));
    
    setComments(prev => prev.map(c => 
      c.id === commentId 
        ? { ...c, score: optimisticResult.score }
        : c
    ));

    try {
      const data = await voteComment(commentId, value);
      setComments(prev => prev.map(c => 
        c.id === commentId ? { ...c, score: data.score } : c
      ));
    } catch (err) {
      console.error('Failed to vote:', err);
      if (err instanceof ApiError && err.status === 401) {
        openLoginModal();
      }
      setComments(oldComments);
      setCommentVotes(prev => ({ ...prev, [commentId]: prevVote as 1 | -1 }));
    }
  };

  // Get current items based on tab
  const getCurrentItems = () => {
    switch (tab) {
      case 'posts': return posts;
      case 'comments': return comments;
      case 'saved': return savedPosts;
      default: return posts;
    }
  };

  const getIsLoading = () => {
    switch (tab) {
      case 'posts': return postsLoading;
      case 'comments': return commentsLoading;
      case 'saved': return savedLoading;
      default: return false;
    }
  };

  const getHasMore = () => {
    switch (tab) {
      case 'posts': return postsHasMore;
      case 'comments': return commentsHasMore;
      case 'saved': return savedHasMore;
      default: return false;
    }
  };

  const items = getCurrentItems();
  const isLoading = getIsLoading();
  const hasMore = getHasMore();

  if (items.length === 0 && !isLoading) {
    return (
      <div className="rounded-2xl px-5 py-14 text-center sm:py-20">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-base-300 text-base-content/70">
          <Sparkles size={24} />
        </div>
        <h2 className="text-lg font-semibold text-base-content">
          No {tab} yet
        </h2>
        <p className="mt-1 text-sm text-base-content/70">
          {username} 還沒有內容，開始互動來建立第一筆資料。
        </p>
      </div>
    );
  }

  // Render comments
  if (tab === 'comments') {
    return (
      <>
        {comments.map((comment: any) => {
          const post = Array.isArray(comment.posts) ? comment.posts[0] : comment.posts;
          const board = post?.boards;
          
          return (
            <div key={comment.id} className="p-4 hover:bg-base-100/50 transition-colors">
              <div className="text-xs text-base-content/70 mb-2">
                評論於{' '}
                <Link 
                  href={`/r/${board?.slug || 'unknown'}/posts/${post?.id}`}
                  className="font-semibold text-base-content hover:underline"
                >
                  {post?.title}
                </Link>
                {board?.slug && (
                  <>
                    {' '}在{' '}
                    <Link 
                      href={`/r/${board.slug}`}
                      className="text-accent hover:underline"
                    >
                      r/{board.slug}
                    </Link>
                  </>
                )}
              </div>
              <p className="text-sm text-base-content">{comment.body}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-base-content/60">
                <button
                  onClick={() => handleCommentVote(comment.id, 1)}
                  className={`hover:text-accent ${commentVotes[comment.id] === 1 ? 'text-accent' : ''}`}
                >
                  ▲
                </button>
                <span>{comment.score ?? 0} points</span>
                <button
                  onClick={() => handleCommentVote(comment.id, -1)}
                  className={`hover:text-error ${commentVotes[comment.id] === -1 ? 'text-error' : ''}`}
                >
                  ▼
                </button>
                <span>•</span>
                <span>{new Date(comment.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
        
        {/* Pagination trigger */}
        {hasMore && (
          <div ref={loadMoreRef} className="py-4 flex justify-center">
            {isLoading && <Loader2 size={24} className="animate-spin text-base-content/50" />}
          </div>
        )}

        {!hasMore && comments.length > 0 && (
          <div className="py-4 text-center text-sm text-base-content/50">
            You've reached the end
          </div>
        )}
      </>
    );
  }

  // Render posts (posts or saved tabs)
  const currentPosts = tab === 'saved' ? savedPosts : posts;
  
  return (
    <>
      {currentPosts.map((post: any) => (
        <PostRow
          key={post.id}
          id={post.id}
          title={post.title}
          score={post.score || 0}
          commentCount={post.comment_count || 0}
          boardName={post.boards?.name || post.boardName || ''}
          boardSlug={post.boards?.slug || post.boardSlug || ''}
          authorName={post.profiles?.display_name || post.authorName || displayName}
          authorUsername={post.profiles?.username || post.authorUsername || username}
          createdAt={post.created_at || post.createdAt}
          thumbnailUrl={post.media?.[0]?.url || post.thumbnailUrl}
          userVote={post.userVote}
          onVote={handlePostVote}
          userId={userId}
        />
      ))}
      
      {/* Pagination trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="py-4 flex justify-center">
          {isLoading && <Loader2 size={24} className="animate-spin text-base-content/50" />}
        </div>
      )}

      {!hasMore && currentPosts.length > 0 && (
        <div className="py-4 text-center text-sm text-base-content/50">
          You've reached the end
        </div>
      )}
    </>
  );
}
