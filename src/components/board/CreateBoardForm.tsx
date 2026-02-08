'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Plus } from 'lucide-react';
import ImageUpload from '@/components/ui/ImageUpload';

interface Rule {
  title: string;
  description: string;
}

export default function CreateBoardForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState<Rule[]>([]);
  const [bannerUrl, setBannerUrl] = useState('');
  const [iconUrl, setIconUrl] = useState('');

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')) {
      setSlug(value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          description: description || undefined,
          banner_url: bannerUrl || undefined,
          icon_url: iconUrl || undefined,
          rules: rules.filter(r => r.title.trim())
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to create board');
      }

      const { board } = await response.json();
      router.push(`/r/${board.slug}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="pb-20 sm:pb-6">
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {/* Name */}
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">Board Name *</span>
        </label>
        <input
          type="text"
          className="input input-bordered w-full bg-surface border-neutral"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="gaming"
          minLength={3}
          maxLength={21}
          required
        />
        <label className="label">
          <span className="label-text-alt">3-21 characters, alphanumeric and underscores only</span>
        </label>
      </div>

      {/* Slug */}
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">URL Slug *</span>
        </label>
        <div className="join w-full">
          <span className="join-item btn btn-sm btn-disabled">r/</span>
          <input
            type="text"
            className="input input-bordered join-item flex-1 bg-surface border-neutral"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="gaming"
            pattern="[a-z0-9_]+"
            required
          />
        </div>
        <label className="label">
          <span className="label-text-alt">Lowercase, alphanumeric and underscores only</span>
        </label>
      </div>

      {/* Description */}
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">Description</span>
        </label>
        <textarea
          className="textarea textarea-bordered w-full bg-surface border-neutral"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this board about?"
          maxLength={500}
          rows={3}
        />
        <label className="label">
          <span className="label-text-alt">{description.length}/500</span>
        </label>
      </div>

      {/* Banner & Icon */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="w-full sm:w-1/2">
          <ImageUpload
            label="Banner"
            value={bannerUrl}
            onChange={setBannerUrl}
            onError={(err) => setError(err)}
            aspectRatio="banner"
            placeholder="上傳 Banner 圖片"
          />
        </div>
        <div className="w-full sm:w-1/2">
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

      {/* Rules */}
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text">Community Rules</span>
        </label>
        <div className="space-y-2">
          {rules.map((rule, index) => (
            <div key={index} className="collapse collapse-arrow bg-surface border border-neutral">
              <input type="checkbox" defaultChecked />
              <div className="collapse-title font-medium flex items-center justify-between">
                <span>Rule {index + 1}</span>
              </div>
              <div className="collapse-content space-y-2">
                <input
                  type="text"
                  className="input input-bordered input-sm w-full bg-surface border-neutral"
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
                <button
                  type="button"
                  className="btn btn-error btn-xs"
                  onClick={() => removeRule(index)}
                >
                  <X size={14} />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm w-full sm:w-auto mt-2"
          onClick={addRule}
          disabled={rules.length >= 15}
        >
          <Plus size={16} />
          Add Rule
        </button>
      </div>

      {/* Sticky Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 sm:relative bg-base-200 border-t border-neutral p-3 sm:p-0 sm:border-0 z-40">
        <button
          type="submit"
          className="btn btn-primary w-full sm:w-auto rounded-full"
          disabled={loading || !name || !slug}
        >
          {loading ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            'Create Board'
          )}
        </button>
      </div>
    </form>
  );
}
