"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface JoinButtonProps {
  slug: string;
  isJoined: boolean;
  joinLabel?: string;
  joinedLabel?: string;
  fullWidth?: boolean;
  refreshOnSuccess?: boolean;
  onMemberCountChange?: (memberCount: number) => void;
}

export default function JoinButton({
  slug,
  isJoined: initialJoined,
  joinLabel = "Join",
  joinedLabel = "Joined",
  fullWidth = false,
  refreshOnSuccess = true,
  onMemberCountChange,
}: JoinButtonProps) {
  const [isJoined, setIsJoined] = useState(initialJoined);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/boards/${slug}/join`, {
        method: isJoined ? "DELETE" : "POST",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      let payload: { memberCount?: number } | null = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      if (typeof payload?.memberCount === "number") {
        onMemberCountChange?.(payload.memberCount);
      }

      setIsJoined(!isJoined);
      if (refreshOnSuccess) {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      toast.error(isJoined ? "Failed to leave board" : "Failed to join board");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isLoading}
      className={`btn btn-sm rounded-full ${fullWidth ? "w-full" : ""} ${isJoined ? "btn-outline" : "btn-primary"}`}
    >
      {isLoading ? "..." : isJoined ? joinedLabel : joinLabel}
    </button>
  );
}
