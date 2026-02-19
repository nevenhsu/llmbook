"use client";

import { useState, useMemo } from "react";
import { RefreshCw, UserPlus, Search } from "lucide-react";
import { UserListItem } from "@/components/user/UserListItem";
import SearchBar from "@/components/ui/SearchBar";
import type { UserListItem as UserListItemType } from "@/types/user";
import { MOCK_FOLLOWING, getMockFollowing } from "../followers/mock-data";

export default function FollowingPreviewPage() {
  const [following, setFollowing] = useState<UserListItemType[]>(() => {
    const { items } = getMockFollowing(undefined, 20);
    return items;
  });
  const [showEmpty, setShowEmpty] = useState(false);
  const [currentUserId] = useState("current-user-id");
  const [searchQuery, setSearchQuery] = useState("");

  // Mock follow toggle
  const handleFollowToggle = (userId: string, isFollowing: boolean) => {
    setFollowing((prev) =>
      prev.map((user) =>
        user.userId === userId ? { ...user, isFollowing } : user
      )
    );
  };

  // Filter following based on search query
  const filteredFollowing = useMemo(() => {
    if (!searchQuery.trim()) return following;
    
    const searchLower = searchQuery.toLowerCase();
    return following.filter(
      (user) =>
        user.username.toLowerCase().includes(searchLower) ||
        user.displayName.toLowerCase().includes(searchLower)
    );
  }, [following, searchQuery]);

  // Reset to initial state
  const handleReset = () => {
    const { items } = getMockFollowing(undefined, 20);
    setFollowing(items);
    setShowEmpty(false);
    setSearchQuery("");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:pb-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Following Preview</h1>
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
            {showEmpty ? "Show Following" : "Show Empty State"}
          </button>
        </div>
      </div>

      {/* Stats and Search */}
      <div className="border-neutral mb-4 flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <UserPlus size={20} className="text-base-content/70" />
          <span className="text-base-content text-sm font-bold">
            Following {searchQuery ? `${filteredFollowing.length} of ${following.length}` : following.length} users
          </span>
        </div>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search following..."
        />
      </div>

      {/* Main Content */}
      {showEmpty ? (
        <div className="flex flex-col items-center justify-center py-12">
          <UserPlus size={48} className="text-base-content/30 mb-4" />
          <h3 className="text-base-content mb-2 text-lg font-semibold">
            Not following anyone yet
          </h3>
          <p className="text-base-content/60 text-center text-sm">
            When this user follows people, they'll appear here
          </p>
        </div>
      ) : filteredFollowing.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Search size={48} className="text-base-content/30 mb-4" />
          <h3 className="text-base-content mb-2 text-lg font-semibold">No results found</h3>
          <p className="text-base-content/60 text-center text-sm">
            Try searching for a different username or display name
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFollowing.map((user) => (
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
          <li>✅ Displays list of users that the target user follows</li>
          <li>✅ Shows follow/unfollow button for each user</li>
          <li>✅ Displays karma and follow timestamp</li>
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
              GET /api/users/[userId]/following
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

      {/* Difference from Followers */}
      <div className="bg-info/10 border-info mt-4 rounded-lg border p-4">
        <h2 className="text-info mb-2 text-sm font-bold tracking-wider uppercase">
          Followers vs Following
        </h2>
        <div className="text-base-content/70 space-y-2 text-sm">
          <div>
            <strong>Followers:</strong> People who follow <em>this user</em>
          </div>
          <div>
            <strong>Following:</strong> People that <em>this user</em> follows
          </div>
          <div className="mt-2">
            <code className="bg-base-300 text-xs rounded px-2 py-1">
              GET /api/users/[userId]/followers
            </code>
            {" → "}
            <span className="text-xs">Query: <code>following_id = userId</code></span>
          </div>
          <div>
            <code className="bg-base-300 text-xs rounded px-2 py-1">
              GET /api/users/[userId]/following
            </code>
            {" → "}
            <span className="text-xs">Query: <code>follower_id = userId</code></span>
          </div>
        </div>
      </div>
    </div>
  );
}
