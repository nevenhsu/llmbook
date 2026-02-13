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
  buildPostsQueryParams as buildPostsQueryParamsLib,
  getNextCursor as getNextCursorLib,
  calculateHasMore as calculateHasMoreLib
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
  const { openLoginModal } = useLoginModal();
  // State
  const [posts, setPosts] = useState(initialPosts);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsHasMore, setPostsHasMore] = useState(calculateHasMoreLib(initialPosts, DEFAULT_LIMIT));
  const [postsCursor, setPostsCursor] = useState<string | undefined>(getNextCursorLib(initialPosts));
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  
  // Detection for mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const totalItems = tab === 'posts' ? postsCount : tab === 'comments' ? commentsCount : savedCount;
  const totalPages = Math.ceil(totalItems / DEFAULT_LIMIT);

  const handlePageChange = async (page: number) => {
    if (page === currentPage || page < 1 || page > totalPages) return;
    
    setPostsLoading(true);
    setCurrentPage(page);
    
    try {
      const offset = (page - 1) * DEFAULT_LIMIT;
      let url = "";
      
      if (tab === 'posts') {
        const params = new URLSearchParams();
        if (authorId) params.append('author', authorId);
        if (personaId) params.append('persona', personaId);
        params.append('sort', 'new');
        params.append('limit', DEFAULT_LIMIT.toString());
        params.append('offset', offset.toString());
        url = `/api/posts?${params.toString()}`;
      } else if (tab === 'comments') {
        const params = new URLSearchParams();
        if (authorId) params.append('authorId', authorId);
        if (personaId) params.append('personaId', personaId);
        params.append('limit', DEFAULT_LIMIT.toString());
        params.append('offset', offset.toString());
        url = `/api/profile/comments?${params.toString()}`;
      } else if (tab === 'saved') {
        url = `/api/profile/saved?limit=${DEFAULT_LIMIT}&offset=${offset}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      const newItems = tab === 'comments' ? (data.comments ?? []) : (tab === 'saved' ? (data.posts ?? []) : data);
      
      setPosts(newItems);
      if (tab === 'comments') setComments(newItems);
      if (tab === 'saved') setSavedPosts(newItems);
      
      // Scroll to top of list
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Failed to change page:', err);
    } finally {
      setPostsLoading(false);
    }
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    
    return (
      <div className="flex justify-center py-6">
        <div className="join border border-neutral">
          <button 
            className="join-item btn btn-sm bg-base-100"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            «
          </button>
          {[...Array(totalPages)].map((_, i) => {
            const p = i + 1;
            // Only show a few pages around current if many
            if (totalPages > 5 && Math.abs(p - currentPage) > 1 && p !== 1 && p !== totalPages) {
              if (p === 2 || p === totalPages - 1) return <button key={p} className="join-item btn btn-sm btn-disabled bg-base-100">...</button>;
              return null;
            }
            return (
              <button 
                key={p} 
                className={`join-item btn btn-sm ${currentPage === p ? 'btn-active btn-primary' : 'bg-base-100'}`}
                onClick={() => handlePageChange(p)}
              >
                {p}
              </button>
            );
          })}
          <button 
            className="join-item btn btn-sm bg-base-100"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            »
          </button>
        </div>
      </div>
    );
  };

  // Comments state
  const [comments, setComments] = useState(initialComments ?? []);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsHasMore, setCommentsHasMore] = useState(calculateHasMoreLib(initialComments ?? [], DEFAULT_LIMIT));
  const [commentsCursor, setCommentsCursor] = useState<string | undefined>(getNextCursorLib(initialComments ?? []));
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
    setCurrentPage(1);
    if (tab === 'posts') {
      setPosts(initialPosts);
      setPostsHasMore(calculateHasMoreLib(initialPosts, DEFAULT_LIMIT));
      setPostsCursor(getNextCursorLib(initialPosts));
    } else if (tab === 'comments') {
      setComments(initialComments ?? []);
      setCommentsHasMore(calculateHasMoreLib(initialComments ?? [], DEFAULT_LIMIT));
      setCommentsCursor(getNextCursorLib(initialComments ?? []));
    } else if (tab === 'saved' && isOwnProfile && !hasLoadedSaved) {
      // Initial load of saved posts
      loadMoreSaved();
      setHasLoadedSaved(true);
    }
  }, [tab, initialPosts, initialComments, isOwnProfile, hasLoadedSaved]);

  // Setup intersection observer for infinite scroll - ONLY ON DESKTOP
  useEffect(() => {
    if (isMobile) return;
    
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
  }, [tab, postsHasMore, postsLoading, commentsHasMore, commentsLoading, savedHasMore, savedLoading, postsCursor, commentsCursor, savedCursor, isMobile]);

  const loadMorePosts = async () => {
    if (postsLoading || !postsHasMore || (!authorId && !personaId)) return;

    setPostsLoading(true);
    try {
      const params = buildPostsQueryParamsLib({
        author: authorId || undefined,
        sort: 'new',
        limit: DEFAULT_LIMIT,
        cursor: postsCursor,
      });

      const res = await fetch(`/api/posts?${params}`);
      if (!res.ok) throw new Error('Failed to load posts');

      const newPosts = await res.json();
      
      setPostsHasMore(calculateHasMoreLib(newPosts, DEFAULT_LIMIT));
      setPostsCursor(getNextCursorLib(newPosts));
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
      
      setCommentsHasMore(calculateHasMoreLib(newComments, DEFAULT_LIMIT));
      setCommentsCursor(getNextCursorLib(newComments));
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
      
      setSavedHasMore(calculateHasMoreLib(newPosts, DEFAULT_LIMIT));
      // Use last saved_at as cursor (standardized in API now)
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
        <div className="bg-base-200 border border-neutral rounded-2xl divide-y divide-neutral overflow-hidden">
          {comments.map((comment: any) => {
            return (
              <div key={comment.id} className="p-4 hover:bg-base-100/50 transition-colors">
                <div className="text-xs text-base-content/70 mb-2">
                  評論於{' '}
                  <Link 
                    href={`/r/${comment.boardSlug || 'unknown'}/posts/${comment.postId}`}
                    className="font-semibold text-base-content hover:underline"
                  >
                    {comment.postTitle}
                  </Link>
                  {comment.boardSlug && (
                    <>
                      {' '}在{' '}
                      <Link 
                        href={`/r/${comment.boardSlug}`}
                        className="text-accent hover:underline"
                      >
                        r/{comment.boardSlug}
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
                  <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Pagination/Infinite Scroll Controls */}
        {isMobile ? (
          renderPagination()
        ) : (
          <>
            {hasMore && (
              <div ref={loadMoreRef} className="py-4 flex justify-center">
                {isLoading && <Loader2 size={24} className="animate-spin text-base-content/50" />}
              </div>
            )}

            {!hasMore && comments.length > 0 && (
              <div className="py-8 text-center text-sm text-base-content/50">
                You've reached the end
              </div>
            )}
          </>
        )}
      </>
    );
  }

  // Render posts (posts or saved tabs)
  const currentPosts = tab === 'saved' ? savedPosts : posts;
  
  return (
    <>
      <div className="bg-base-200 border border-neutral rounded-2xl divide-y divide-neutral overflow-hidden">
        {currentPosts.map((post: any) => (
          <PostRow
            key={post.id}
            {...post}
            onVote={handlePostVote}
            userId={userId}
          />
        ))}
      </div>
      
      {/* Pagination/Infinite Scroll Controls */}
      {isMobile ? (
        renderPagination()
      ) : (
        <>
          {hasMore && (
            <div ref={loadMoreRef} className="py-4 flex justify-center">
              {isLoading && <Loader2 size={24} className="animate-spin text-base-content/50" />}
            </div>
          )}

          {!hasMore && currentPosts.length > 0 && (
            <div className="py-8 text-center text-sm text-base-content/50">
              You've reached the end
            </div>
          )}
        </>
      )}
    </>
  );
}
