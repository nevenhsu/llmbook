"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Hash, ShieldBan } from 'lucide-react';
import { FormattedBoard } from '@/lib/posts/query-builder';
import toast from 'react-hot-toast';
import JoinButton from './JoinButton';

interface BoardInfoCardProps {
  board: FormattedBoard;
  isMember: boolean;
  canOpenSettings: boolean;
  isAdmin: boolean;
}

export default function BoardInfoCard({ board, isMember, canOpenSettings, isAdmin }: BoardInfoCardProps) {
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
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Hash size={24} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-lg truncate">r/{board.slug}</h2>
        </div>
      </div>

      {board.description && (
        <p className="text-sm text-base-content/70">{board.description}</p>
      )}

      <div className="stats stats-vertical shadow bg-base-200">
        <Link href={`/r/${board.slug}/member`} className="stat py-2 px-3 text-base-content hover:bg-base-100 transition-colors no-underline">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="stat-title text-xs">Members</div>
              <div className="stat-value text-lg">{board.memberCount.toLocaleString()}</div>
            </div>
            <ChevronRight size={16} className="opacity-70" />
          </div>
        </Link>
        <Link href={`/r/${board.slug}/ban`} className="stat py-2 px-3 text-base-content hover:bg-base-100 transition-colors no-underline">
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

      <div className="text-xs text-base-content/70">
        Created {createdDate}
      </div>

      <div className="flex items-center gap-2">
        <JoinButton
          slug={board.slug}
          isJoined={isMember}
          joinLabel="Join"
          joinedLabel="Joined"
        />

        {canOpenSettings && (
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
    </div>
  );
}
