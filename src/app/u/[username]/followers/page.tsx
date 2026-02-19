"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { UserListItem } from "@/components/user/UserListItem";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import Skeleton from "@/components/ui/Skeleton";
import { ArrowLeft } from "lucide-react";
import type { UserListItem as UserListItemType } from "@/app/api/users/[userId]/followers/route";

export default function FollowersPage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [followers, setFollowers] = useState<UserListItemType[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  // Fetch user ID from username
  useEffect(() => {
    async function fetchUserId() {
      try {
        const res = await fetch(`/api/profile?username=${encodeURIComponent(username)}`);
        if (res.ok) {
          const data = await res.json();
          setUserId(data.user_id);
          setDisplayName(data.display_name || username);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    }
    fetchUserId();
  }, [username]);

  // Fetch current user
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          setCurrentUserId(data.user_id);
        }
      } catch {
        // Not logged in
      }
    }
    fetchCurrentUser();
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || !userId) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextCursor) params.set("cursor", nextCursor);
      params.set("limit", "20");

      const res = await fetch(`/api/users/${userId}/followers?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch followers");

      const data = await res.json();

      setFollowers((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (error) {
      console.error("Error loading followers:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, nextCursor, hasMore, isLoading]);

  // Initial load
  useEffect(() => {
    if (userId && followers.length === 0 && !isLoading) {
      loadMore();
    }
  }, [userId, followers.length, isLoading, loadMore]);

  const sentinelRef = useInfiniteScroll(loadMore, hasMore, isLoading);

  if (!userId) {
    return (
      <div className="bg-base-100 container mx-auto max-w-2xl p-4">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-base-100 container mx-auto max-w-2xl p-4">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="hover:bg-base-200 rounded-full p-2 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base-content text-2xl font-bold">Followers</h1>
          <p className="text-base-content/70 text-sm">People following {displayName}</p>
        </div>
      </div>

      <div className="space-y-3">
        {followers.map((follower: UserListItemType) => (
          <UserListItem
            key={follower.userId}
            userId={follower.userId}
            username={follower.username}
            displayName={follower.displayName}
            avatarUrl={follower.avatarUrl}
            karma={follower.karma}
            isFollowing={follower.isFollowing}
            currentUserId={currentUserId}
          />
        ))}

        {isLoading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {!isLoading && followers.length === 0 && (
          <div className="bg-base-200 rounded-lg p-8 text-center">
            <p className="text-base-content/70">No followers yet</p>
          </div>
        )}

        {hasMore && !isLoading && <div ref={sentinelRef} className="h-4" />}
      </div>
    </div>
  );
}
