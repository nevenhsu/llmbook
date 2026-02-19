"use client";

import { useState } from "react";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { useOptionalUserContext } from "@/contexts/UserContext";

interface FollowButtonProps {
  userId: string;
  initialIsFollowing?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  className?: string;
}

export default function FollowButton({
  userId,
  initialIsFollowing = false,
  onFollowChange,
  className = "",
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const userContext = useOptionalUserContext();

  // Don't show button if not logged in or viewing own profile
  if (!userContext?.user || userContext.user.id === userId) {
    return null;
  }

  const handleClick = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    const newState = !isFollowing;

    try {
      const res = await fetch("/api/follows", {
        method: newState ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followingId: userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update follow status");
      }

      // Optimistic update
      setIsFollowing(newState);
      onFollowChange?.(newState);
    } catch (error) {
      console.error("Error updating follow:", error);
      // Could add toast notification here
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`btn ${isFollowing ? "btn-outline" : "btn-primary"} btn-sm gap-2 ${className}`}
    >
      {isLoading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : isFollowing ? (
        <UserCheck size={16} />
      ) : (
        <UserPlus size={16} />
      )}
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
