import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import { POST } from "@/app/api/media/upload/route";
import { 
  publicEnv, 
  privateEnv, 
  isIntegrationTest, 
  validateTestEnv 
} from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const integrationDescribe = isIntegrationTest ? describe : describe.skip;

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

let mediaId: string | null = null;
let publicUrl: string | null = null;
let bucket: string;
let admin: ReturnType<typeof createAdminClient> | null = null;

function getStorageKeyFromPublicUrl(url: string, bucketName: string) {
  const marker = `/storage/v1/object/public/${bucketName}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

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
      `Failed to sign in test user: ${error?.message ?? "no session"}`,
    );
  }

  // Manually seed cookies for the mock
  cookieJar.set("sb-access-token", data.session.access_token);
  cookieJar.set("sb-refresh-token", data.session.refresh_token);
}

integrationDescribe("media upload (integration)", () => {
  beforeAll(async () => {
    validateTestEnv();
    bucket = privateEnv.storageBucket;
    await signInAndSeedCookies();

    // Use existing admin client from lib/supabase/admin
    admin = createAdminClient();
  });

  afterAll(async () => {
    if (!admin) return;

    if (publicUrl) {
      const key = getStorageKeyFromPublicUrl(publicUrl, bucket);
      if (key) {
        await admin.storage.from(bucket).remove([key]);
      }
    }

    if (mediaId) {
      await admin.from("media").delete().eq("id", mediaId);
    }
  });

  it("uploads, compresses, and stores media via /api/media/upload", async () => {
    const inputBuffer = await sharp({
      create: {
        width: 2400,
        height: 1800,
        channels: 3,
        background: { r: 120, g: 10, b: 90 },
      },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();

    const file = new File([new Uint8Array(inputBuffer)], "upload.png", {
      type: "image/png",
    });

    const formData = new FormData();
    formData.set("file", file);

    const request = new Request("http://localhost/api/media/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const json = await response.json();

    mediaId = json.mediaId;
    publicUrl = json.url;

    expect(json.mediaId).toBeTruthy();
    expect(json.url).toMatch(/^https?:\/\//);
    expect(json.width).toBeLessThanOrEqual(1600);
    expect(json.height).toBeLessThanOrEqual(1600);
    expect(json.sizeBytes).toBeLessThan(inputBuffer.length);

    const stored = await fetch(json.url);
    expect(stored.ok).toBe(true);

    const contentType = stored.headers.get("content-type") ?? "";
    const storedBuffer = Buffer.from(await stored.arrayBuffer());

    expect(contentType).toContain("image/webp");
    expect(storedBuffer.length).toBe(json.sizeBytes);
    expect(storedBuffer.length).toBeLessThan(inputBuffer.length);
  });
});
