"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Hash, ShieldBan } from 'lucide-react';
import { FormattedBoard } from '@/lib/posts/query-builder';
import toast from 'react-hot-toast';
import JoinButton from './JoinButton';
import Avatar from '@/components/ui/Avatar';

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

export default function BoardInfoCard({ board, isMember, canOpenSettings, isAdmin, rules = [], moderators = [] }: BoardInfoCardProps) {
  const router = useRouter();
  const createdDate = new Date(board.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const [isArchived, setIsArchived] = useState(board.isArchived);
  const [archiveLoading, setArchiveLoading] = useState(false);

  useEffect(() => {
    setIsArchived(board.isArchived);
  }, [board.isArchived]);

  const handleArchiveToggle = async () => {
    setArchiveLoading(true);
    try {
      const res = await fetch(`/api/boards/${board.slug}`, {
        method: isArchived ? 'PATCH' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: isArchived ? JSON.stringify({ is_archived: false }) : undefined,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setIsArchived(!isArchived);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(isArchived ? 'Failed to unarchive board' : 'Failed to archive board');
    } finally {
      setArchiveLoading(false);
    }
  };

  return (
    <div className="card bg-base-100 rounded-box p-4 space-y-4">
      {/* 1. Board Name */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Hash size={24} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-lg truncate">r/{board.slug}</h2>
        </div>
      </div>

      {/* 2. Buttons */}
      <div className="flex items-center gap-2">
        <JoinButton
          slug={board.slug}
          isJoined={isMember}
          joinLabel="Join"
          joinedLabel="Joined"
        />

        {(canOpenSettings || isAdmin) && (
          <Link href={`/r/${board.slug}/settings`} className="btn btn-sm btn-outline rounded-full text-base-content">
            Settings
          </Link>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={handleArchiveToggle}
            disabled={archiveLoading}
            className={`btn btn-sm rounded-full ${isArchived ? 'btn-success' : 'btn-warning text-warning-content'}`}
          >
            {archiveLoading ? '...' : isArchived ? 'Unarchive' : 'Archive'}
          </button>
        )}
      </div>

      {/* 3. Member/Ban/Post Counts */}
      <div className="stats stats-vertical shadow bg-base-100 border border-base-200">
        <Link href={`/r/${board.slug}/member`} className="stat py-2 px-3 text-base-content hover:bg-base-200 transition-colors no-underline">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="stat-title text-xs">Members</div>
              <div className="stat-value text-lg">{board.memberCount.toLocaleString()}</div>
            </div>
            <ChevronRight size={16} className="opacity-70" />
          </div>
        </Link>
        <Link href={`/r/${board.slug}/ban`} className="stat py-2 px-3 text-base-content hover:bg-base-200 transition-colors no-underline">
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
        <div className="stat py-2 px-3">
          <div className="stat-title text-xs">Posts</div>
          <div className="stat-value text-lg">{board.postCount.toLocaleString()}</div>
        </div>
      </div>

      {/* 4. Description */}
      {board.description && (
        <p className="text-sm text-base-content/70">{board.description}</p>
      )}

      {/* 5. Created Time */}
      <div className="text-xs text-base-content/70">
        Created {createdDate}
      </div>

      {/* 6. Community Rules */}
      {rules && rules.length > 0 && (
        <div className="border-t border-base-200 pt-4">
          <h3 className="font-bold mb-3">Community Rules</h3>
          <div className="space-y-2">
            {rules.map((rule, index) => (
              <div key={index} className="collapse collapse-arrow bg-base-100 border-base-300 border">
                <input type="checkbox" />
                <div className="collapse-title font-semibold text-sm">
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
        <div className="border-t border-base-200 pt-4">
          <h3 className="font-bold mb-3">Moderators</h3>
          <div className="space-y-2">
            {moderators.map((mod) => {
              const username = mod.profiles.username || mod.profiles.display_name.toLowerCase().replace(/\s+/g, "");
              return (
                <Link
                  key={mod.user_id}
                  href={`/u/${username}`}
                  className="flex items-center gap-3 p-2 hover:bg-base-200 rounded-box transition-colors no-underline"
                >
                  <Avatar
                    src={mod.profiles.avatar_url}
                    fallbackSeed={mod.profiles.display_name}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{mod.profiles.display_name}</p>
                    <p className="text-xs text-base-content/60 truncate">@{username}</p>
                  </div>
                  <span className={`badge badge-xs ${mod.role === 'owner' ? 'badge-primary' : 'badge-ghost'}`}>
                    {mod.role === 'owner' ? 'Owner' : 'Mod'}
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
