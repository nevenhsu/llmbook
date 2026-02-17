"use client";

import { useState, useEffect, useMemo } from "react";
import CommentItem from "./CommentItem";
import CommentSort from "./CommentSort";
import CommentEditorModal from "./CommentEditorModal";
import { useLoginModal } from "@/contexts/LoginModalContext";

interface CommentThreadProps {
  postId: string;
  userId?: string;
  isArchived?: boolean;
  isDeleted?: boolean;
}

export default function CommentThread({
  postId,
  userId,
  isArchived = false,
  isDeleted = false,
}: CommentThreadProps) {
  const isLocked = isArchived || isDeleted;
  const [comments, setComments] = useState<any[]>([]);
  const [sort, setSort] = useState("new");
  const [isLoading, setIsLoading] = useState(true);
  const { openLoginModal, openRegisterModal } = useLoginModal();

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
      const userVotes: Record<string, number | null> = data.userVotes || {};
      const commentsWithVotes = (data.comments || []).map((c: any) => ({
        ...c,
        userVote: userVotes[c.id] ?? null,
      }));
      setComments(commentsWithVotes);
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

  const tree = useMemo(() => {
    const map: Record<string, any> = {};
    comments.forEach((c) => {
      map[c.id] = { ...c, children: [] };
    });

    const roots: any[] = [];
    comments.forEach((c) => {
      if (c.parentId && map[c.parentId]) {
        map[c.parentId].children.push(map[c.id]);
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
        userVote={node.userVote ?? null}
        userId={userId}
        onRequestReply={!isLocked ? openReply : undefined}
        onRequestEdit={!isLocked ? openEdit : undefined}
        onChanged={fetchComments}
        isArchived={isArchived || isDeleted}
      >
        {node.children.length > 0 && (
          <div className="border-neutral ml-2 border-l pl-4">{renderComments(node.children)}</div>
        )}
      </CommentItem>
    ));
  };

  if (isLoading)
    return <div className="text-base-content/70 py-10 text-center">Loading comments...</div>;

  return (
    <div className="mt-4">
      <div className="flex items-start justify-between gap-3">
        <CommentSort currentSort={sort} onChange={setSort} />
        {userId && !isLocked ? (
          <button onClick={openCreate} className="btn btn-sm btn-primary">
            Add a comment
          </button>
        ) : !userId ? (
          <div className="text-base-content/70 text-xs">
            <button onClick={openLoginModal} className="text-accent font-bold hover:underline">
              Log in
            </button>{" "}
            or{" "}
            <button onClick={openRegisterModal} className="text-accent font-bold hover:underline">
              sign up
            </button>{" "}
            to leave a comment
          </div>
        ) : null}
      </div>
      <div className="space-y-4">
        {renderComments(tree)}
        {comments.length === 0 && (
          <div className="text-base-content/50 py-20 text-center">No comments yet.</div>
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
          onSuccess={(newComment) => {
            if (newComment && editorState.mode !== "edit") {
              // Optimistically append new comment to state (avoids full refetch)
              setComments((prev) =>
                sort === "new"
                  ? [{ ...newComment, userVote: null }, ...prev]
                  : [...prev, { ...newComment, userVote: null }],
              );
            } else {
              // For edits, or if comment data is missing, do a full refetch
              fetchComments();
            }
          }}
        />
      )}
    </div>
  );
}
