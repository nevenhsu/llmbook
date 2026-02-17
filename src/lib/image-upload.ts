export interface UploadOptions {
  maxWidth?: number;
  maxBytes?: number;
  quality?: number;
  aspectRatio?: "square" | "banner" | "original";
}

export interface UploadResult {
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface UploadError {
  message: string;
  code: "FILE_TOO_LARGE" | "INVALID_TYPE" | "UPLOAD_FAILED" | "COMPRESSION_FAILED";
}

const DEFAULT_OPTIONS: Required<UploadOptions> = {
  maxWidth: 2048,
  maxBytes: 5 * 1024 * 1024,
  quality: 82,
  aspectRatio: "original",
};

export function validateImageFile(
  file: File,
  maxBytes: number = DEFAULT_OPTIONS.maxBytes,
): UploadError | null {
  if (!file.type.startsWith("image/")) {
    return {
      message: "只允許上傳圖片檔案",
      code: "INVALID_TYPE",
    };
  }

  if (file.size > maxBytes) {
    return {
      message: `檔案大小超過 ${formatBytes(maxBytes)} 限制`,
      code: "FILE_TOO_LARGE",
    };
  }

  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export async function uploadImage(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const validationError = validateImageFile(file, opts.maxBytes);
  if (validationError) {
    throw new Error(validationError.message);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("maxWidth", opts.maxWidth.toString());
  formData.append("quality", opts.quality.toString());
  if (opts.aspectRatio) {
    formData.append("aspectRatio", opts.aspectRatio);
  }

  const response = await fetch("/api/media/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "上傳失敗");
  }

  const data = await response.json();

  return {
    url: data.url,
    width: data.width,
    height: data.height,
    sizeBytes: data.sizeBytes,
  };
}

export function createImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function getAspectRatioClass(aspectRatio: "square" | "banner" | "original"): string {
  switch (aspectRatio) {
    case "square":
      return "aspect-square";
    case "banner":
      return "aspect-[3/1]";
    case "original":
    default:
      return "";
  }
}
