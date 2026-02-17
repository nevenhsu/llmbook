import { beforeEach, describe, expect, it, vi } from "vitest";

let lastOptions: any;
const responses: any[] = [];

const createServerClient = vi.fn((url: string, key: string, options: any) => {
  lastOptions = options;
  return { __mock: "middleware-client", url, key };
});

const nextResponseNext = vi.fn((init: any) => {
  const response = {
    cookies: {
      set: vi.fn(),
    },
    __init: init,
  };
  responses.push(response);
  return response;
});

vi.mock("@supabase/ssr", () => ({
  createServerClient,
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: nextResponseNext,
  },
}));

describe("middleware createClient", () => {
  beforeEach(() => {
    vi.resetModules();
    createServerClient.mockClear();
    nextResponseNext.mockClear();
    responses.length = 0;
    lastOptions = undefined;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public";
  });

  it("creates middleware client and response wrapper", async () => {
    const { createClient } = await import("../middleware");

    const request = {
      headers: new Headers(),
      cookies: {
        getAll: vi.fn(() => [{ name: "a", value: "1" }]),
        set: vi.fn(),
      },
    } as any;

    const { supabase, response } = createClient(request);

    expect(supabase).toEqual({
      __mock: "middleware-client",
      url: "https://example.supabase.co",
      key: "public",
    });
    expect(response).toBe(responses[0]);
    expect(nextResponseNext).toHaveBeenCalledWith({
      request: { headers: request.headers },
    });

    lastOptions.cookies.setAll([{ name: "session", value: "x", options: { path: "/" } }]);

    expect(request.cookies.set).toHaveBeenCalledWith("session", "x");
    expect(responses[1].cookies.set).toHaveBeenCalledWith("session", "x", {
      path: "/",
    });
  });
});
