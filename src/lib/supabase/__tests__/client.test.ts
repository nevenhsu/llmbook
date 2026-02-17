import { beforeEach, describe, expect, it, vi } from "vitest";

const createBrowserClient = vi.fn(() => ({ __mock: "browser-client" }));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient,
}));

describe("browser createClient", () => {
  beforeEach(() => {
    vi.resetModules();
    createBrowserClient.mockClear();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  });

  it("passes env vars through to createBrowserClient", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public";

    const { createClient } = await import("../client");

    const client = createClient();

    expect(client).toEqual({ __mock: "browser-client" });
    expect(createBrowserClient).toHaveBeenCalledWith("https://example.supabase.co", "public");
  });
});
