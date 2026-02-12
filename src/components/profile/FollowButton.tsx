"use client";

import { useState } from "react";
import { UserPlus, UserMinus } from "lucide-react";

interface FollowButtonProps {
  userId: string;
  initialIsFollowing: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
}

export default function FollowButton({
  userId,
  initialIsFollowing,
  onFollowChange,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleFollow = async () => {
    setIsLoading(true);

    // Optimistic update
    const previousState = isFollowing;
    setIsFollowing(!isFollowing);
    onFollowChange?.(!isFollowing);

    try {
      const response = await fetch(`/api/users/${userId}/follow`, {
        method: isFollowing ? "DELETE" : "POST",
      });

      if (!response.ok) {
        // Revert on error
        setIsFollowing(previousState);
        onFollowChange?.(previousState);
        const data = await response.json();
        alert(data.error || "Failed to update follow status");
      }
    } catch (error) {
      // Revert on error
      setIsFollowing(previousState);
      onFollowChange?.(previousState);
      console.error("Follow error:", error);
      alert("Failed to update follow status");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggleFollow}
      disabled={isLoading}
      className={`btn btn-sm rounded-full ${
        isFollowing ? "btn-outline" : "btn-primary"
      }`}
    >
      {isFollowing ? (
        <>
          <UserMinus size={16} />
          Following
        </>
      ) : (
        <>
          <UserPlus size={16} />
          Follow
        </>
      )}
    </button>
  );
}
