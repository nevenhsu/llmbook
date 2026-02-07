'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/ui/Avatar';

interface BoardMember {
  user_id: string;
  joined_at: string | null;
  is_moderator: boolean;
  profiles: {
    display_name?: string;
    avatar_url?: string | null;
  } | null;
}

interface BannedUser {
  id: string;
  user_id: string;
  reason: string | null;
  expires_at: string | null;
  user?: {
    display_name?: string;
    avatar_url?: string | null;
  };
  profiles?: {
    display_name?: string;
    avatar_url?: string | null;
  };
}

interface BoardMemberManagementProps {
  boardSlug: string;
  currentUserId: string;
  canEditBans: boolean;
  members: BoardMember[];
  bans: BannedUser[];
}

function formatDateTime(value: string | null) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
}

export default function BoardMemberManagement({
  boardSlug,
  currentUserId,
  canEditBans,
  members,
  bans
}: BoardMemberManagementProps) {
  const router = useRouter();
  const [memberTab, setMemberTab] = useState<'members' | 'bans'>('members');
  const [membersList, setMembersList] = useState<BoardMember[]>(members);
  const [bansList, setBansList] = useState<BannedUser[]>(bans);
  const [banUserId, setBanUserId] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banExpiresAt, setBanExpiresAt] = useState('');
  const [kickLoadingUserId, setKickLoadingUserId] = useState<string | null>(null);
  const [banLoading, setBanLoading] = useState(false);
  const [unbanLoadingUserId, setUnbanLoadingUserId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const bannedUserIds = useMemo(() => new Set(bansList.map((ban) => ban.user_id)), [bansList]);
  const bannableMembers = useMemo(
    () => membersList.filter((member) => !member.is_moderator && !bannedUserIds.has(member.user_id)),
    [membersList, bannedUserIds]
  );

  const kickMember = async (userId: string) => {
    const confirmed = window.confirm('Kick this member from the board?');
    if (!confirmed) return;

    setKickLoadingUserId(userId);
    setError('');

    try {
      const res = await fetch(`/api/boards/${boardSlug}/members/${userId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        throw new Error('Failed to kick member.');
      }

      setMembersList((prev) => prev.filter((member) => member.user_id !== userId));
      router.refresh();
    } catch (err) {
      console.error(err);
      setError('Failed to kick member.');
    } finally {
      setKickLoadingUserId(null);
    }
  };

  const handleBanUser = async () => {
    if (!banUserId) {
      setError('Please select a member to ban.');
      return;
    }

    setBanLoading(true);
    setError('');

    try {
      const payload: Record<string, string> = { user_id: banUserId };
      if (banReason.trim()) payload.reason = banReason.trim();
      if (banExpiresAt) {
        const expiresAt = new Date(banExpiresAt);
        if (!Number.isNaN(expiresAt.getTime())) {
          payload.expires_at = expiresAt.toISOString();
        }
      }

      const res = await fetch(`/api/boards/${boardSlug}/bans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Failed to ban user.');
      }

      const ban: BannedUser = await res.json();
      setBansList((prev) => [ban, ...prev.filter((item) => item.user_id !== ban.user_id)]);
      setMembersList((prev) => prev.filter((member) => member.user_id !== ban.user_id));
      setBanUserId('');
      setBanReason('');
      setBanExpiresAt('');
      router.refresh();
    } catch (err) {
      console.error(err);
      setError('Failed to ban user.');
    } finally {
      setBanLoading(false);
    }
  };

  const handleUnbanUser = async (userId: string) => {
    setUnbanLoadingUserId(userId);
    setError('');

    try {
      const res = await fetch(`/api/boards/${boardSlug}/bans/${userId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        throw new Error('Failed to unban user.');
      }

      setBansList((prev) => prev.filter((ban) => ban.user_id !== userId));
      router.refresh();
    } catch (err) {
      console.error(err);
      setError('Failed to unban user.');
    } finally {
      setUnbanLoadingUserId(null);
    }
  };

  const getBanDisplayName = (ban: BannedUser) => ban.user?.display_name || ban.profiles?.display_name || 'Unknown';
  const getBanAvatar = (ban: BannedUser) => ban.user?.avatar_url || ban.profiles?.avatar_url || null;

  return (
    <div className="space-y-4">
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div role="tablist" className="tabs tabs-boxed w-fit">
        <button
          role="tab"
          className={`tab ${memberTab === 'members' ? 'tab-active' : ''}`}
          onClick={() => setMemberTab('members')}
        >
          Members ({membersList.length})
        </button>
        <button
          role="tab"
          className={`tab ${memberTab === 'bans' ? 'tab-active' : ''}`}
          onClick={() => setMemberTab('bans')}
        >
          Bans ({bansList.length})
        </button>
      </div>

      {memberTab === 'members' && (
        <div className="space-y-3">
          {membersList.length === 0 ? (
            <div className="alert">
              <span>No members found.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {membersList.map((member) => {
                const isSelf = member.user_id === currentUserId;
                const isKickDisabled = !canEditBans || member.is_moderator || isSelf || kickLoadingUserId === member.user_id;

                return (
                  <div key={member.user_id} className="card bg-surface p-3 flex flex-row items-center gap-3">
                    <Avatar
                      src={member.profiles?.avatar_url || undefined}
                      fallbackSeed={member.profiles?.display_name || member.user_id}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{member.profiles?.display_name || 'Unknown'}</p>
                      <p className="text-xs opacity-70">Joined: {formatDateTime(member.joined_at)}</p>
                      {member.is_moderator && <span className="badge badge-ghost badge-xs mt-1">moderator</span>}
                    </div>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => kickMember(member.user_id)}
                      disabled={isKickDisabled}
                      title={
                        !canEditBans
                          ? 'Insufficient permissions'
                          : member.is_moderator
                            ? 'Use moderator management for moderators'
                            : isSelf
                              ? 'You cannot kick yourself'
                              : 'Kick member'
                      }
                    >
                      {kickLoadingUserId === member.user_id ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        'Kick'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {memberTab === 'bans' && (
        <div className="space-y-4">
          <div className="card bg-surface p-4 border border-neutral space-y-3">
            <h4 className="font-semibold">Ban User</h4>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Member</span>
              </label>
              <select
                className="select select-bordered bg-surface border-neutral"
                value={banUserId}
                onChange={(e) => setBanUserId(e.target.value)}
                disabled={!canEditBans}
              >
                <option value="">Select a member</option>
                {bannableMembers.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.profiles?.display_name || member.user_id}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Reason (optional)</span>
              </label>
              <input
                type="text"
                className="input input-bordered bg-surface border-neutral"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                maxLength={200}
                placeholder="Rule violation"
                disabled={!canEditBans}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Expires At (optional)</span>
              </label>
              <input
                type="datetime-local"
                className="input input-bordered bg-surface border-neutral"
                value={banExpiresAt}
                onChange={(e) => setBanExpiresAt(e.target.value)}
                disabled={!canEditBans}
              />
            </div>
            <button
              className="btn btn-warning w-full sm:w-fit"
              onClick={handleBanUser}
              disabled={banLoading || !banUserId || !canEditBans}
            >
              {banLoading ? <span className="loading loading-spinner loading-xs"></span> : 'Ban User'}
            </button>
            {!canEditBans && (
              <p className="text-xs opacity-70">Only owner and managers can edit ban list.</p>
            )}
          </div>

          {bansList.length === 0 ? (
            <div className="alert">
              <span>No banned users.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {bansList.map((ban) => (
                <div key={ban.id} className="card bg-surface p-3 flex flex-row items-center gap-3">
                  <Avatar
                    src={getBanAvatar(ban) || undefined}
                    fallbackSeed={getBanDisplayName(ban)}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{getBanDisplayName(ban)}</p>
                    <p className="text-xs opacity-70">Reason: {ban.reason || 'N/A'}</p>
                    <p className="text-xs opacity-70">Expires: {formatDateTime(ban.expires_at)}</p>
                  </div>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleUnbanUser(ban.user_id)}
                    disabled={unbanLoadingUserId === ban.user_id || !canEditBans}
                  >
                    {unbanLoadingUserId === ban.user_id ? (
                      <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                      'Unban'
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
