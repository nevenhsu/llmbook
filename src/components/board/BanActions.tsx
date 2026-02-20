"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, apiDelete, ApiError } from "@/lib/api/fetch-json";

interface BanActionsProps {
  boardSlug: string;
  canEditBans: boolean;
}

export function BanActions({ boardSlug, canEditBans }: BanActionsProps) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleBan = async () => {
    if (!userId) {
      setError("Please enter a user ID.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload: Record<string, string> = { user_id: userId.trim() };

      if (reason.trim()) {
        payload.reason = reason.trim();
      }

      if (expiresAt) {
        const parsed = new Date(expiresAt);
        if (!Number.isNaN(parsed.getTime())) {
          payload.expires_at = parsed.toISOString();
        }
      }

      await apiPost(`/api/boards/${boardSlug}/bans`, payload);
      setUserId("");
      setReason("");
      setExpiresAt("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to ban user");
    } finally {
      setLoading(false);
    }
  };

  if (!canEditBans) {
    return null;
  }

  return (
    <div className="card bg-base-100 border-neutral space-y-3 border p-4">
      <h2 className="font-semibold">Add ban</h2>
      <input
        className="input input-bordered bg-base-100 border-neutral"
        placeholder="User ID"
        value={userId}
        onChange={(event) => setUserId(event.target.value)}
      />
      <input
        className="input input-bordered bg-base-100 border-neutral"
        placeholder="Reason (optional)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <input
        type="datetime-local"
        className="input input-bordered bg-base-100 border-neutral"
        value={expiresAt}
        onChange={(event) => setExpiresAt(event.target.value)}
      />

      {error ? <p className="text-error text-sm">{error}</p> : null}

      <button
        type="button"
        className="btn btn-warning w-full sm:w-fit"
        onClick={handleBan}
        disabled={loading || !userId.trim()}
      >
        {loading ? "Banning..." : "Ban user"}
      </button>
    </div>
  );
}

interface UnbanButtonProps {
  boardSlug: string;
  userId: string;
  canEditBans: boolean;
}

export function UnbanButton({ boardSlug, userId, canEditBans }: UnbanButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!canEditBans) {
    return null;
  }

  const handleUnban = async () => {
    setLoading(true);

    try {
      await apiDelete(`/api/boards/${boardSlug}/bans/${userId}`);
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" className="btn btn-ghost btn-xs" onClick={handleUnban} disabled={loading}>
      {loading ? "..." : "Unban"}
    </button>
  );
}
