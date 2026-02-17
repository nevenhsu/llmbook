"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { uploadImage, createImagePreview, formatBytes, UploadOptions } from "@/lib/image-upload";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onError?: (error: string) => void;
  label?: string;
  aspectRatio?: "square" | "banner" | "original";
  maxWidth?: number;
  maxBytes?: number;
  quality?: number;
  placeholder?: string;
  className?: string;
}

export default function ImageUpload({
  value,
  onChange,
  onError,
  label,
  aspectRatio = "original",
  maxWidth = 2048,
  maxBytes = 5 * 1024 * 1024,
  quality = 82,
  placeholder = "點擊或拖曳上傳圖片",
  className = "",
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(value || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > maxBytes) {
        const errorMsg = `檔案大小超過 ${formatBytes(maxBytes)} 限制`;
        onError?.(errorMsg);
        return;
      }

      if (!file.type.startsWith("image/")) {
        onError?.("只允許上傳圖片檔案");
        return;
      }

      setIsUploading(true);

      try {
        // Show preview immediately
        const localPreview = await createImagePreview(file);
        setPreview(localPreview);

        // Upload with options
        const options: UploadOptions = { maxWidth, maxBytes, quality, aspectRatio };
        const result = await uploadImage(file, options);

        onChange(result.url);
      } catch (err: any) {
        const errorMsg = err.message || "上傳失敗";
        onError?.(errorMsg);
        // Revert preview on error if we had no previous value
        if (!value) {
          setPreview(null);
        }
      } finally {
        setIsUploading(false);
      }
    },
    [maxWidth, maxBytes, quality, onChange, onError, value],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset input so same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange("");
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const aspectRatioClass =
    aspectRatio === "square" ? "aspect-square" : aspectRatio === "banner" ? "aspect-[3/1]" : "";

  return (
    <div className={`form-control ${className}`}>
      {label && (
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
      )}

      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative cursor-pointer overflow-hidden rounded-lg border-2 border-dashed transition-all duration-200 ${isDragging ? "border-primary bg-primary/5" : "border-neutral hover:border-primary/50"} ${aspectRatioClass || "min-h-[120px]"} ${preview ? "bg-base-100" : "bg-base-200/50"} `}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
        />

        {preview ? (
          <div className="group relative h-full w-full">
            <img
              src={preview}
              alt="Preview"
              className={`h-full w-full object-cover ${aspectRatio === "original" ? "max-h-48" : ""}`}
            />

            {/* Overlay on hover */}
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
                className="btn btn-sm btn-ghost text-white"
                disabled={isUploading}
              >
                <Upload size={16} />
                更換
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                className="btn btn-sm btn-ghost text-white"
                disabled={isUploading}
              >
                <X size={16} />
                移除
              </button>
            </div>

            {/* Uploading indicator */}
            {isUploading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                <Loader2 size={32} className="text-primary mb-2 animate-spin" />
                <span className="text-sm text-white">上傳中...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full min-h-[120px] flex-col items-center justify-center p-4">
            {isUploading ? (
              <>
                <Loader2 size={32} className="text-primary mb-2 animate-spin" />
                <span className="text-sm opacity-70">上傳中...</span>
              </>
            ) : (
              <>
                <Upload
                  size={32}
                  className={`mb-2 ${isDragging ? "text-primary" : "opacity-50"}`}
                />
                <span className="text-center text-sm opacity-70">{placeholder}</span>
                <span className="mt-1 text-xs opacity-50">
                  最大 {formatBytes(maxBytes)}，寬度最大 {maxWidth}px
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
