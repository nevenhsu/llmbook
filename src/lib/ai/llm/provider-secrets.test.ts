import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClientMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function mockSupabaseQuery(result: QueryResult) {
  const inMock = vi.fn(async () => result);
  const selectMock = vi.fn(() => ({ in: inMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  createAdminClientMock.mockReturnValue({ from: fromMock });
  return { fromMock, selectMock, inMock };
}

describe("provider-secrets env fallback", () => {
  const originalXai = process.env.XAI_API_KEY;
  const originalMinimax = process.env.MINIMAX_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.XAI_API_KEY;
    delete process.env.MINIMAX_API_KEY;
  });

  afterEach(() => {
    if (originalXai === undefined) {
      delete process.env.XAI_API_KEY;
    } else {
      process.env.XAI_API_KEY = originalXai;
    }
    if (originalMinimax === undefined) {
      delete process.env.MINIMAX_API_KEY;
    } else {
      process.env.MINIMAX_API_KEY = originalMinimax;
    }
  });

  it("lists provider status from env when db has no row", async () => {
    process.env.MINIMAX_API_KEY = "env-minimax-1234";
    mockSupabaseQuery({ data: [], error: null });

    const { listProviderSecretStatuses } = await import("@/lib/ai/llm/provider-secrets");
    const map = await listProviderSecretStatuses(["minimax"]);

    expect(map.get("minimax")).toEqual({
      hasKey: true,
      keyLast4: "1234",
      updatedAt: "1970-01-01T00:00:00.000Z",
    });
  });

  it("loads decrypted secrets from env when secrets table is missing", async () => {
    process.env.XAI_API_KEY = "env-xai-9999";
    mockSupabaseQuery({
      data: null,
      error: {
        message: "Could not find the table 'public.ai_provider_secrets' in the schema cache",
      },
    });

    const { loadDecryptedProviderSecrets } = await import("@/lib/ai/llm/provider-secrets");
    const map = await loadDecryptedProviderSecrets(["xai"]);

    expect(map.get("xai")).toEqual({
      providerKey: "xai",
      apiKey: "env-xai-9999",
      keyLast4: "9999",
      updatedAt: "1970-01-01T00:00:00.000Z",
    });
  });

  it("prefers db key status over env fallback when db row exists", async () => {
    process.env.XAI_API_KEY = "env-xai-9999";
    mockSupabaseQuery({
      data: [{ provider_key: "xai", key_last4: "db44", updated_at: "2026-03-03T00:00:00.000Z" }],
      error: null,
    });

    const { listProviderSecretStatuses } = await import("@/lib/ai/llm/provider-secrets");
    const map = await listProviderSecretStatuses(["xai"]);

    expect(map.get("xai")).toEqual({
      hasKey: true,
      keyLast4: "db44",
      updatedAt: "2026-03-03T00:00:00.000Z",
    });
  });

  it("falls back to env secret when db decrypt fails", async () => {
    process.env.MINIMAX_API_KEY = "env-minimax-abcd";
    mockSupabaseQuery({
      data: [
        {
          provider_key: "minimax",
          encrypted_api_key: "invalid-base64",
          iv: "invalid-base64",
          auth_tag: "invalid-base64",
          key_last4: null,
          updated_at: "2026-03-03T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const { loadDecryptedProviderSecrets } = await import("@/lib/ai/llm/provider-secrets");
    const map = await loadDecryptedProviderSecrets(["minimax"]);

    expect(map.get("minimax")).toEqual({
      providerKey: "minimax",
      apiKey: "env-minimax-abcd",
      keyLast4: "abcd",
      updatedAt: "1970-01-01T00:00:00.000Z",
    });
  });
});
