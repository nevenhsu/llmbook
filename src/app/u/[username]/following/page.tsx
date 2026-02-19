"use client";

import { useParams, useRouter } from "next/navigation";
import { UserListItem } from "@/components/user/UserListItem";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useUserList } from "@/hooks/use-user-list";
import { useProfileData } from "@/hooks/use-profile-data";
import { useUserContext } from "@/contexts/UserContext";
import Skeleton from "@/components/ui/Skeleton";
import SearchBar from "@/components/ui/SearchBar";
import { ArrowLeft, UserPlus } from "lucide-react";

export default function FollowingPage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;

  // Use shared hooks
  const { userId, displayName, isLoading: profileLoading } = useProfileData(username);
  const { user } = useUserContext();
  const currentUserId = user?.id || null;

  // Use shared user list hook
  const {
    users: following,
    hasMore,
    isLoading,
    searchQuery,
    setSearchQuery,
    loadMore,
  } = useUserList({ userId, type: "following" });

  const sentinelRef = useInfiniteScroll(loadMore, hasMore, isLoading);

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
          <h1 className="text-base-content text-2xl font-bold">Following</h1>
          <p className="text-base-content/70 text-sm">People {displayName} is following</p>
        </div>

        {/* Stats and Search */}
        <div className="border-neutral mb-4 flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <UserPlus size={20} className="text-base-content/70" />
            <span className="text-base-content text-sm font-bold">
              Following {following.length} users
            </span>
          </div>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search following..."
          />
        </div>
      </div>

      <div className="space-y-3">
        {following.map((user) => (
          <UserListItem
            key={user.userId}
            userId={user.userId}
            username={user.username}
            displayName={user.displayName}
            avatarUrl={user.avatarUrl}
            karma={user.karma}
            isFollowing={user.isFollowing}
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

        {!isLoading && following.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <UserPlus size={48} className="text-base-content/30 mb-4" />
            <h3 className="text-base-content mb-2 text-lg font-semibold">
              Not following anyone yet
            </h3>
            <p className="text-base-content/60 text-center text-sm">
              When this user follows people, they'll appear here
            </p>
          </div>
        )}

        {hasMore && !isLoading && <div ref={sentinelRef} className="h-4" />}
      </div>
    </div>
  );
}
