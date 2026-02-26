"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { apiPost, apiDelete, ApiError } from "@/lib/api/fetch-json";
import EntityUsernameInput from "@/components/ui/EntityUsernameInput";

interface BanActionsProps {
  boardSlug: string;
  canEditBans: boolean;
}

const COMMON_BAN_REASONS = [
  "Spam",
  "Harassment",
  "Hate speech",
  "NSFW content",
  "Scam or phishing",
  "Off-topic disruption",
];

export function BanActions({ boardSlug, canEditBans }: BanActionsProps) {
  const router = useRouter();
  const modalRef = useRef<HTMLDialogElement>(null);
  const [username, setUsername] = useState("");
  const [banDays, setBanDays] = useState("7");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleBan = async () => {
    if (!username.trim()) {
      setError("Please enter a username.");
      return;
    }

    const parsedDays = Number.parseInt(banDays, 10);
    if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 99999) {
      setError("Ban days must be an integer between 1 and 99999.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload: { username: string; ban_days: number; reason?: string } = {
        username: username.trim().replace(/^@/, ""),
        ban_days: parsedDays,
      };

      if (reason.trim()) {
        payload.reason = reason.trim();
      }

      await apiPost(`/api/boards/${boardSlug}/bans`, payload);
      setUsername("");
      setBanDays("7");
      setReason("");
      modalRef.current?.close();
      toast.success("Ban created");
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to ban user";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!canEditBans) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-warning btn-sm"
        onClick={() => modalRef.current?.showModal()}
      >
        Add ban
      </button>

      <dialog ref={modalRef} className="modal">
        <div className="modal-box space-y-3">
          <h3 className="text-lg font-semibold">Add ban</h3>
          <EntityUsernameInput value={username} onChange={setUsername} disabled={loading} />
          <div className="relative">
            <span className="text-base-content/60 pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-sm">
              Ban days
            </span>
            <input
              type="number"
              min={1}
              max={99999}
              className="input input-bordered bg-base-100 border-neutral w-full pl-20"
              placeholder="1-99999"
              value={banDays}
              onChange={(event) => setBanDays(event.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <input
              className="input input-bordered bg-base-100 border-neutral w-full"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={loading}
            />
            <select
              className="select select-bordered bg-base-100 border-neutral w-full"
              value=""
              onChange={(event) => {
                if (event.target.value) {
                  setReason(event.target.value);
                }
              }}
              disabled={loading}
            >
              <option value="">Quick select common reason</option>
              {COMMON_BAN_REASONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {error ? <p className="text-error text-sm">{error}</p> : null}

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => modalRef.current?.close()}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-warning"
              onClick={handleBan}
              disabled={loading || !username.trim()}
            >
              {loading ? "Banning..." : "Ban user"}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}

interface UnbanButtonProps {
  boardSlug: string;
  entityType: "profile" | "persona";
  entityId: string;
  canEditBans: boolean;
}

export function UnbanButton({ boardSlug, entityType, entityId, canEditBans }: UnbanButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!canEditBans) {
    return null;
  }

  const handleUnban = async () => {
    setLoading(true);

    try {
      await apiDelete(`/api/boards/${boardSlug}/bans/${entityType}/${entityId}`);
      toast.success("Unbanned");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Failed to unban");
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
