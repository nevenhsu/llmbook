import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import {
  validateImageFile,
  formatBytes,
  getAspectRatioClass,
  createImagePreview,
  uploadImage,
  type UploadOptions,
} from "./image-upload";
import { createAdminClient } from "./supabase/admin";
import { publicEnv, privateEnv, isIntegrationTest, validateTestEnv } from "./env";

// Mock FileReader for Node.js environment
class MockFileReader {
  result: string | null = null;
  onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

  readAsDataURL(file: Blob) {
    setTimeout(() => {
      // Create a simple base64 data URL
      file.arrayBuffer().then((buffer) => {
        const base64 = Buffer.from(buffer).toString("base64");
        const type = (file as File).type || "application/octet-stream";
        this.result = `data:${type};base64,${base64}`;
        if (this.onloadend) {
          this.onloadend.call(this as any, new Event("loadend") as any);
        }
      });
    }, 0);
  }
}

// Only define FileReader if it doesn't exist (Node.js environment)
if (typeof FileReader === "undefined") {
  global.FileReader = MockFileReader as any;
}

// ============================================
// Unit Tests (Pure Functions)
// ============================================

describe("image-upload (unit)", () => {
  describe("validateImageFile", () => {
    it("returns null for valid image file", () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 1024 });

      const result = validateImageFile(file, 5 * 1024 * 1024);
      expect(result).toBeNull();
    });

    it("returns error for non-image file", () => {
      const file = new File(["test"], "test.txt", { type: "text/plain" });
      Object.defineProperty(file, "size", { value: 1024 });

      const result = validateImageFile(file);
      expect(result).not.toBeNull();
      expect(result?.code).toBe("INVALID_TYPE");
      expect(result?.message).toContain("只允許");
    });

    it("returns error for file exceeding max size", () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 }); // 10MB

      const result = validateImageFile(file, 5 * 1024 * 1024);
      expect(result).not.toBeNull();
      expect(result?.code).toBe("FILE_TOO_LARGE");
      expect(result?.message).toContain("5 MB");
    });

    it("uses default max size when not provided", () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 6 * 1024 * 1024 }); // 6MB

      const result = validateImageFile(file);
      expect(result?.code).toBe("FILE_TOO_LARGE");
    });
  });

  describe("formatBytes", () => {
    it("formats 0 bytes correctly", () => {
      expect(formatBytes(0)).toBe("0 B");
    });

    it("formats bytes correctly", () => {
      expect(formatBytes(512)).toBe("512 B");
    });

    it("formats KB correctly", () => {
      expect(formatBytes(1024)).toBe("1 KB");
      expect(formatBytes(1536)).toBe("1.5 KB");
    });

    it("formats MB correctly", () => {
      expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
      expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
    });

    it("formats GB correctly", () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
    });
  });

  describe("getAspectRatioClass", () => {
    it("returns aspect-square for square", () => {
      expect(getAspectRatioClass("square")).toBe("aspect-square");
    });

    it("returns aspect-[3/1] for banner", () => {
      expect(getAspectRatioClass("banner")).toBe("aspect-[3/1]");
    });

    it("returns empty string for original", () => {
      expect(getAspectRatioClass("original")).toBe("");
    });

    it("returns empty string for unknown value", () => {
      expect(getAspectRatioClass("unknown" as any)).toBe("");
    });
  });

  describe("createImagePreview", () => {
    it("creates data URL from file", async () => {
      const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic number
      const file = new File([buffer], "test.png", { type: "image/png" });

      const result = await createImagePreview(file);
      expect(result).toMatch(/^data:image\/png;base64,/);
    });

    it("rejects on error", async () => {
      const mockFile = {
        name: "test.txt",
        type: "text/plain",
      } as File;

      // Mock FileReader to simulate error
      const originalFileReader = global.FileReader;
      global.FileReader = class MockFileReader {
        onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
        onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

        readAsDataURL() {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror.call(this as any, new Event("error") as any);
            }
          }, 0);
        }

        result = null;
      } as any;

      await expect(createImagePreview(mockFile)).rejects.toBeDefined();

      global.FileReader = originalFileReader;
    });
  });
});

