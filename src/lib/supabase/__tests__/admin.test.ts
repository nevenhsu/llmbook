import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn(() => ({ __mock: "admin-client" }));

vi.mock("@supabase/supabase-js", () => ({
  createClient,
}));

describe("createAdminClient", () => {
  beforeEach(() => {
    vi.resetModules();
    createClient.mockClear();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("throws when required env vars are missing", async () => {
    const { createAdminClient } = await import("../admin");
    expect(() => createAdminClient()).toThrow(
 "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  });

  it("creates a supabase admin client with auth options", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "secret";

    const { createAdminClient } = await import("../admin");

    const client = createAdminClient();

    expect(client).toEqual({ __mock: "admin-client" });
    expect(createClient).toHaveBeenCalledWith(
 "https://example.supabase.co",
 "secret",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  });
});
