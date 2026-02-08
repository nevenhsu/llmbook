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
    if (!file.type.startsWith('image/')) {
      toast.error('只允許上傳圖片檔案');
      return;
    }

    // Validate file size (5MB limit)
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error('檔案大小超過 5 MB 限制');
      return;
    }

    setIsUploading(true);

    try {
      // Upload image
      const result = await uploadImage(file, {
        maxWidth: 512,
        maxBytes: maxBytes,
        quality: 85
      });

      setAvatarUrl(result.url);
      setPreview(result.url);
      toast.success('圖片已上傳');
    } catch (err: any) {
      toast.error(err.message || '上傳失敗');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!avatarUrl) {
      toast.error('請先上傳頭像');
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
        throw new Error('更新失敗');
      }

      toast.success('頭像已更新');
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || '更新失敗');
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
      <div className="flex items-center gap-4 rounded-xl border border-border-default bg-surface p-4">
        <Avatar 
          fallbackSeed={currentDisplayName} 
          src={preview} 
          size="lg" 
          className="border-2 border-border-default" 
        />
        <div>
          <p className="text-sm font-semibold text-text-primary">當前頭像</p>
          <p className="text-xs text-text-secondary">上傳圖片後點擊「儲存」套用變更</p>
        </div>
      </div>

      {/* Upload Area */}
      <div className="space-y-3">
        <label className="block">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id="avatar-upload"
            disabled={isUploading}
          />
          <div 
            onClick={() => document.getElementById('avatar-upload')?.click()}
            className="flex flex-col items-center justify-center min-h-[160px] border-2 border-dashed border-border-default rounded-xl cursor-pointer hover:border-upvote hover:bg-highlight transition-colors"
          >
            {isUploading ? (
              <>
                <Loader2 size={32} className="animate-spin text-upvote mb-2" />
                <span className="text-sm text-text-secondary">上傳中...</span>
              </>
            ) : (
              <>
                <Upload size={32} className="text-text-secondary mb-2" />
                <span className="text-sm text-text-primary font-semibold">點擊上傳圖片</span>
                <span className="text-xs text-text-secondary mt-1">
                  支援 JPG、PNG、GIF（最大 5 MB）
                </span>
              </>
            )}
          </div>
        </label>

        {preview && preview !== currentAvatarUrl && (
          <button
            type="button"
            onClick={handleRemove}
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
          >
            <X size={16} />
            取消選擇
          </button>
        )}
      </div>

      {/* Save Button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving || isUploading || !avatarUrl || avatarUrl === currentAvatarUrl}
        className="inline-flex min-h-10 items-center justify-center rounded-full bg-upvote px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? "儲存中..." : "儲存頭像"}
      </button>
    </div>
  );
}
