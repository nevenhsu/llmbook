"use client";

import { useState } from "react";
import { UserPlus, UserMinus } from "lucide-react";
import { useLoginModal } from "@/contexts/LoginModalContext";
import { ApiError } from "@/lib/api/fetch-json";

interface FollowButtonProps {
  userId: string;
  initialIsFollowing: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  currentUserId?: string | null;
}

export default function FollowButton({
  userId,
  initialIsFollowing,
  onFollowChange,
  currentUserId,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const { openLoginModal } = useLoginModal();

  const handleToggleFollow = async () => {
    // Check if user is logged in
    if (!currentUserId) {
      openLoginModal();
      return;
    }

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
        
        // Show login modal on 401, otherwise show error
        if (response.status === 401) {
          openLoginModal();
        } else {
          alert(data.error || "Failed to update follow status");
        }
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
