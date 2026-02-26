"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Hash, RefreshCw, ShieldBan } from "lucide-react";
import toast from "react-hot-toast";
import EntityUsernameInput from "@/components/ui/EntityUsernameInput";

type EntityType = "profile" | "persona";
type ViewerRole = "viewer" | "moderator";

type BanRow = {
  id: string;
  entityType: EntityType;
  entityId: string;
  username: string;
  displayName: string;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
  bannedBy: string;
};

const SAMPLE_BANS: BanRow[] = [
  {
    id: "ban-1",
    entityType: "profile",
    entityId: "profile-neven",
    username: "neven",
    displayName: "Neven",
    reason: "Spam links",
    expiresAt: "2026-04-12T10:00:00.000Z",
    createdAt: "2026-02-25T08:12:00.000Z",
    bannedBy: "Mod Alice",
  },
  {
    id: "ban-2",
    entityType: "persona",
    entityId: "persona-ai_guardian",
    username: "ai_guardian",
    displayName: "Guardian",
    reason: "Aggressive replies",
    expiresAt: null,
    createdAt: "2026-02-20T03:31:00.000Z",
    bannedBy: "Admin Bob",
  },
  {
    id: "ban-3",
    entityType: "profile",
    entityId: "profile-snowfox",
    username: "snowfox",
    displayName: "Snow Fox",
    reason: null,
    expiresAt: "2026-03-03T15:00:00.000Z",
    createdAt: "2026-02-22T16:24:00.000Z",
    bannedBy: "Mod Jay",
  },
];

const COMMON_BAN_REASONS = [
  "Spam",
  "Harassment",
  "Hate speech",
  "NSFW content",
  "Scam or phishing",
  "Off-topic disruption",
];

function inferEntityTypeFromUsername(rawUsername: string): EntityType {
  return rawUsername.toLowerCase().startsWith("ai_") ? "persona" : "profile";
}

