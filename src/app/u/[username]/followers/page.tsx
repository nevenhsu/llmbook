"use client";

import { useParams, useRouter } from "next/navigation";
import { UserListItem } from "@/components/user/UserListItem";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useUserList } from "@/hooks/use-user-list";
import { useProfileData } from "@/hooks/use-profile-data";
import { useUserContext } from "@/contexts/UserContext";
import Skeleton from "@/components/ui/Skeleton";
import SearchBar from "@/components/ui/SearchBar";
import { ArrowLeft, Users, AlertCircle } from "lucide-react";

export default function FollowersPage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;

  // Use shared hooks
  const { userId, displayName, isLoading: profileLoading } = useProfileData(username);
  const { user } = useUserContext();
  const currentUserId = user?.id || null;

  // Use shared user list hook
  const {
    users: followers,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    searchQuery,
    setSearchQuery,
    loadMore,
    retry,
  } = useUserList({ userId, type: "followers" });

  const sentinelRef = useInfiniteScroll(loadMore, hasMore, isLoading || isLoadingMore);

  if (profileLoading || !userId) {
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
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="text-base-content/70 hover:text-base-content mb-4 flex items-center gap-2 text-sm font-medium transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Profile
      </button>

      <div className="mb-6">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-base-content text-2xl font-bold">Followers</h1>
        </div>

        {/* Stats and Search */}
        <div className="border-neutral mb-4 flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-base-content/70" />
            <span className="text-base-content text-sm font-bold">
              {followers.length} Followers
            </span>
          </div>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search followers..."
          />
        </div>
      </div>

      <div className="space-y-3">
        {/* Error State */}
        {error && (
          <div className="bg-error/10 border-error/20 rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-error mt-0.5 flex-shrink-0" size={20} />
              <div className="flex-1">
                <h3 className="text-error mb-1 text-sm font-semibold">Failed to load followers</h3>
                <p className="text-error/80 mb-3 text-xs">{error.message}</p>
                <button onClick={retry} className="btn btn-error btn-sm">
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* User List */}
        {!error &&
          followers.map((follower) => (
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

        {/* Initial Loading */}
        {isLoading && !isLoadingMore && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {/* Load More Loading */}
        {isLoadingMore && (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && followers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Users size={48} className="text-base-content/30 mb-4" />
            <h3 className="text-base-content mb-2 text-lg font-semibold">
              {searchQuery ? "No followers found" : "No followers yet"}
            </h3>
            <p className="text-base-content/60 text-center text-sm">
              {searchQuery
                ? `No followers match "${searchQuery}"`
                : "When people follow this user, they'll appear here"}
            </p>
          </div>
        )}

        {/* Infinite Scroll Sentinel */}
        {hasMore && !isLoading && !isLoadingMore && !error && (
          <div ref={sentinelRef} className="h-4" />
        )}
      </div>
    </div>
  );
}
