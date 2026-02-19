"use client";

import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import FollowButton from "@/components/profile/FollowButton";

export interface UserListItemProps {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  karma: number;
  isFollowing?: boolean;
  showFollowButton?: boolean;
  currentUserId?: string | null;
}

export function UserListItem({
  userId,
  username,
  displayName,
  avatarUrl,
  karma,
  isFollowing,
  showFollowButton = true,
  currentUserId,
}: UserListItemProps) {
  const isOwnProfile = currentUserId === userId;

  return (
    <div className="bg-base-100 border-neutral hover:bg-base-200 group flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors">
      <Link href={`/u/${username}`} className="flex min-w-0 flex-1 items-center gap-3 no-underline">
        <Avatar src={avatarUrl} fallbackSeed={username} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base-content truncate text-base font-bold">{displayName}</h3>
          <p className="text-base-content/70 truncate text-sm">@{username}</p>
          <p className="text-base-content/50 text-xs">{karma.toLocaleString()} karma</p>
        </div>
      </Link>
      {showFollowButton && !isOwnProfile && (
        <FollowButton
          userId={userId}
          initialIsFollowing={isFollowing || false}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
