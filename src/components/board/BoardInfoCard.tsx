"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Hash, ShieldBan } from "lucide-react";
import { FormattedBoard } from "@/lib/posts/query-builder";
import toast from "react-hot-toast";
import { apiPatch, apiDelete, ApiError } from "@/lib/api/fetch-json";
import JoinButton from "./JoinButton";
import Avatar from "@/components/ui/Avatar";

interface Rule {
  title: string;
  description: string;
}

interface Moderator {
  user_id: string;
  role: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
    username: string | null;
  };
}

interface BoardInfoCardProps {
  board: FormattedBoard;
  isMember: boolean;
  canOpenSettings: boolean;
  isAdmin: boolean;
  rules?: Rule[];
  moderators?: Moderator[];
}

export default function BoardInfoCard({
  board,
  isMember,
  canOpenSettings,
  isAdmin,
  rules = [],
  moderators = [],
}: BoardInfoCardProps) {
  const router = useRouter();
  const createdDate = new Date(board.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const [isArchived, setIsArchived] = useState(board.isArchived);
  const [archiveLoading, setArchiveLoading] = useState(false);

  useEffect(() => {
    setIsArchived(board.isArchived);
  }, [board.isArchived]);

  const handleArchiveToggle = async () => {
    setArchiveLoading(true);
    try {
      if (isArchived) {
        await apiPatch(`/api/boards/${board.slug}`, { is_archived: false });
      } else {
        await apiDelete(`/api/boards/${board.slug}`);
      }
      setIsArchived(!isArchived);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof ApiError
          ? error.message
          : isArchived
            ? "Failed to unarchive board"
            : "Failed to archive board",
      );
    } finally {
      setArchiveLoading(false);
    }
  };

  return (
    <div className="card bg-base-100 rounded-box space-y-4 p-4">
      {/* 1. Board Name */}
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full">
          <Hash size={24} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold">r/{board.slug}</h2>
        </div>
      </div>

      {/* 2. Buttons */}
      <div className="flex items-center gap-2">
        <JoinButton slug={board.slug} isJoined={isMember} joinLabel="Join" joinedLabel="Joined" />

        {(canOpenSettings || isAdmin) && (
          <Link
            href={`/r/${board.slug}/settings`}
            className="btn btn-sm btn-outline text-base-content rounded-full"
          >
            Settings
          </Link>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={handleArchiveToggle}
            disabled={archiveLoading}
            className={`btn btn-sm rounded-full ${isArchived ? "btn-success" : "btn-warning text-warning-content"}`}
          >
            {archiveLoading ? "..." : isArchived ? "Unarchive" : "Archive"}
          </button>
        )}
      </div>

      {/* 3. Member/Ban/Post Counts */}
      <div className="stats stats-vertical bg-base-100 border-base-200 border shadow">
        <Link
          href={`/r/${board.slug}/member`}
          className="stat text-base-content hover:bg-base-200 px-3 py-2 no-underline transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="stat-title text-xs">Members</div>
              <div className="stat-value text-lg">{board.memberCount.toLocaleString()}</div>
            </div>
            <ChevronRight size={16} className="opacity-70" />
          </div>
        </Link>
        <Link
          href={`/r/${board.slug}/ban`}
          className="stat text-base-content hover:bg-base-200 px-3 py-2 no-underline transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="stat-title text-xs">Bans</div>
              <div className="stat-value text-lg">
                <ShieldBan size={16} />
              </div>
            </div>
            <ChevronRight size={16} className="opacity-70" />
          </div>
        </Link>
        <div className="stat px-3 py-2">
          <div className="stat-title text-xs">Posts</div>
          <div className="stat-value text-lg">{board.postCount.toLocaleString()}</div>
        </div>
      </div>

      {/* 4. Description */}
      {board.description && <p className="text-base-content/70 text-sm">{board.description}</p>}

      {/* 5. Created Time */}
      <div className="text-base-content/70 text-xs">Created {createdDate}</div>

      {/* 6. Community Rules */}
      {rules && rules.length > 0 && (
        <div className="border-base-200 border-t pt-4">
          <h3 className="mb-3 font-bold">Community Rules</h3>
          <div className="space-y-2">
            {rules.map((rule, index) => (
              <div
                key={index}
                className="collapse-arrow bg-base-100 border-base-300 collapse border"
              >
                <input type="checkbox" />
                <div className="collapse-title text-sm font-semibold">
                  {index + 1}. {rule.title}
                </div>
                {rule.description && (
                  <div className="collapse-content text-sm">
                    <p className="text-base-content/70">{rule.description}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Moderators */}
      {moderators && moderators.length > 0 && (
        <div className="border-base-200 border-t pt-4">
          <h3 className="mb-3 font-bold">Moderators</h3>
          <div className="space-y-2">
            {moderators.map((mod) => {
              const username =
                mod.profiles.username ||
                mod.profiles.display_name.toLowerCase().replace(/\s+/g, "");
              return (
                <Link
                  key={mod.user_id}
                  href={`/u/${username}`}
                  className="hover:bg-base-200 rounded-box flex items-center gap-3 p-2 no-underline transition-colors"
                >
                  <Avatar
                    src={mod.profiles.avatar_url}
                    fallbackSeed={mod.profiles.display_name}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{mod.profiles.display_name}</p>
                    <p className="text-base-content/60 truncate text-xs">@{username}</p>
                  </div>
                  <span
                    className={`badge badge-xs ${mod.role === "owner" ? "badge-primary" : "badge-ghost"}`}
                  >
                    {mod.role === "owner" ? "Owner" : "Mod"}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
