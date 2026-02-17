"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadImage } from "@/lib/image-upload";
import { Upload, X, Loader2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import toast from "react-hot-toast";

interface AvatarFormProps {
  currentAvatarUrl: string | null;
  currentDisplayName: string;
}

export default function AvatarForm({ currentAvatarUrl, currentDisplayName }: AvatarFormProps) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl ?? "");
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("只允許上傳圖片檔案");
      e.target.value = ""; // Reset input
      return;
    }

    // Validate file size (5MB limit)
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error("檔案大小超過 5 MB 限制");
      e.target.value = ""; // Reset input
      return;
    }

    // Show local preview immediately
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setIsUploading(true);

    try {
      // Upload image
      const result = await uploadImage(file, {
        maxWidth: 512,
        maxBytes: maxBytes,
        quality: 85,
      });

      // Update with uploaded URL but don't save to profile yet
      setAvatarUrl(result.url);
      setPreview(result.url);

      // Cleanup local preview
      URL.revokeObjectURL(localPreview);

      toast.success("圖片已準備好，點擊「儲存」套用變更");
    } catch (err: any) {
      toast.error(err.message || "上傳失敗");
      // Revert to current avatar on error
      setPreview(currentAvatarUrl);
      URL.revokeObjectURL(localPreview);
    } finally {
      setIsUploading(false);
      e.target.value = ""; // Reset input to allow re-selecting same file
    }
  };

  const handleSave = async () => {
    if (!avatarUrl) {
      toast.error("請先上傳頭像");
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl }),
      });

      if (!res.ok) {
        throw new Error("更新失敗");
      }

      toast.success("頭像已更新");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "更新失敗");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setAvatarUrl("");
  };

  return (
    <div className="space-y-4">
      {/* Current Avatar Preview */}
      <div className="border-neutral bg-base-100 flex items-center gap-4 rounded-xl border p-4">
        <Avatar fallbackSeed={currentDisplayName} src={preview} size="lg" />
        <div>
          <p className="text-base-content text-sm font-semibold">當前頭像</p>
          <p className="text-base-content/70 text-xs">上傳圖片後點擊「儲存」套用變更</p>
        </div>
      </div>

      {/* Upload Area */}
      <div className="space-y-3">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id="avatar-upload"
          disabled={isUploading}
        />
        <div
          onClick={() => document.getElementById("avatar-upload")?.click()}
          className="border-neutral hover:border-primary hover:bg-base-300 flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors"
        >
          {isUploading ? (
            <>
              <Loader2 size={32} className="text-primary mb-2 animate-spin" />
              <span className="text-base-content/70 text-sm">上傳中...</span>
            </>
          ) : (
            <>
              <Upload size={32} className="text-base-content/70 mb-2" />
              <span className="text-base-content text-sm font-semibold">點擊上傳圖片</span>
              <span className="text-base-content/70 mt-1 text-xs">
                支援 JPG、PNG、GIF（最大 5 MB）
              </span>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        {preview && preview !== currentAvatarUrl ? (
          <button
            type="button"
            onClick={handleRemove}
            className="text-base-content/70 hover:text-base-content flex items-center gap-2 text-sm transition-colors"
          >
            <X size={16} />
            取消選擇
          </button>
        ) : (
          <div></div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isUploading || !avatarUrl || avatarUrl === currentAvatarUrl}
          className="bg-primary inline-flex min-h-10 items-center justify-center rounded-full px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "儲存中..." : "儲存頭像"}
        </button>
      </div>
    </div>
  );
}
