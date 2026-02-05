import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import sharp from "sharp";

import { POST } from "@/app/api/media/upload/route";

dotenv.config({ path: ".env" });

const runIntegration = process.env.RUN_INTEGRATION === "1";
const integrationDescribe = runIntegration ? describe : describe.skip;

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET",
  "TEST_USER_EMAIL",
  "TEST_USER_PASSWORD",
] as const;

function requireEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

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
let admin: ReturnType<typeof createClient> | null = null;

function getStorageKeyFromPublicUrl(url: string, bucketName: string) {
  const marker = `/storage/v1/object/public/${bucketName}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

async function signInAndSeedCookies() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const email = process.env.TEST_USER_EMAIL!;
  const password = process.env.TEST_USER_PASSWORD!;

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await userClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw new Error(
      `Failed to sign in test user: ${error?.message ?? "no session"}`,
    );
  }

  const ssrClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => cookieStore.set(name, value));
      },
    },
  });

  await ssrClient.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}

integrationDescribe("media upload (integration)", () => {
  beforeAll(async () => {
    requireEnv();
    bucket = process.env.SUPABASE_STORAGE_BUCKET!;
    await signInAndSeedCookies();

    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
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
