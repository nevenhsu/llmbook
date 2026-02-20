"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, AlertCircle, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import ImageUpload from "@/components/ui/ImageUpload";
import { useRulesEditor } from "@/hooks/use-rules-editor";
import { apiPost, apiFetchJson, ApiError } from "@/lib/api/fetch-json";

export default function CreateBoardForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const { rules, addRule, updateRule, removeRule } = useRulesEditor([]);
  const [bannerUrl, setBannerUrl] = useState("");

  // Validation states
  const [nameError, setNameError] = useState("");
  const [slugError, setSlugError] = useState("");
  const [checking, setChecking] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);

  // Debounced availability check
  const checkAvailability = useCallback(async (name: string, slug: string) => {
    if (!name || !slug) return;

    setChecking(true);
    try {
      const params = new URLSearchParams();
      if (name) params.append("name", name);
      if (slug) params.append("slug", slug);

      const data = await apiFetchJson<{ nameAvailable: boolean; slugAvailable: boolean }>(
        `/api/boards/check-availability?${params}`,
      );

      setNameAvailable(data.nameAvailable);
      setSlugAvailable(data.slugAvailable);
    } catch (err) {
      console.error("Failed to check availability:", err);
    } finally {
      setChecking(false);
    }
  }, []);

  // Debounce effect for availability check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (name && slug && !nameError && !slugError) {
        checkAvailability(name, slug);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [name, slug, nameError, slugError, checkAvailability]);

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value);

    // Validate English only
    if (value && !/^[a-zA-Z0-9_]+$/.test(value)) {
      setNameError("Only English letters, numbers, and underscores allowed");
    } else if (value.length > 0 && value.length < 3) {
      setNameError("Name must be at least 3 characters");
    } else if (value.length > 21) {
      setNameError("Name must be at most 21 characters");
    } else {
      setNameError("");
    }

    // Auto-generate slug
    const autoSlug = value
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    setSlug(autoSlug);

    // Reset availability
    setNameAvailable(null);
    setSlugAvailable(null);
  };

  const handleSlugChange = (value: string) => {
    const lowerValue = value.toLowerCase();
    setSlug(lowerValue);

    if (lowerValue && !/^[a-z0-9_]+$/.test(lowerValue)) {
      setSlugError("Only lowercase letters, numbers, and underscores allowed");
    } else {
      setSlugError("");
    }

    setSlugAvailable(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Final validation
    if (nameError || slugError) {
      toast.error("Please fix validation errors");
      return;
    }

    if (!nameAvailable) {
      toast.error("Board name is already taken");
      return;
    }

    if (!slugAvailable) {
      toast.error("Board slug is already taken");
      return;
    }

    setLoading(true);

    try {
      const { board } = await apiPost<{ board: { name: string; slug: string } }>("/api/boards", {
        name,
        slug,
        description: description || undefined,
        banner_url: bannerUrl || undefined,
        rules: rules.filter((r) => r.title.trim()),
      });
      toast.success(`Board "${board.name}" created successfully!`);
      router.push(`/r/${board.slug}`);
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : "Failed to create board";
      toast.error(message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text font-semibold">Board Name *</span>
        </label>
        <div className="relative">
          <input
            type="text"
            className={`input input-bordered bg-base-100 w-full ${
              nameError
                ? "border-error"
                : name && nameAvailable
                  ? "border-success"
                  : "border-neutral"
            }`}
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="gaming"
            minLength={3}
            maxLength={21}
            required
          />
          {checking && name && (
            <span className="absolute top-1/2 right-3 -translate-y-1/2">
              <span className="loading loading-spinner loading-sm"></span>
            </span>
          )}
          {!checking && name && !nameError && nameAvailable !== null && (
            <span className="absolute top-1/2 right-3 -translate-y-1/2">
              {nameAvailable ? (
                <CheckCircle size={20} className="text-success" />
              ) : (
                <AlertCircle size={20} className="text-error" />
              )}
            </span>
          )}
        </div>
        <label className="label">
          {nameError ? (
            <span className="label-text text-error flex items-center gap-1">
              <AlertCircle size={14} />
              {nameError}
            </span>
          ) : !nameAvailable && nameAvailable !== null ? (
            <span className="label-text text-error">Name already taken</span>
          ) : (
            <span className="label-text text-base-content/70">
              3-21 characters, English letters, numbers, and underscores only
            </span>
          )}
        </label>
      </div>

      {/* Slug (Auto-generated, read-only display) */}
      <div className="form-control mb-6">
        <label className="label">
          <span className="label-text font-semibold">URL Slug *</span>
        </label>
        <div className="flex items-center gap-2">
          <div className="join flex-1">
            <span className="join-item bg-base-300 text-base-content/70 border-neutral flex items-center rounded-l-lg border px-3 text-sm">
              r/
            </span>
            <input
              type="text"
              className={`input input-bordered join-item bg-base-100 flex-1 ${
                slugError
                  ? "border-error"
                  : slug && slugAvailable
                    ? "border-success"
                    : "border-neutral"
              }`}
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="gaming"
              pattern="[a-z0-9_]+"
              required
            />
          </div>
          {!checking && slug && !slugError && slugAvailable !== null && (
            <span>
              {slugAvailable ? (
                <CheckCircle size={20} className="text-success" />
              ) : (
                <AlertCircle size={20} className="text-error" />
              )}
            </span>
          )}
        </div>
        <label className="label">
          {slugError ? (
            <span className="label-text text-error flex items-center gap-1">
              <AlertCircle size={14} />
              {slugError}
            </span>
          ) : !slugAvailable && slugAvailable !== null ? (
            <span className="label-text text-error">Slug already taken</span>
          ) : (
            <span className="label-text text-base-content/70">
              Auto-generated from name (lowercase)
            </span>
          )}
        </label>
      </div>

      {/* Description */}
      <div className="form-control mb-6">
        <label className="label">
          <span className="label-text font-semibold">Description</span>
        </label>
        <textarea
          className="textarea textarea-bordered bg-base-100 border-neutral w-full"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this board about?"
          maxLength={500}
          rows={3}
        />
        <label className="label">
          <span className="label-text text-base-content/70">{description.length}/500</span>
        </label>
      </div>

      {/* Rules */}
      <div className="form-control mb-6">
        <label className="label">
          <span className="label-text font-semibold">Community Rules</span>
          <span className="label-text-alt text-base-content/70">{rules.length}/15</span>
        </label>
        <div className="space-y-2">
          {rules.map((rule, index) => (
            <div key={index} className="collapse-arrow bg-base-100 border-neutral collapse border">
              <input type="checkbox" defaultChecked />
              <div className="collapse-title flex items-center justify-between font-medium">
                <span>Rule {index + 1}</span>
              </div>
              <div className="collapse-content space-y-2">
                <input
                  type="text"
                  className="input input-bordered input-sm bg-base-100 border-neutral w-full"
                  value={rule.title}
                  onChange={(e) => updateRule(index, "title", e.target.value)}
                  placeholder="Rule title"
                  maxLength={100}
                />
                <textarea
                  className="textarea textarea-bordered textarea-sm bg-base-100 border-neutral w-full"
                  value={rule.description}
                  onChange={(e) => updateRule(index, "description", e.target.value)}
                  placeholder="Rule description (optional)"
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
          className="btn btn-outline btn-sm mt-2 w-full sm:w-auto"
          onClick={addRule}
          disabled={rules.length >= 15}
        >
          <Plus size={16} />
          Add Rule
        </button>
      </div>

      {/* Banner */}
      <div className="mb-6">
        <ImageUpload
          label="Banner Image"
          value={bannerUrl}
          onChange={setBannerUrl}
          onError={(err) => toast.error(err)}
          aspectRatio="banner"
          placeholder="Upload banner (3:1 ratio recommended)"
        />
        <p className="text-base-content/70 mt-2 text-sm">
          Banner will be automatically cropped to 3:1 aspect ratio
        </p>
      </div>

      {/* Submit Button */}
      <div className="flex pt-2">
        <button
          type="submit"
          className="btn btn-primary rounded-full px-8"
          disabled={
            loading ||
            !name ||
            !slug ||
            !!nameError ||
            !!slugError ||
            checking ||
            !nameAvailable ||
            !slugAvailable
          }
        >
          {loading ? <span className="loading loading-spinner loading-sm"></span> : "Create Board"}
        </button>
      </div>
    </form>
  );
}
