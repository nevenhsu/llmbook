/**
 * Supabase Storage Integration Tests
 *
 * Tests:
 *   1. Bucket existence and configuration
 *   2. Upload functionality
 *   3. Public URL generation
 *   4. File listing
 *   5. File deletion
 *   6. Path structure validation
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - SUPABASE_STORAGE_BUCKET
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { privateEnv, publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

describe("Supabase Storage", () => {
  const supabase = createAdminClient();
  const uploadedFiles: string[] = [];

  // Minimal 1x1 PNG image (base64 encoded)
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const pngBuffer = Buffer.from(pngBase64, "base64");

  // Helper function to track and clean up uploaded files
  const trackUpload = (path: string) => {
    uploadedFiles.push(path);
  };

  beforeAll(() => {
    console.log("Testing Storage Bucket:", privateEnv.storageBucket);
    console.log("Bucket size limit: 10 MB");
  });

  afterAll(async () => {
    // Clean up all uploaded test files
    if (uploadedFiles.length > 0) {
      console.log(`Cleaning up ${uploadedFiles.length} test file(s)...`);

      // Remove files in batches of 10 (Supabase limit)
      const batchSize = 10;
      for (let i = 0; i < uploadedFiles.length; i += batchSize) {
        const batch = uploadedFiles.slice(i, i + batchSize);
        const { error } = await supabase.storage.from(privateEnv.storageBucket).remove(batch);

        if (error) {
          console.error(`Failed to delete batch ${i / batchSize + 1}:`, error.message);
        } else {
          console.log(`✓ Deleted ${batch.length} file(s) (batch ${i / batchSize + 1})`);
        }
      }

      console.log(`✅ Cleanup complete! Removed ${uploadedFiles.length} test file(s)`);
    }
  });

  describe("Bucket Configuration", () => {
    it("should list all buckets", async () => {
      const { data: buckets, error } = await supabase.storage.listBuckets();

      expect(error).toBeNull();
      expect(buckets).toBeDefined();
      expect(Array.isArray(buckets)).toBe(true);
      expect(buckets!.length).toBeGreaterThan(0);
    });

    it("should have media bucket configured", async () => {
      const { data: buckets, error } = await supabase.storage.listBuckets();

      expect(error).toBeNull();

      const mediaBucket = buckets!.find((b) => b.name === privateEnv.storageBucket);

      expect(mediaBucket).toBeDefined();
      expect(mediaBucket!.name).toBe(privateEnv.storageBucket);
      expect(mediaBucket!.public).toBe(true);
    });
  });

  describe("File Operations", () => {
    it("should upload a file", async () => {
      const testPath = `test/${Date.now()}-test.png`;

      const { data, error } = await supabase.storage
        .from(privateEnv.storageBucket)
        .upload(testPath, pngBuffer, {
          contentType: "image/png",
          upsert: false,
        });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.path).toBe(testPath);

      trackUpload(testPath);
    });

    it("should upload an image file", async () => {
      const testPath = `test/${Date.now()}-test-image.png`;

      const { data, error } = await supabase.storage
        .from(privateEnv.storageBucket)
        .upload(testPath, pngBuffer, {
          contentType: "image/png",
          upsert: false,
        });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.path).toBe(testPath);

      trackUpload(testPath);
    });

    it("should generate public URL for uploaded file", async () => {
      const testPath = `test/${Date.now()}-public-url-test.png`;

      // Upload file first
      const { error: uploadError } = await supabase.storage
        .from(privateEnv.storageBucket)
        .upload(testPath, pngBuffer, {
          contentType: "image/png",
        });

      expect(uploadError).toBeNull();
      trackUpload(testPath);

      // Get public URL
      const { data } = supabase.storage.from(privateEnv.storageBucket).getPublicUrl(testPath);

      expect(data.publicUrl).toBeDefined();
      expect(data.publicUrl).toContain(publicEnv.supabaseUrl);
      expect(data.publicUrl).toContain(privateEnv.storageBucket);
      expect(data.publicUrl).toContain(testPath);

      // Verify URL is accessible
      const response = await fetch(data.publicUrl);
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);

      const body = Buffer.from(await response.arrayBuffer());
      expect(body.equals(pngBuffer)).toBe(true);
    });

    it("should list files in a folder", async () => {
      const { data, error } = await supabase.storage.from(privateEnv.storageBucket).list("test", {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data!.length).toBeGreaterThan(0);
    });

    it("should delete a file", async () => {
      const testPath = `test/${Date.now()}-delete-test.png`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from(privateEnv.storageBucket)
        .upload(testPath, pngBuffer, { contentType: "image/png" });

      expect(uploadError).toBeNull();

      // Delete file
      const { error: deleteError } = await supabase.storage
        .from(privateEnv.storageBucket)
        .remove([testPath]);

      expect(deleteError).toBeNull();
    });
  });

  describe("Path Structure", () => {
    it("should support user folder structure", async () => {
      const testUserId = "test-user-id";
      const paths = [
        `${testUserId}/posts/test-post.png`,
        `${testUserId}/avatars/test-avatar.png`,
        `${testUserId}/boards/test-board.png`,
      ];

      for (const path of paths) {
        const { data, error } = await supabase.storage
          .from(privateEnv.storageBucket)
          .upload(path, pngBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data!.path).toBe(path);

        trackUpload(path);
      }
    });

    it("should support persona folder structure", async () => {
      const paths = [
        "personas/avatars/test-persona-avatar.png",
        "personas/posts/test-persona-id/test-post.png",
      ];

      for (const path of paths) {
        const { data, error } = await supabase.storage
          .from(privateEnv.storageBucket)
          .upload(path, pngBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data!.path).toBe(path);

        trackUpload(path);
      }
    });
  });

  describe("Storage Policies", () => {
    it("should allow service role to upload to any path", async () => {
      const paths = [
        "test/service-role-test.png",
        "random/path/to/file.png",
        "personas/avatars/service-test.png",
      ];

      for (const path of paths) {
        const { error } = await supabase.storage
          .from(privateEnv.storageBucket)
          .upload(path, pngBuffer, {
            contentType: "image/png",
            upsert: true,
          });

        // Service role should be able to upload anywhere
        expect(error).toBeNull();

        trackUpload(path);
      }
    });

    it("should allow service role to delete any file", async () => {
      const testPath = `test/${Date.now()}-service-delete-test.png`;

      // Upload
      await supabase.storage
        .from(privateEnv.storageBucket)
        .upload(testPath, pngBuffer, { contentType: "image/png" });

      // Delete
      const { error } = await supabase.storage.from(privateEnv.storageBucket).remove([testPath]);

      expect(error).toBeNull();
    });
  });

  describe("File Validation", () => {
    it("should reject files exceeding size limit (10 MB)", async () => {
      // Create a buffer larger than 10 MB
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB
      const testPath = `test/${Date.now()}-large-file.bin`;

      const { error } = await supabase.storage
        .from(privateEnv.storageBucket)
        .upload(testPath, largeBuffer);

      // Should fail due to 10 MB size limit
      expect(error).not.toBeNull();
      expect(error!.message).toBeDefined();
      console.log("Expected error for large file:", error!.message);
    });

    it("should accept valid image types", async () => {
      const pngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const pngBuffer = Buffer.from(pngBase64, "base64");

      const imageTypes = [
        { ext: "png", type: "image/png" },
        { ext: "jpg", type: "image/jpeg" },
        { ext: "webp", type: "image/webp" },
        { ext: "gif", type: "image/gif" },
      ];

      for (const { ext, type } of imageTypes) {
        const testPath = `test/${Date.now()}-test.${ext}`;

        const { error } = await supabase.storage
          .from(privateEnv.storageBucket)
          .upload(testPath, pngBuffer, {
            contentType: type,
          });

        expect(error).toBeNull();
        trackUpload(testPath);
      }
    });
  });

  describe("Bucket Info", () => {
    it("should have correct bucket configuration", async () => {
      const { data: buckets, error } = await supabase.storage.listBuckets();

      expect(error).toBeNull();

      const mediaBucket = buckets!.find((b) => b.name === privateEnv.storageBucket);

      expect(mediaBucket).toBeDefined();
      expect(mediaBucket!.public).toBe(true);
      expect(mediaBucket!.name).toBe("media");
    });
  });
});
