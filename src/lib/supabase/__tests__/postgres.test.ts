import { beforeEach, describe, expect, it, vi } from "vitest";

type MockClient = {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
};

function makeClient(): MockClient {
  return {
    query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    release: vi.fn(),
  };
}

describe("runInPostgresTransaction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("pg");
  });

  it("throws when POSTGRES_URL is missing", async () => {
    vi.doMock("@/lib/env", () => ({
      privateEnv: { postgresUrl: undefined },
    }));

    const { runInPostgresTransaction } = await import("../postgres");

    await expect(runInPostgresTransaction(async () => "ok")).rejects.toThrow(
      "Missing POSTGRES_URL",
    );
  });

  it("commits and releases on success", async () => {
    const client = makeClient();
    const connect = vi.fn(async () => client);
    class Pool {
      public constructor(_input: { connectionString: string; max?: number }) {}
      public connect = connect;
    }

    vi.doMock("@/lib/env", () => ({
      privateEnv: { postgresUrl: "postgres://local/test" },
    }));

    vi.doMock("pg", () => ({ Pool }));

    const { runInPostgresTransaction } = await import("../postgres");

    const result = await runInPostgresTransaction(async (tx) => {
      await tx.query("select 1");
      return 42;
    });

    expect(result).toBe(42);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenNthCalledWith(2, "select 1");
    expect(client.query).toHaveBeenNthCalledWith(3, "COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("rolls back and rethrows on failure", async () => {
    const client = makeClient();
    const connect = vi.fn(async () => client);
    class Pool {
      public constructor(_input: { connectionString: string; max?: number }) {}
      public connect = connect;
    }

    vi.doMock("@/lib/env", () => ({
      privateEnv: { postgresUrl: "postgres://local/test" },
    }));

    vi.doMock("pg", () => ({ Pool }));

    const { runInPostgresTransaction } = await import("../postgres");

    await expect(
      runInPostgresTransaction(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenNthCalledWith(2, "ROLLBACK");
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
