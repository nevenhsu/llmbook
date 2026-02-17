"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, UserPlus, Archive } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import ImageUpload from "@/components/ui/ImageUpload";
import ConfirmModal from "@/components/ui/ConfirmModal";
import toast from "react-hot-toast";
import {
  DEFAULT_MODERATOR_PERMISSIONS,
  type ModeratorPermissions,
} from "@/types/board";

interface Rule {
  title: string;
  description: string;
}

interface Moderator {
  id: string;
  user_id: string;
  role: string;
  permissions?: Partial<ModeratorPermissions>;
  // profiles shape can vary between backend responses; use any to avoid type conflicts
  profiles: any;
}

interface SearchProfile {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface BoardSettingsFormProps {
  board: any;
  moderators: Moderator[];
  userRole: "owner" | "moderator";
  isAdmin: boolean;
}

export default function BoardSettingsForm({
  board,
  moderators,
  userRole,
  isAdmin,
}: BoardSettingsFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"general" | "rules" | "moderators" | "danger">(
    "general",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showArchiveModal, setShowArchiveModal] = useState(false);
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

  // General settings state
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description || "");
  const [bannerUrl, setBannerUrl] = useState(board.banner_url || "");

  // Rules state
  const [rules, setRules] = useState<Rule[]>(board.rules || []);

  useEffect(() => {
    setModeratorsList(moderators);
  }, [moderators]);

