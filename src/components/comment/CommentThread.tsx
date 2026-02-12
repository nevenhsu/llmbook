"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import CommentItem from "./CommentItem";
import CommentSort from "./CommentSort";
import CommentEditorModal from "./CommentEditorModal";
import { voteComment } from "@/lib/api/votes";

interface CommentThreadProps {
  postId: string;
  userId?: string;
}

export default function CommentThread({ postId, userId }: CommentThreadProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, number | null>>({});
  const [sort, setSort] = useState("best");
  const [isLoading, setIsLoading] = useState(true);

  const [editorState, setEditorState] = useState<{
    isOpen: boolean;
    mode: "create" | "edit" | "reply";
    parentId?: string;
    commentId?: string;
    initialContent?: string;
  }>({
    isOpen: false,
    mode: "create",
    parentId: undefined,
    commentId: undefined,
    initialContent: "",
  });

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

  const openCreate = () => {
    setEditorState({
      isOpen: true,
      mode: "create",
      parentId: undefined,
      commentId: undefined,
      initialContent: "",
    });
  };

  const openReply = (comment: any) => {
    setEditorState({
      isOpen: true,
      mode: "reply",
      parentId: comment.id,
      commentId: undefined,
      initialContent: "",
    });
  };

  const openEdit = (comment: any) => {
    setEditorState({
      isOpen: true,
      mode: "edit",
      parentId: undefined,
      commentId: comment.id,
      initialContent: comment.body ?? "",
    });
  };

  const handleVote = async (commentId: string, value: 1 | -1) => {
    const oldVote = userVotes[commentId] ?? null;

    // Optimistic update
    const newVote = oldVote === value ? null : value;
    setUserVotes((prev) => ({
      ...prev,
      [commentId]: newVote,
    }));

    try {
      const data = await voteComment(commentId, value);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, score: data.score } : c)),
      );
    } catch (err) {
      // Revert on error
      setUserVotes((prev) => ({ ...prev, [commentId]: oldVote }));
    }
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
        userId={userId}
        onRequestReply={openReply}
        onRequestEdit={openEdit}
        onChanged={fetchComments}
      >
        {node.children.length > 0 && (
          <div className="ml-2 border-l border-neutral pl-4">
            {renderComments(node.children)}
          </div>
        )}
      </CommentItem>
    ));
  };

  if (isLoading)
    return (
      <div className="py-10 text-center text-base-content/70">
        Loading comments...
      </div>
    );

  return (
    <div className="mt-4">
      <div className="flex items-start justify-between gap-3">
        <CommentSort currentSort={sort} onChange={setSort} />
        {userId ? (
          <button onClick={openCreate} className="btn btn-sm btn-primary">
            Add a comment
          </button>
        ) : (
          <div className="text-xs text-base-content/70">
            <Link href="/login" className="text-accent font-bold">
              Log in
            </Link>{" "}
            or{" "}
            <Link href="/register" className="text-accent font-bold">
              sign up
            </Link>{" "}
            to leave a comment
          </div>
        )}
      </div>
      <div className="space-y-4">
        {renderComments(tree)}
        {comments.length === 0 && (
          <div className="py-20 text-center text-base-content/50">
            No comments yet.
          </div>
        )}
      </div>

      {userId && (
        <CommentEditorModal
          isOpen={editorState.isOpen}
          onClose={() => setEditorState((prev) => ({ ...prev, isOpen: false }))}
          postId={postId}
          parentId={editorState.parentId}
          initialContent={editorState.initialContent}
          commentId={editorState.commentId}
          mode={editorState.mode}
          onSuccess={() => {
            fetchComments();
          }}
        />
      )}
    </div>
  );
}
