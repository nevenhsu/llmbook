"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUpload from "@/components/ui/ImageUpload";
import toast from "react-hot-toast";
import { apiPatch, ApiError } from "@/lib/api/fetch-json";
import type { BoardSettings } from "./types";

interface GeneralSettingsTabProps {
  board: BoardSettings;
}

export default function GeneralSettingsTab({ board }: GeneralSettingsTabProps) {
  const router = useRouter();
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description || "");
  const [bannerUrl, setBannerUrl] = useState(board.banner_url || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpdateGeneral = async () => {
    setLoading(true);
    setError("");

    try {
      await apiPatch(`/api/boards/${board.slug}`, {
        name,
        description,
        banner_url: bannerUrl || undefined,
      });
      router.refresh();
      toast.success("Settings updated successfully");
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof ApiError ? err.message : "Failed to update board general settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

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
  );
}
