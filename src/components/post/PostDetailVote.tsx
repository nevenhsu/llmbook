"use client";

import VotePill from "@/components/ui/VotePill";
import { votePost } from "@/lib/api/votes";
import { useVote } from "@/hooks/use-vote";

interface PostDetailVoteProps {
  postId: string;
  initialScore: number;
  initialUserVote: 1 | -1 | null;
  status?: string;
}

export default function PostDetailVote({
  postId,
  initialScore,
  initialUserVote,
  status,
}: PostDetailVoteProps) {
  const { score, userVote, handleVote, voteDisabled } = useVote({
    id: postId,
    initialScore,
    initialUserVote,
    voteFn: votePost,
    disabled: status === "ARCHIVED" || status === "DELETED",
  });

  return (
    <VotePill
      score={score}
      userVote={userVote}
      onVote={handleVote}
      disabled={voteDisabled}
      orientation="vertical"
      size="md"
    />
  );
}
