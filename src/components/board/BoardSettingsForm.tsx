'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X, UserPlus, Archive } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import ImageUpload from '@/components/ui/ImageUpload';

interface Rule {
  title: string;
  description: string;
}

interface Moderator {
  id: string;
  user_id: string;
  role: string;
  permissions?: {
    manage_posts?: boolean;
    manage_users?: boolean;
    manage_settings?: boolean;
  };
  // profiles shape can vary between backend responses; use any to avoid type conflicts
  profiles: any;
}

type ModeratorPermissions = {
  manage_posts: boolean;
  manage_users: boolean;
  manage_settings: boolean;
};

const DEFAULT_MODERATOR_PERMISSIONS: ModeratorPermissions = {
  manage_posts: true,
  manage_users: true,
  manage_settings: false
};

interface SearchProfile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

interface BoardSettingsFormProps {
  board: any;
  moderators: Moderator[];
  userRole: 'owner' | 'moderator';
}

export default function BoardSettingsForm({
  board,
  moderators,
  userRole
}: BoardSettingsFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'general' | 'rules' | 'moderators' | 'danger'>('general');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [moderatorsList, setModeratorsList] = useState<Moderator[]>(moderators);

  // Add moderator modal state
  const [showAddModeratorModal, setShowAddModeratorModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<SearchProfile | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [removeLoadingUserId, setRemoveLoadingUserId] = useState<string | null>(null);
  const [expandedPermissionUserId, setExpandedPermissionUserId] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<Record<string, ModeratorPermissions>>({});
  const [savePermissionsUserId, setSavePermissionsUserId] = useState<string | null>(null);

  // General settings state
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description || '');
  const [bannerUrl, setBannerUrl] = useState(board.banner_url || '');
  const [iconUrl, setIconUrl] = useState(board.icon_url || '');

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
          setError(err.message || 'Failed to search users');
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
    setError('');

    try {
      const res = await fetch(`/api/boards/${board.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          banner_url: bannerUrl || undefined,
          icon_url: iconUrl || undefined
        })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      router.refresh();
      alert('Settings updated successfully');
    } catch (err: any) {
      console.error(err);
      setError('Failed to update board general settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRules = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/boards/${board.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules: rules.filter(r => r.title.trim())
        })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      router.refresh();
      alert('Rules updated successfully');
    } catch (err: any) {
      console.error(err);
      setError('Failed to update rules.');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/boards/${board.slug}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      router.push('/r/archive');
    } catch (err: any) {
      console.error(err);
      setError('Failed to archive board.');
      setLoading(false);
    }
  };

  const resetAddModeratorState = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedProfile(null);
    setSearchLoading(false);
  };

  const getPermissionsFromModerator = (mod: Moderator): ModeratorPermissions => ({
    manage_posts: mod.permissions?.manage_posts ?? DEFAULT_MODERATOR_PERMISSIONS.manage_posts,
    manage_users: mod.permissions?.manage_users ?? DEFAULT_MODERATOR_PERMISSIONS.manage_users,
    manage_settings: mod.permissions?.manage_settings ?? DEFAULT_MODERATOR_PERMISSIONS.manage_settings
  });

  const openPermissionsEditor = (mod: Moderator) => {
    setError('');
    setExpandedPermissionUserId(mod.user_id);
    setEditingPermissions((prev) => ({
      ...prev,
      [mod.user_id]: getPermissionsFromModerator(mod)
    }));
  };

  const closePermissionsEditor = () => {
    setExpandedPermissionUserId(null);
  };

  const updateEditingPermission = (
    userId: string,
    key: keyof ModeratorPermissions,
    value: boolean
  ) => {
    setEditingPermissions((prev) => {
      const current = prev[userId] || DEFAULT_MODERATOR_PERMISSIONS;
      return {
        ...prev,
        [userId]: {
          ...current,
          [key]: value
        }
      };
    });
  };

  const handleSavePermissions = async (mod: Moderator) => {
    const nextPermissions = editingPermissions[mod.user_id] || getPermissionsFromModerator(mod);

    setSavePermissionsUserId(mod.user_id);
    setError('');

    try {
      const res = await fetch(`/api/boards/${board.slug}/moderators/${mod.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: nextPermissions })
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const updatedModerator: Moderator = await res.json();
      setModeratorsList((prev) => prev.map((item) => {
        if (item.user_id === updatedModerator.user_id) {
          return updatedModerator;
        }
        return item;
      }));
      setExpandedPermissionUserId(null);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError('Failed to update moderator permissions.');
    } finally {
      setSavePermissionsUserId(null);
    }
  };

  const openAddModeratorModal = () => {
    setError('');
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
    setError('');

    try {
      const res = await fetch(`/api/boards/${board.slug}/moderators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedProfile.user_id })
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
      setError('Failed to add moderator.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveModerator = async (userId: string) => {
    const confirmed = window.confirm('Remove this moderator?');
    if (!confirmed) {
      return;
    }

    setRemoveLoadingUserId(userId);
    setError('');

    try {
      const res = await fetch(`/api/boards/${board.slug}/moderators/${userId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      setModeratorsList((prev) => prev.filter((mod) => mod.user_id !== userId));
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError('Failed to remove moderator.');
    } finally {
      setRemoveLoadingUserId(null);
    }
  };

  const addRule = () => {
    if (rules.length < 15) {
      setRules([...rules, { title: '', description: '' }]);
    }
  };

  const updateRule = (index: number, field: 'title' | 'description', value: string) => {
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
      <div role="tablist" className="tabs tabs-bordered overflow-x-auto scrollbar-hide mb-6">
        <button
          role="tab"
          className={`tab whitespace-nowrap ${activeTab === 'general' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          role="tab"
          className={`tab whitespace-nowrap ${activeTab === 'rules' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          Rules
        </button>
        {userRole === 'owner' && (
          <>
            <button
              role="tab"
              className={`tab whitespace-nowrap ${activeTab === 'moderators' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('moderators')}
            >
              Moderators
            </button>
            <button
              role="tab"
              className={`tab whitespace-nowrap ${activeTab === 'danger' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('danger')}
            >
              Danger Zone
            </button>
          </>
        )}
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Board Name</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full bg-base-100 border-neutral"
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
              className="textarea textarea-bordered w-full bg-base-100 border-neutral"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <ImageUpload
                label="Banner"
                value={bannerUrl}
                onChange={setBannerUrl}
                onError={(err) => setError(err)}
                aspectRatio="banner"
                placeholder="上傳 Banner 圖片"
              />
            </div>
            <div className="flex-1">
              <ImageUpload
                label="Icon"
                value={iconUrl}
                onChange={setIconUrl}
                onError={(err) => setError(err)}
                aspectRatio="square"
                placeholder="上傳 Icon 圖片"
              />
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleUpdateGeneral}
            disabled={loading}
          >
            {loading ? <span className="loading loading-spinner"></span> : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {rules.map((rule, index) => (
            <div key={index} className="card bg-base-100 p-4 border border-neutral">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Rule {index + 1}</span>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => removeRule(index)}
                >
                  <X size={14} />
                </button>
              </div>
              <input
                type="text"
                className="input input-bordered input-sm w-full bg-base-100 border-neutral mb-2"
                value={rule.title}
                onChange={(e) => updateRule(index, 'title', e.target.value)}
                placeholder="Rule title"
                maxLength={100}
              />
              <textarea
                className="textarea textarea-bordered textarea-sm w-full bg-base-100 border-neutral"
                value={rule.description}
                onChange={(e) => updateRule(index, 'description', e.target.value)}
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
          <button
            className="btn btn-primary"
            onClick={handleUpdateRules}
            disabled={loading}
          >
            {loading ? <span className="loading loading-spinner"></span> : 'Save Rules'}
          </button>
          <div className="pt-2">
            <Link href={`/r/${board.slug}/member`} className="btn btn-outline btn-sm">
              Open Members & Bans Page
            </Link>
          </div>
        </div>
      )}

      {/* Moderators Tab */}
      {activeTab === 'moderators' && userRole === 'owner' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {moderatorsList.map((mod) => (
              <div key={mod.id} className="card bg-base-100 p-3 flex flex-row items-center gap-3">
                <Avatar
                  src={mod.profiles.avatar_url}
                  fallbackSeed={mod.profiles.display_name}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{mod.profiles.display_name}</p>
                  <span className="badge badge-ghost badge-xs">{mod.role}</span>
                </div>
                {mod.role !== 'owner' && (
                  <div className="flex items-center gap-1">
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => {
                        if (expandedPermissionUserId === mod.user_id) {
                          closePermissionsEditor();
                        } else {
                          openPermissionsEditor(mod);
                        }
                      }}
                    >
                      Permissions
                    </button>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => handleRemoveModerator(mod.user_id)}
                      disabled={removeLoadingUserId === mod.user_id || savePermissionsUserId === mod.user_id}
                    >
                      {removeLoadingUserId === mod.user_id ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        'Remove'
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {expandedPermissionUserId && (
            <div className="card bg-base-100 p-4 border border-neutral">
              {(() => {
                const target = moderatorsList.find((mod) => mod.user_id === expandedPermissionUserId);
                if (!target) {
                  return <p className="text-sm opacity-70">Moderator not found.</p>;
                }

                const current = editingPermissions[target.user_id] || getPermissionsFromModerator(target);
                const isSaving = savePermissionsUserId === target.user_id;

                return (
                  <>
                    <h4 className="font-semibold mb-3">
                      Permissions: {target.profiles.display_name}
                    </h4>
                    <div className="space-y-3">
                      <label className="label cursor-pointer justify-start gap-3">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={current.manage_posts}
                          onChange={(e) => updateEditingPermission(target.user_id, 'manage_posts', e.target.checked)}
                          disabled={isSaving}
                        />
                        <span className="label-text">Manage posts</span>
                      </label>
                      <label className="label cursor-pointer justify-start gap-3">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={current.manage_users}
                          onChange={(e) => updateEditingPermission(target.user_id, 'manage_users', e.target.checked)}
                          disabled={isSaving}
                        />
                        <span className="label-text">Manage users</span>
                      </label>
                      <label className="label cursor-pointer justify-start gap-3">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={current.manage_settings}
                          onChange={(e) => updateEditingPermission(target.user_id, 'manage_settings', e.target.checked)}
                          disabled={isSaving}
                        />
                        <span className="label-text">Manage settings</span>
                      </label>
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={closePermissionsEditor} disabled={isSaving}>
                        Cancel
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={() => handleSavePermissions(target)} disabled={isSaving}>
                        {isSaving ? <span className="loading loading-spinner loading-xs"></span> : 'Save Permissions'}
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
      {activeTab === 'danger' && userRole === 'owner' && (
        <div className="space-y-4">
          <div className="alert alert-error">
            <span>Archiving is permanent and will make this board read-only.</span>
          </div>
          <button
            className="btn btn-error w-full"
            onClick={() => setShowArchiveModal(true)}
          >
            <Archive size={16} />
            Archive Board
          </button>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveModal && (
        <dialog className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Archive r/{board.slug}?</h3>
            <p className="py-4">
              This action cannot be undone. The board will become read-only and will be moved to the archive.
            </p>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setShowArchiveModal(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={handleArchive}
                disabled={loading}
              >
                {loading ? <span className="loading loading-spinner"></span> : 'Archive'}
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
        <dialog className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Add Moderator</h3>
            <p className="py-2 text-sm opacity-80">Search users by display name and add them as moderators.</p>

            <div className="form-control mt-2">
              <label className="label">
                <span className="label-text">Search User</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full bg-base-100 border-neutral"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type at least 2 characters"
                autoFocus
              />
            </div>

            <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-neutral">
              {searchLoading ? (
                <div className="p-4 text-sm flex items-center gap-2">
                  <span className="loading loading-spinner loading-sm"></span>
                  Searching users...
                </div>
              ) : searchQuery.trim().length < 2 ? (
                <p className="p-4 text-sm opacity-70">Enter at least 2 characters to search.</p>
              ) : searchResults.length === 0 ? (
                <p className="p-4 text-sm opacity-70">No eligible users found.</p>
              ) : (
                <div className="divide-y divide-neutral">
                  {searchResults.map((profile) => (
                    <button
                      key={profile.user_id}
                      className={`w-full text-left p-3 flex items-center gap-3 hover:bg-base-200 transition-colors ${
                        selectedProfile?.user_id === profile.user_id ? 'bg-base-200' : ''
                      }`}
                      onClick={() => setSelectedProfile(profile)}
                    >
                      <Avatar
                        src={profile.avatar_url}
                        fallbackSeed={profile.display_name}
                        size="sm"
                      />
                      <span className="truncate">{profile.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedProfile && (
              <div className="mt-3 p-3 rounded-lg bg-base-200 text-sm">
                Selected: <span className="font-medium">{selectedProfile.display_name}</span>
              </div>
            )}

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={closeAddModeratorModal} disabled={actionLoading}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddModerator}
                disabled={!selectedProfile || actionLoading}
              >
                {actionLoading ? <span className="loading loading-spinner"></span> : 'Add Moderator'}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={closeAddModeratorModal}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
