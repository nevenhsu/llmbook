'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, UserPlus, Ban, Archive } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';

interface Rule {
  title: string;
  description: string;
}

interface Moderator {
  id: string;
  user_id: string;
  role: string;
  profiles: {
    display_name: string;
    avatar_url: string;
  };
}

interface BannedUser {
  id: string;
  user_id: string;
  reason: string | null;
  expires_at: string | null;
  profiles: {
    display_name: string;
    avatar_url: string;
  };
}

interface BoardSettingsFormProps {
  board: any;
  moderators: Moderator[];
  bans: BannedUser[];
  userRole: 'owner' | 'moderator';
}

export default function BoardSettingsForm({
  board,
  moderators,
  bans,
  userRole
}: BoardSettingsFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'general' | 'rules' | 'moderators' | 'danger'>('general');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // General settings state
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description || '');
  const [bannerUrl, setBannerUrl] = useState(board.banner_url || '');
  const [iconUrl, setIconUrl] = useState(board.icon_url || '');

  // Rules state
  const [rules, setRules] = useState<Rule[]>(board.rules || []);

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
      setError(err.message);
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
      setError(err.message);
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

      router.push('/boards/archive');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
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
              className="input input-bordered w-full bg-surface border-neutral"
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
              className="textarea textarea-bordered w-full bg-surface border-neutral"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="form-control flex-1">
              <label className="label">
                <span className="label-text">Banner URL</span>
              </label>
              <input
                type="url"
                className="input input-bordered w-full bg-surface border-neutral"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
              />
            </div>
            <div className="form-control flex-1">
              <label className="label">
                <span className="label-text">Icon URL</span>
              </label>
              <input
                type="url"
                className="input input-bordered w-full bg-surface border-neutral"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
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
            <div key={index} className="card bg-surface p-4 border border-neutral">
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
                className="input input-bordered input-sm w-full bg-surface border-neutral mb-2"
                value={rule.title}
                onChange={(e) => updateRule(index, 'title', e.target.value)}
                placeholder="Rule title"
                maxLength={100}
              />
              <textarea
                className="textarea textarea-bordered textarea-sm w-full bg-surface border-neutral"
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
        </div>
      )}

      {/* Moderators Tab */}
      {activeTab === 'moderators' && userRole === 'owner' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {moderators.map((mod) => (
              <div key={mod.id} className="card bg-surface p-3 flex flex-row items-center gap-3">
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
                  <button className="btn btn-ghost btn-xs">Remove</button>
                )}
              </div>
            ))}
          </div>
          <button className="btn btn-outline w-full">
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
    </div>
  );
}