// ============================================
// Integration Tests (Upload to Supabase)
// ============================================

const integrationDescribe = isIntegrationTest ? describe : describe.skip;

// Cookie jar for integration tests authentication
const cookieJar = new Map<string, string>();
const cookieStore = {
  getAll: () => Array.from(cookieJar, ([name, value]) => ({ name, value })),
  set: (name: string, value: string) => {
    cookieJar.set(name, value);
  },
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => cookieStore),
}));

async function signInAndSeedCookies() {
  const userClient = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!privateEnv.testUserEmail || !privateEnv.testUserPassword) {
    throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD are required for integration tests");
  }

  const { data, error } = await userClient.auth.signInWithPassword({
    email: privateEnv.testUserEmail,
    password: privateEnv.testUserPassword,
  });

  if (error || !data.session) {
    throw new Error(
      `Failed to sign in test user: ${error?.message ?? "no session"}`
    );
  }

  // Manually seed cookies for the mock
  cookieJar.set("sb-access-token", data.session.access_token);
  cookieJar.set("sb-refresh-token", data.session.refresh_token);
}

function getStorageKeyFromPublicUrl(url: string, bucketName: string): string | null {
  const marker = `/storage/v1/object/public/${bucketName}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

integrationDescribe("image-upload (integration)", () => {
  let admin: ReturnType<typeof createAdminClient> | null = null;
  let bucket: string;
  const uploadedUrls: string[] = [];
  const mediaIds: string[] = [];

  beforeAll(async () => {
    // Validate all required env vars for tests
    validateTestEnv();
    bucket = privateEnv.storageBucket;

    // Sign in test user and seed cookies for API authentication
    await signInAndSeedCookies();

    // Use existing admin client from lib/supabase/admin
    admin = createAdminClient();
  });

  afterAll(async () => {
    if (!admin) return;

    console.log("\n🧹 Starting cleanup...");

    // Clean up uploaded files from storage
    for (const url of uploadedUrls) {
      const key = getStorageKeyFromPublicUrl(url, bucket);
      if (key) {
        try {
          const { error } = await admin.storage.from(bucket).remove([key]);
          if (error) {
            console.error(`  ✗ Failed to clean up storage file ${key}:`, error.message);
          } else {
            console.log(`  ✓ Cleaned up storage file: ${key}`);
          }
        } catch (err) {
          console.error(`  ✗ Error cleaning up storage file ${key}:`, err);
        }
      }
    }

    // Clean up media records from database
    for (const mediaId of mediaIds) {
      try {
        const { error } = await admin.from("media").delete().eq("id", mediaId);
        if (error) {
          console.error(`  ✗ Failed to clean up media record ${mediaId}:`, error.message);
        } else {
          console.log(`  ✓ Cleaned up media record: ${mediaId}`);
        }
      } catch (err) {
        console.error(`  ✗ Error cleaning up media record ${mediaId}:`, err);
      }
    }

    console.log(`\n✅ Cleanup completed: ${uploadedUrls.length} files, ${mediaIds.length} records deleted from Supabase\n`);
  });

  describe("uploadImage via API", () => {
    it("successfully uploads and compresses image to Supabase", async () => {
      // Import the API route handler directly (like the existing integration test)
      const { POST } = await import("@/app/api/media/upload/route");

      // Create a test image using sharp (larger than maxWidth to test compression)
      const inputBuffer = await sharp({
        create: {
          width: 3000,
          height: 2000,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .png({ compressionLevel: 0 })
        .toBuffer();

      const file = new File([new Uint8Array(inputBuffer)], "test-large.png", {
        type: "image/png",
      });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("maxWidth", "2048");
      formData.append("quality", "82");

      const request = new Request("http://localhost/api/media/upload", {
        method: "POST",
        body: formData,
      });

      const response = await POST(request);

      if (!response.ok) {
        throw new Error(`Upload failed: ${await response.text()}`);
      }

      const result = await response.json();

      // Track for cleanup
      uploadedUrls.push(result.url);
      mediaIds.push(result.mediaId);

      // Assertions
      expect(result.url).toMatch(/^https?:\/\//);
      expect(result.width).toBeLessThanOrEqual(2048);
      expect(result.height).toBeLessThanOrEqual(2048);
      expect(result.sizeBytes).toBeLessThan(inputBuffer.length);

      // Verify the file is actually stored in Supabase
      const stored = await fetch(result.url);
      expect(stored.ok).toBe(true);
      expect(stored.headers.get("content-type")).toContain("image/webp");

      console.log(`\n✓ Uploaded to Supabase: ${result.url}`);
      console.log(`  Dimensions: ${result.width}x${result.height}`);
      console.log(`  Size: ${formatBytes(result.sizeBytes)} (compressed from ${formatBytes(inputBuffer.length)})`);
    });

    it("respects custom maxWidth option", async () => {
      const { POST } = await import("@/app/api/media/upload/route");

      const inputBuffer = await sharp({
        create: {
          width: 2400,
          height: 1600,
          channels: 3,
          background: { r: 200, g: 100, b: 150 },
        },
      })
        .png()
        .toBuffer();

      const file = new File([new Uint8Array(inputBuffer)], "test-medium.png", {
        type: "image/png",
      });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("maxWidth", "1200"); // Smaller max width
      formData.append("quality", "75");

      const request = new Request("http://localhost/api/media/upload", {
        method: "POST",
        body: formData,
      });

      const response = await POST(request);

      if (!response.ok) {
        throw new Error(`Upload failed: ${await response.text()}`);
      }

      const result = await response.json();

      // Track for cleanup
      uploadedUrls.push(result.url);
      mediaIds.push(result.mediaId);

      // Image should be resized to max 1200px width
      expect(result.width).toBeLessThanOrEqual(1200);

      console.log(`\n✓ Uploaded with maxWidth=1200: ${result.width}x${result.height}`);
    });
  });

  describe("uploadImage error handling", () => {
    it("throws error for oversized file (client-side validation)", async () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 }); // 10MB

      await expect(uploadImage(file, { maxBytes: 5 * 1024 * 1024 })).rejects.toThrow(
        "檔案大小超過"
      );
    });

    it("throws error for non-image file (client-side validation)", async () => {
      const file = new File(["test content"], "test.txt", { type: "text/plain" });
      Object.defineProperty(file, "size", { value: 100 });

      await expect(uploadImage(file)).rejects.toThrow("只允許");
    });
  });
});

// ============================================
// Mock Tests (Upload without actual API call)
// ============================================

describe("image-upload (mock)", () => {
  describe("uploadImage", () => {
    it("sends correct FormData to API", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://example.com/image.webp",
          width: 800,
          height: 600,
          sizeBytes: 50000,
        }),
      });

      const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const file = new File([buffer], "test.png", { type: "image/png" });

      const result = await uploadImage(file, {
        maxWidth: 1024,
        maxBytes: 2 * 1024 * 1024,
        quality: 90,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/media/upload",
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        })
      );

      const formData = mockFetch.mock.calls[0][1].body as FormData;
      expect(formData.get("file")).toBe(file);
      expect(formData.get("maxWidth")).toBe("1024");
      expect(formData.get("quality")).toBe("90");

      expect(result.url).toBe("https://example.com/image.webp");
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
      expect(result.sizeBytes).toBe(50000);
    });

    it("throws error when API returns error", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "Upload failed",
      });

      const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const file = new File([buffer], "test.png", { type: "image/png" });

      await expect(uploadImage(file)).rejects.toThrow("Upload failed");
    });

    it("throws generic error when API returns empty error", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "",
      });

      const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const file = new File([buffer], "test.png", { type: "image/png" });

      await expect(uploadImage(file)).rejects.toThrow("上傳失敗");
    });
  });
});
