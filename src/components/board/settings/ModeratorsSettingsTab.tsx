"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { DEFAULT_MODERATOR_PERMISSIONS, type ModeratorPermissions } from "@/types/board";
import { apiPatch, apiDelete, apiPost, ApiError } from "@/lib/api/fetch-json";
import type { Moderator, SearchProfile, BoardSettings } from "./types";

interface ModeratorsSettingsTabProps {
  board: BoardSettings;
  moderators: Moderator[];
}

export default function ModeratorsSettingsTab({ board, moderators }: ModeratorsSettingsTabProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [moderatorsList, setModeratorsList] = useState<Moderator[]>(moderators);

  // Add moderator modal state
  const [showAddModeratorModal, setShowAddModeratorModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<SearchProfile | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [removeLoadingUserId, setRemoveLoadingUserId] = useState<string | null>(null);
  const [expandedPermissionUserId, setExpandedPermissionUserId] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<
    Record<string, ModeratorPermissions>
  >({});
  const [savePermissionsUserId, setSavePermissionsUserId] = useState<string | null>(null);
  const [showRemoveModeratorModal, setShowRemoveModeratorModal] = useState(false);
  const [moderatorToRemove, setModeratorToRemove] = useState<string | null>(null);

  useEffect(() => {
    setModeratorsList(moderators);
  }, [moderators]);

  useEffect(() => {
    if (!showAddModeratorModal) return;

    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSelectedProfile(null);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?type=people&q=${encodeURIComponent(query)}`);
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const data = await res.json();
        const profiles = Array.isArray(data?.profiles) ? data.profiles : [];
        const nextResults: SearchProfile[] = profiles.filter(
          (profile: SearchProfile) =>
            !moderatorsList.some((mod) => mod.user_id === profile.user_id),
        );

        if (!cancelled) {
          setSearchResults(nextResults);
          setSelectedProfile((prev) => {
            if (!prev) return prev;
            return nextResults.some((p) => p.user_id === prev.user_id) ? prev : null;
          });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to search users");
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showAddModeratorModal, searchQuery, moderatorsList]);

  const getPermissionsFromModerator = (mod: Moderator): ModeratorPermissions => ({
    manage_posts: mod.permissions?.manage_posts ?? DEFAULT_MODERATOR_PERMISSIONS.manage_posts,
    manage_users: mod.permissions?.manage_users ?? DEFAULT_MODERATOR_PERMISSIONS.manage_users,
    manage_settings:
      mod.permissions?.manage_settings ?? DEFAULT_MODERATOR_PERMISSIONS.manage_settings,
  });

  const openPermissionsEditor = (mod: Moderator) => {
    setError("");
    setExpandedPermissionUserId(mod.user_id);
    setEditingPermissions((prev) => ({
      ...prev,
      [mod.user_id]: getPermissionsFromModerator(mod),
    }));
  };

  const updateEditingPermission = (
    userId: string,
    key: keyof ModeratorPermissions,
    value: boolean,
  ) => {
    setEditingPermissions((prev) => {
      const current = prev[userId] || DEFAULT_MODERATOR_PERMISSIONS;
      return { ...prev, [userId]: { ...current, [key]: value } };
    });
  };

  const handleSavePermissions = async (mod: Moderator) => {
    const nextPermissions = editingPermissions[mod.user_id] || getPermissionsFromModerator(mod);
    setSavePermissionsUserId(mod.user_id);
    setError("");

    try {
      const updatedModerator = await apiPatch<Moderator>(
        `/api/boards/${board.slug}/moderators/${mod.user_id}`,
        { permissions: nextPermissions },
      );
      setModeratorsList((prev) =>
        prev.map((item) => (item.user_id === updatedModerator.user_id ? updatedModerator : item)),
      );
      setExpandedPermissionUserId(null);
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Failed to update moderator permissions.");
    } finally {
      setSavePermissionsUserId(null);
    }
  };

  const resetAddModeratorState = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedProfile(null);
    setSearchLoading(false);
  };

  const openAddModeratorModal = () => {
    setError("");
    resetAddModeratorState();
    setShowAddModeratorModal(true);
  };

  const closeAddModeratorModal = () => {
    if (actionLoading) return;
    setShowAddModeratorModal(false);
    resetAddModeratorState();
  };

  const handleAddModerator = async () => {
    if (!selectedProfile) return;
    setActionLoading(true);
    setError("");

    try {
      const newModerator = await apiPost<Moderator>(`/api/boards/${board.slug}/moderators`, {
        user_id: selectedProfile.user_id,
      });
      setModeratorsList((prev) => {
        if (prev.some((mod) => mod.user_id === newModerator.user_id)) return prev;
        return [...prev, newModerator];
      });
      setShowAddModeratorModal(false);
      resetAddModeratorState();
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Failed to add moderator.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveModerator = (userId: string) => {
    setModeratorToRemove(userId);
    setShowRemoveModeratorModal(true);
  };

  const confirmRemoveModerator = async () => {
    if (!moderatorToRemove) return;
    setRemoveLoadingUserId(moderatorToRemove);
    setError("");

    try {
      await apiDelete(`/api/boards/${board.slug}/moderators/${moderatorToRemove}`);
      setModeratorsList((prev) => prev.filter((mod) => mod.user_id !== moderatorToRemove));
      setShowRemoveModeratorModal(false);
      setModeratorToRemove(null);
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Failed to remove moderator.");
    } finally {
      setRemoveLoadingUserId(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {moderatorsList.map((mod) => (
          <div
            key={mod.id}
            className="card bg-base-100 hover:bg-base-200 flex cursor-pointer flex-row items-center gap-3 p-3 transition-colors"
            onClick={() => router.push(`/u/${mod.profiles.username}`)}
          >
            <Avatar
              src={mod.profiles.avatar_url}
              fallbackSeed={mod.profiles.display_name}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{mod.profiles.display_name}</p>
              <p className="text-base-content/60 truncate text-sm">@{mod.profiles.username}</p>
            </div>
            {mod.role !== "owner" && (
              <div className="flex gap-1">
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPermissionsEditor(mod);
                  }}
                  disabled={
                    removeLoadingUserId === mod.user_id || savePermissionsUserId === mod.user_id
                  }
                >
                  Permissions
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveModerator(mod.user_id);
                  }}
                  disabled={
                    removeLoadingUserId === mod.user_id || savePermissionsUserId === mod.user_id
                  }
                >
                  {removeLoadingUserId === mod.user_id ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    "Remove"
                  )}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {expandedPermissionUserId &&
        (() => {
          const target = moderatorsList.find((mod) => mod.user_id === expandedPermissionUserId);
          if (!target) return <p className="text-sm opacity-70">Moderator not found.</p>;

          const current = editingPermissions[target.user_id] || getPermissionsFromModerator(target);
          const isSaving = savePermissionsUserId === target.user_id;

          return (
            <div className="card bg-base-100 border-neutral border p-4">
              <h4 className="mb-3 font-semibold">Permissions: {target.profiles.display_name}</h4>
              <div className="space-y-3">
                {(
                  [
                    { key: "manage_posts", label: "Manage posts" },
                    { key: "manage_users", label: "Manage users" },
                    { key: "manage_settings", label: "Manage settings" },
                  ] as { key: keyof ModeratorPermissions; label: string }[]
                ).map(({ key, label }) => (
                  <label key={key} className="label cursor-pointer justify-start gap-3">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={current[key]}
                      onChange={(e) =>
                        updateEditingPermission(target.user_id, key, e.target.checked)
                      }
                      disabled={isSaving}
                    />
                    <span className="label-text">{label}</span>
                  </label>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setExpandedPermissionUserId(null)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleSavePermissions(target)}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    "Save Permissions"
                  )}
                </button>
              </div>
            </div>
          );
        })()}

      <button className="btn btn-outline w-full" onClick={openAddModeratorModal}>
        <UserPlus size={16} />
        Add Moderator
      </button>

      {/* Add Moderator Modal */}
      {showAddModeratorModal && (
        <dialog className="modal modal-open modal-middle">
          <div className="modal-box">
            <h3 className="text-lg font-bold">Add Moderator</h3>
            <p className="py-2 text-sm opacity-80">
              Search users by username and add them as moderators.
            </p>

            <div className="form-control mt-2">
              <label className="label">
                <span className="label-text">Username</span>
              </label>
              <input
                type="text"
                className="input input-bordered bg-base-100 border-neutral w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter username"
                autoFocus
              />
              {searchQuery.trim().length < 2 && (
                <label className="label">
                  <span className="label-text-alt text-xs">
                    Enter at least 2 characters to search.
                  </span>
                </label>
              )}
            </div>

            {searchQuery.trim().length >= 2 && (
              <div className="border-neutral mt-3 max-h-64 overflow-y-auto rounded-lg border">
                {searchLoading ? (
                  <div className="flex items-center gap-2 p-4 text-sm">
                    <span className="loading loading-spinner loading-sm"></span>
                    Searching users...
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="p-4 text-sm opacity-70">No eligible users found.</p>
                ) : (
                  <div className="divide-neutral divide-y">
                    {searchResults.map((profile) => (
                      <button
                        key={profile.user_id}
                        className={`hover:bg-base-200 flex w-full items-center gap-3 p-3 text-left transition-colors ${
                          selectedProfile?.user_id === profile.user_id ? "bg-base-200" : ""
                        }`}
                        onClick={() => setSelectedProfile(profile)}
                      >
                        <Avatar
                          src={profile.avatar_url}
                          fallbackSeed={profile.display_name}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{profile.display_name}</p>
                          <p className="text-base-content/60 truncate text-sm">
                            @{profile.username}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedProfile && (
              <div className="bg-base-200 mt-3 rounded-lg p-3 text-sm">
                Selected: <span className="font-medium">{selectedProfile.display_name}</span>{" "}
                <span className="text-base-content/60">@{selectedProfile.username}</span>
              </div>
            )}

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={closeAddModeratorModal}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddModerator}
                disabled={!selectedProfile || actionLoading}
              >
                {actionLoading ? (
                  <span className="loading loading-spinner"></span>
                ) : (
                  "Add Moderator"
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={closeAddModeratorModal}>close</button>
          </form>
        </dialog>
      )}

      <ConfirmModal
        isOpen={showRemoveModeratorModal}
        onClose={() => {
          setShowRemoveModeratorModal(false);
          setModeratorToRemove(null);
        }}
        onConfirm={confirmRemoveModerator}
        title="Remove Moderator"
        message="Are you sure you want to remove this moderator?"
        confirmText="Remove"
        isLoading={removeLoadingUserId !== null}
        variant="danger"
      />
    </div>
  );
}