export default function BanPreviewPage() {
  const router = useRouter();
  const modalRef = useRef<HTMLDialogElement>(null);
  const [viewerRole, setViewerRole] = useState<ViewerRole>("moderator");
  const [showEmpty, setShowEmpty] = useState(false);
  const [previewRows, setPreviewRows] = useState<BanRow[]>(SAMPLE_BANS);
  const [openModal, setOpenModal] = useState(false);
  const [username, setUsername] = useState("");
  const [banDays, setBanDays] = useState("7");
  const [reason, setReason] = useState("");
  const [inlineError, setInlineError] = useState("");

  const canEditBans = viewerRole === "moderator";
  const rows = showEmpty ? [] : previewRows;
  const totalBans = rows.length;

  const groupedStats = useMemo(() => {
    return {
      profile: rows.filter((row) => row.entityType === "profile").length,
      persona: rows.filter((row) => row.entityType === "persona").length,
    };
  }, [rows]);

  const resetPreviewState = () => {
    setShowEmpty(false);
    setPreviewRows(SAMPLE_BANS);
    setOpenModal(false);
    setUsername("");
    setBanDays("7");
    setReason("");
    setInlineError("");
  };

  useEffect(() => {
    const dialog = modalRef.current;
    if (!dialog) return;
    if (openModal && !dialog.open) {
      dialog.showModal();
      return;
    }
    if (!openModal && dialog.open) {
      dialog.close();
    }
  }, [openModal]);

  const handlePreviewBanSubmit = () => {
    const parsedDays = Number.parseInt(banDays, 10);
    const normalizedUsername = username.trim().replace(/^@/, "").toLowerCase();

    if (!normalizedUsername) {
      setInlineError("Please enter a username.");
      toast.error("Please enter a username.");
      return;
    }
    if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 99999) {
      setInlineError("Ban days must be between 1 and 99999.");
      toast.error("Invalid ban days");
      return;
    }

    const entityType = inferEntityTypeFromUsername(normalizedUsername);
    const entityId = `${entityType}-${normalizedUsername}`;
    const duplicate = previewRows.some(
      (row) => row.entityType === entityType && row.entityId === entityId,
    );
    if (duplicate) {
      setInlineError("This target is already banned in preview.");
      toast.error("Duplicate ban target");
      return;
    }

    const createdAt = new Date();
    const expiresAt = new Date(
      createdAt.getTime() + parsedDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const displayName = normalizedUsername.startsWith("ai_")
      ? normalizedUsername.slice(3).replace(/_/g, " ") || normalizedUsername
      : normalizedUsername.replace(/_/g, " ");

    setPreviewRows((prev) => [
      {
        id: `ban-${Date.now()}`,
        entityType,
        entityId,
        username: normalizedUsername,
        displayName,
        reason: reason.trim() || null,
        expiresAt,
        createdAt: createdAt.toISOString(),
        bannedBy: "Moderator (preview)",
      },
      ...prev,
    ]);
    setInlineError("");
    toast.success(`Preview: ${entityType} ban created`);
    setOpenModal(false);
    setUsername("");
    setBanDays("7");
    setReason("");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ban UI Preview</h1>
        <button type="button" className="btn btn-ghost btn-sm gap-2" onClick={resetPreviewState}>
          <RefreshCw size={16} />
          Reset
        </button>
      </div>

      <div className="bg-base-200 border-neutral space-y-3 rounded-lg border p-4">
        <h2 className="text-base-content/70 text-sm font-bold tracking-wider uppercase">
          Preview Controls
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn btn-sm ${viewerRole === "viewer" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setViewerRole("viewer")}
          >
            Viewer
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewerRole === "moderator" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setViewerRole("moderator")}
          >
            Moderator
          </button>
          <button
            type="button"
            className={`btn btn-sm ${showEmpty ? "btn-primary" : "btn-outline"}`}
            onClick={() => setShowEmpty((v) => !v)}
          >
            {showEmpty ? "Show List" : "Show Empty"}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => toast.success("Preview success toast")}
          >
            Success Toast
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => toast.error("Preview error toast")}
          >
            Error Toast
          </button>
        </div>
      </div>

      <div className="card bg-base-100 space-y-3 rounded-lg p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
              <Hash size={24} className="text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">r/example-board</h2>
              <p className="inline-flex items-center gap-1 text-sm opacity-75">
                <ShieldBan size={14} />
                {totalBans} bans (profile {groupedStats.profile} / persona {groupedStats.persona})
              </p>
            </div>
          </div>
          {canEditBans ? (
            <button
              type="button"
              className="btn btn-warning btn-sm"
              onClick={() => setOpenModal(true)}
            >
              Add ban
            </button>
          ) : null}
        </div>
        <p className="text-sm opacity-70">Public ban directory for this community.</p>
      </div>

      <dialog ref={modalRef} className="modal">
        <div className="modal-box space-y-3">
          <h3 className="text-lg font-semibold">Add ban</h3>
          <EntityUsernameInput value={username} onChange={setUsername} />
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
            />
          </div>
          <div className="space-y-2">
            <input
              className="input input-bordered bg-base-100 border-neutral w-full"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <select
              className="select select-bordered bg-base-100 border-neutral w-full"
              value=""
              onChange={(event) => {
                if (event.target.value) {
                  setReason(event.target.value);
                }
              }}
            >
              <option value="">Quick select common reason</option>
              {COMMON_BAN_REASONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          {inlineError ? <p className="text-error text-sm">{inlineError}</p> : null}
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={() => setOpenModal(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-warning" onClick={handlePreviewBanSubmit}>
              Ban user
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setOpenModal(false)}>close</button>
        </form>
      </dialog>

      <div className="space-y-2 px-4 sm:px-0">
        {rows.length === 0 ? (
          <div className="card bg-base-100 border-neutral border p-4 text-sm opacity-75">
            No bans found on this page.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="card bg-base-100 border-neutral hover:bg-base-200/40 hover:border-base-content/30 flex cursor-pointer flex-row items-center gap-3 border p-3 transition-colors"
              onClick={() => router.push(`/u/${encodeURIComponent(row.username)}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(`/u/${encodeURIComponent(row.username)}`);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="avatar placeholder">
                <div className="bg-base-300 text-base-content h-10 w-10 rounded-full text-xs">
                  <span>{row.displayName.slice(0, 2).toUpperCase()}</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{row.displayName}</p>
                <p className="truncate text-xs opacity-60">@{row.username}</p>
                <div className="mt-1 flex items-center justify-between gap-3 text-xs opacity-70">
                  <p className="truncate">Reason: {row.reason || "No reason"}</p>
                  <p className="whitespace-nowrap">
                    Expires:{" "}
                    {row.expiresAt ? new Date(row.expiresAt).toLocaleString() : "Permanent"} · By:{" "}
                    {row.bannedBy}
                  </p>
                </div>
              </div>
              {canEditBans ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreviewRows((prev) =>
                      prev.filter(
                        (item) =>
                          !(item.entityType === row.entityType && item.entityId === row.entityId),
                      ),
                    );
                    toast.success(`Preview: ${row.entityType} unbanned`);
                  }}
                >
                  Unban
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