  useEffect(() => {
    if (!showAddModeratorModal) {
      return;
    }

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
        const nextResults: SearchProfile[] = profiles.filter((profile: SearchProfile) => {
          return !moderatorsList.some((mod) => mod.user_id === profile.user_id);
        });

        if (!cancelled) {
          setSearchResults(nextResults);
          setSelectedProfile((prev) => {
            if (!prev) {
              return prev;
            }
            return nextResults.some((profile) => profile.user_id === prev.user_id) ? prev : null;
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to search users");
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showAddModeratorModal, searchQuery, moderatorsList]);

  const handleUpdateGeneral = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/boards/${board.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          banner_url: bannerUrl || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      router.refresh();
      toast.success("Settings updated successfully");
    } catch (err: any) {
      console.error(err);
      setError("Failed to update board general settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRules = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/boards/${board.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: rules.filter((r) => r.title.trim()),
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      router.refresh();
      toast.success("Rules updated successfully");
    } catch (err: any) {
      console.error(err);
      setError("Failed to update rules.");
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/boards/${board.slug}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      router.push("/r/archive");
    } catch (err: any) {
      console.error(err);
      setError("Failed to archive board.");
      setLoading(false);
    }
  };

  const resetAddModeratorState = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedProfile(null);
    setSearchLoading(false);
  };

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

  const closePermissionsEditor = () => {
    setExpandedPermissionUserId(null);
  };

  const updateEditingPermission = (
    userId: string,
    key: keyof ModeratorPermissions,
    value: boolean,
  ) => {
    setEditingPermissions((prev) => {
      const current = prev[userId] || DEFAULT_MODERATOR_PERMISSIONS;
      return {
        ...prev,
        [userId]: {
          ...current,
          [key]: value,
        },
      };
    });
  };

  const handleSavePermissions = async (mod: Moderator) => {
    const nextPermissions = editingPermissions[mod.user_id] || getPermissionsFromModerator(mod);

    setSavePermissionsUserId(mod.user_id);
    setError("");

    try {
      const res = await fetch(`/api/boards/${board.slug}/moderators/${mod.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: nextPermissions }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const updatedModerator: Moderator = await res.json();
      setModeratorsList((prev) =>
        prev.map((item) => {
          if (item.user_id === updatedModerator.user_id) {
            return updatedModerator;
          }
          return item;
        }),
      );
      setExpandedPermissionUserId(null);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError("Failed to update moderator permissions.");
    } finally {
      setSavePermissionsUserId(null);
    }
  };

  const openAddModeratorModal = () => {
    setError("");
    resetAddModeratorState();
    setShowAddModeratorModal(true);
  };

  const closeAddModeratorModal = () => {
    if (actionLoading) {
      return;
    }
    setShowAddModeratorModal(false);
    resetAddModeratorState();
  };

  const handleAddModerator = async () => {
    if (!selectedProfile) {
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/boards/${board.slug}/moderators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedProfile.user_id }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const newModerator: Moderator = await res.json();
      setModeratorsList((prev) => {
        if (prev.some((mod) => mod.user_id === newModerator.user_id)) {
          return prev;
        }
        return [...prev, newModerator];
      });
      setShowAddModeratorModal(false);
      resetAddModeratorState();
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError("Failed to add moderator.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveModerator = async (userId: string) => {
    setModeratorToRemove(userId);
    setShowRemoveModeratorModal(true);
  };

  const confirmRemoveModerator = async () => {
    if (!moderatorToRemove) return;

    setRemoveLoadingUserId(moderatorToRemove);
    setError("");

    try {
      const res = await fetch(`/api/boards/${board.slug}/moderators/${moderatorToRemove}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setModeratorsList((prev) => prev.filter((mod) => mod.user_id !== moderatorToRemove));
      setShowRemoveModeratorModal(false);
      setModeratorToRemove(null);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError("Failed to remove moderator.");
    } finally {
      setRemoveLoadingUserId(null);
    }
  };

  const addRule = () => {
    if (rules.length < 15) {
      setRules([...rules, { title: "", description: "" }]);
    }
  };

  const updateRule = (index: number, field: "title" | "description", value: string) => {
    const newRules = [...rules];
    newRules[index][field] = value;
    setRules(newRules);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  return (
    <div>
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div role="tablist" className="tabs tabs-bordered scrollbar-hide mb-6 overflow-x-auto">
        <button
          role="tab"
          className={`tab whitespace-nowrap ${activeTab === "general" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("general")}
        >
          General
        </button>
        <button
          role="tab"
          className={`tab whitespace-nowrap ${activeTab === "rules" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("rules")}
        >
          Rules
        </button>
        {userRole === "owner" && (
          <button
            role="tab"
            className={`tab whitespace-nowrap ${activeTab === "moderators" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("moderators")}
          >
            Moderators
          </button>
        )}
        {isAdmin && (
          <button
            role="tab"
            className={`tab whitespace-nowrap ${activeTab === "danger" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("danger")}
          >
            Danger Zone
          </button>
        )}
      </div>

      {/* General Tab */}
      {activeTab === "general" && (
        <div className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Board Name</span>
            </label>
            <input
              type="text"
              className="input input-bordered bg-base-100 border-neutral w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={3}
              maxLength={21}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Description</span>
            </label>
            <textarea
              className="textarea textarea-bordered bg-base-100 border-neutral w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <div>
            <ImageUpload
              label="Banner"
              value={bannerUrl}
              onChange={setBannerUrl}
              onError={(err) => setError(err)}
              aspectRatio="banner"
              placeholder="上傳 Banner 圖片"
            />
          </div>

          <button className="btn btn-primary" onClick={handleUpdateGeneral} disabled={loading}>
            {loading ? <span className="loading loading-spinner"></span> : "Save Changes"}
          </button>
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          {rules.map((rule, index) => (
            <div key={index} className="card bg-base-100 border-neutral border p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">Rule {index + 1}</span>
                <button className="btn btn-ghost btn-xs" onClick={() => removeRule(index)}>
                  <X size={14} />
                </button>
              </div>
              <input
                type="text"
                className="input input-bordered input-sm bg-base-100 border-neutral mb-2 w-full"
                value={rule.title}
                onChange={(e) => updateRule(index, "title", e.target.value)}
                placeholder="Rule title"
                maxLength={100}
              />
              <textarea
                className="textarea textarea-bordered textarea-sm bg-base-100 border-neutral w-full"
                value={rule.description}
                onChange={(e) => updateRule(index, "description", e.target.value)}
                placeholder="Rule description"
                maxLength={500}
                rows={2}
              />
            </div>
          ))}
          <button
            className="btn btn-outline btn-sm w-full"
            onClick={addRule}
            disabled={rules.length >= 15}
          >
            + Add Rule
          </button>
          <button className="btn btn-primary" onClick={handleUpdateRules} disabled={loading}>
            {loading ? <span className="loading loading-spinner"></span> : "Save Rules"}
          </button>
        </div>
      )}

      {/* Moderators Tab */}
      {activeTab === "moderators" && userRole === "owner" && (
        <div className="space-y-4">
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
                {mod.role !== "owner" && (userRole === "owner" || isAdmin) && (
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
                )}
              </div>
            ))}
          </div>

          {expandedPermissionUserId && (
            <div className="card bg-base-100 border-neutral border p-4">
              {(() => {
                const target = moderatorsList.find(
                  (mod) => mod.user_id === expandedPermissionUserId,
                );
                if (!target) {
                  return <p className="text-sm opacity-70">Moderator not found.</p>;
                }

                const current =
                  editingPermissions[target.user_id] || getPermissionsFromModerator(target);
                const isSaving = savePermissionsUserId === target.user_id;

                return (
                  <>
                    <h4 className="mb-3 font-semibold">
                      Permissions: {target.profiles.display_name}
                    </h4>
                    <div className="space-y-3">
                      <label className="label cursor-pointer justify-start gap-3">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={current.manage_posts}
                          onChange={(e) =>
                            updateEditingPermission(
                              target.user_id,
                              "manage_posts",
                              e.target.checked,
                            )
                          }
                          disabled={isSaving}
                        />
                        <span className="label-text">Manage posts</span>
                      </label>
                      <label className="label cursor-pointer justify-start gap-3">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={current.manage_users}
                          onChange={(e) =>
                            updateEditingPermission(
                              target.user_id,
                              "manage_users",
                              e.target.checked,
                            )
                          }
                          disabled={isSaving}
                        />
                        <span className="label-text">Manage users</span>
                      </label>
                      <label className="label cursor-pointer justify-start gap-3">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={current.manage_settings}
                          onChange={(e) =>
                            updateEditingPermission(
                              target.user_id,
                              "manage_settings",
                              e.target.checked,
                            )
                          }
                          disabled={isSaving}
                        />
                        <span className="label-text">Manage settings</span>
                      </label>
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={closePermissionsEditor}
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
                  </>
                );
              })()}
            </div>
          )}

          <button className="btn btn-outline w-full" onClick={openAddModeratorModal}>
            <UserPlus size={16} />
            Add Moderator
          </button>
        </div>
      )}

      {/* Danger Zone Tab */}
      {activeTab === "danger" && isAdmin && (
        <div className="space-y-4">
          <div className="alert alert-error">
            <span>Archiving is permanent and will make this board read-only.</span>
          </div>
          <button className="btn btn-error w-full" onClick={() => setShowArchiveModal(true)}>
            <Archive size={16} />
            Archive Board
          </button>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveModal && (
        <dialog className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box">
            <h3 className="text-lg font-bold">Archive r/{board.slug}?</h3>
            <p className="py-4">
              This action cannot be undone. The board will become read-only and will be moved to the
              archive.
            </p>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setShowArchiveModal(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button className="btn btn-error" onClick={handleArchive} disabled={loading}>
                {loading ? <span className="loading loading-spinner"></span> : "Archive"}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowArchiveModal(false)}>close</button>
          </form>
        </dialog>
      )}

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
