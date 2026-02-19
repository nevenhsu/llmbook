"use client";

import { useState, useMemo } from "react";
import { RefreshCw, Users, Search } from "lucide-react";
import { UserListItem } from "@/components/user/UserListItem";
import SearchBar from "@/components/ui/SearchBar";
import type { UserListItem as UserListItemType } from "@/types/user";
import { MOCK_FOLLOWERS, getMockFollowers } from "./mock-data";

export default function FollowersPreviewPage() {
  const [followers, setFollowers] = useState<UserListItemType[]>(() => {
    const { items } = getMockFollowers(undefined, 20);
    return items;
  });
  const [showEmpty, setShowEmpty] = useState(false);
  const [currentUserId] = useState("current-user-id");
  const [searchQuery, setSearchQuery] = useState("");

  // Mock follow toggle
  const handleFollowToggle = (userId: string, isFollowing: boolean) => {
    setFollowers((prev) =>
      prev.map((user) =>
        user.userId === userId ? { ...user, isFollowing } : user
      )
    );
  };

  // Filter followers based on search query
  const filteredFollowers = useMemo(() => {
    if (!searchQuery.trim()) return followers;
    
    const searchLower = searchQuery.toLowerCase();
    return followers.filter(
      (user) =>
        user.username.toLowerCase().includes(searchLower) ||
        user.displayName.toLowerCase().includes(searchLower)
    );
  }, [followers, searchQuery]);

  // Reset to initial state
  const handleReset = () => {
    const { items } = getMockFollowers(undefined, 20);
    setFollowers(items);
    setShowEmpty(false);
    setSearchQuery("");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:pb-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Followers Preview</h1>
        <button
          onClick={handleReset}
          className="btn btn-ghost btn-sm gap-2"
          title="Reset to initial state"
        >
          <RefreshCw size={16} />
          Reset
        </button>
      </div>

      {/* Preview Controls */}
      <div className="bg-base-200 border-neutral mb-4 rounded-lg border p-4">
        <h2 className="text-base-content/70 mb-2 text-sm font-bold tracking-wider uppercase">
          Preview Controls
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowEmpty(!showEmpty)}
            className={`btn btn-sm ${showEmpty ? "btn-primary" : "btn-outline"}`}
          >
            {showEmpty ? "Show Followers" : "Show Empty State"}
          </button>
        </div>
      </div>

      {/* Stats and Search */}
      <div className="border-neutral mb-4 flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-base-content/70" />
          <span className="text-base-content text-sm font-bold">
            {searchQuery ? `${filteredFollowers.length} of ${followers.length}` : followers.length} Followers
          </span>
        </div>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search followers..."
        />
      </div>

      {/* Main Content */}
      {showEmpty ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Users size={48} className="text-base-content/30 mb-4" />
          <h3 className="text-base-content mb-2 text-lg font-semibold">No followers yet</h3>
          <p className="text-base-content/60 text-center text-sm">
            When people follow this user, they'll appear here
          </p>
        </div>
      ) : filteredFollowers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Search size={48} className="text-base-content/30 mb-4" />
          <h3 className="text-base-content mb-2 text-lg font-semibold">No results found</h3>
          <p className="text-base-content/60 text-center text-sm">
            Try searching for a different username or display name
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFollowers.map((user) => (
            <UserListItem
              key={user.userId}
              userId={user.userId}
              username={user.username}
              displayName={user.displayName}
              avatarUrl={user.avatarUrl}
              karma={user.karma}
              isFollowing={user.isFollowing}
              showFollowButton={true}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}

      {/* Info Panel */}
      <div className="bg-base-200 border-neutral mt-8 rounded-lg border p-4">
        <h2 className="text-base-content/70 mb-2 text-sm font-bold tracking-wider uppercase">
          Component Info
        </h2>
        <ul className="text-base-content/70 space-y-1 text-sm">
          <li>✅ Displays list of users who follow the target user</li>
          <li>✅ Shows follow/unfollow button for each user</li>
          <li>✅ Displays karma and follower count</li>
          <li>✅ Supports empty state</li>
          <li>✅ Click avatar or name to visit profile</li>
          <li>✅ Responsive layout</li>
        </ul>
      </div>

      {/* API Reference */}
      <div className="bg-base-200 border-neutral mt-4 rounded-lg border p-4">
        <h2 className="text-base-content/70 mb-2 text-sm font-bold tracking-wider uppercase">
          API Reference
        </h2>
        <div className="text-base-content/70 space-y-2 text-sm">
          <div>
            <code className="bg-base-300 rounded px-2 py-1">
              GET /api/users/[userId]/followers
            </code>
          </div>
          <div className="mt-2">
            <strong>Query Parameters:</strong>
            <ul className="ml-4 mt-1 list-disc">
              <li><code>cursor</code> - Pagination cursor (ISO timestamp)</li>
              <li><code>limit</code> - Number of items per page (default: 20, max: 50)</li>
            </ul>
          </div>
          <div className="mt-2">
            <strong>Response:</strong>
            <pre className="bg-base-300 mt-1 overflow-x-auto rounded p-2 text-xs">
{`{
  "items": [
    {
      "userId": "uuid",
      "username": "string",
      "displayName": "string",
      "avatarUrl": "string | null",
      "karma": number,
      "followedAt": "ISO timestamp",
      "isFollowing": boolean
    }
  ],
  "hasMore": boolean,
  "nextCursor": "ISO timestamp | undefined"
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
