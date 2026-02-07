"use client";

import { useState, useEffect, useMemo } from "react";
import CommentItem from "./CommentItem";
import CommentSort from "./CommentSort";

interface CommentThreadProps {
  postId: string;
  userId?: string;
}

export default function CommentThread({ postId, userId }: CommentThreadProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, number | null>>({});
  const [sort, setSort] = useState("best");
  const [isLoading, setIsLoading] = useState(true);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments?sort=${sort}`);
      const data = await res.json();
      setComments(data.comments || []);
      setUserVotes(data.userVotes || {});
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [postId, sort]);

  const handleVote = async (commentId: string, value: 1 | -1) => {
    const oldVote = userVotes[commentId] ?? null;

    // Optimistic update
    setUserVotes((prev) => ({
      ...prev,
      [commentId]: oldVote === value ? null : value,
    }));

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, value }),
      });
      const data = await res.json();
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, score: data.score } : c)),
      );
    } catch (err) {
      setUserVotes((prev) => ({ ...prev, [commentId]: oldVote }));
    }
  };

  const handleNewComment = (newComment: any) => {
    setComments((prev) => [newComment, ...prev]);
  };

  const tree = useMemo(() => {
    const map: Record<string, any> = {};
    comments.forEach((c) => {
      map[c.id] = { ...c, children: [] };
    });

    const roots: any[] = [];
    comments.forEach((c) => {
      if (c.parent_id && map[c.parent_id]) {
        map[c.parent_id].children.push(map[c.id]);
      } else {
        roots.push(map[c.id]);
      }
    });

    return roots;
  }, [comments]);

  const renderComments = (nodes: any[]) => {
    return nodes.map((node) => (
      <CommentItem
        key={node.id}
        comment={node}
        userVote={userVotes[node.id] as 1 | -1 | null}
        onVote={handleVote}
        postId={postId}
        userId={userId}
        onReply={handleNewComment}
      >
        {node.children.length > 0 && (
          <div className="ml-2 border-l border-border-default pl-4">
            {renderComments(node.children)}
          </div>
        )}
      </CommentItem>
    ));
  };

  if (isLoading)
    return (
      <div className="py-10 text-center text-text-secondary">
        Loading comments...
      </div>
    );

  return (
    <div className="mt-4">
      <CommentSort currentSort={sort} onChange={setSort} />
      <div className="space-y-4">
        {renderComments(tree)}
        {comments.length === 0 && (
          <div className="py-20 text-center text-text-muted">
            No comments yet.
          </div>
        )}
      </div>
    </div>
  );
}
