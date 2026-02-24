import { privateEnv } from "@/lib/env";

type QueryResult<T = Record<string, unknown>> = {
  rows: T[];
  rowCount: number;
};

export type PgTxClient = {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
  release: () => void;
};

type PgPool = {
  connect: () => Promise<PgTxClient>;
};

let poolPromise: Promise<PgPool> | null = null;

function resolvePostgresUrl(): string | null {
  return privateEnv.postgresUrl ?? null;
}

async function createPool(): Promise<PgPool> {
  const postgresUrl = resolvePostgresUrl();
  if (!postgresUrl) {
    throw new Error("Missing POSTGRES_URL");
  }

  let PoolCtor: new (input: { connectionString: string; max?: number }) => PgPool;
  try {
    const moduleName = "pg";
    const pg = (await import(moduleName)) as {
      Pool: new (input: { connectionString: string; max?: number }) => PgPool;
    };
    PoolCtor = pg.Pool;
  } catch {
    throw new Error("POSTGRES_URL is set but package 'pg' is not installed. Run: npm i pg");
  }

  return new PoolCtor({
    connectionString: postgresUrl,
    max: 5,
  });
}

async function getPool(): Promise<PgPool> {
  if (!poolPromise) {
    poolPromise = createPool();
  }
  return poolPromise;
}

export async function runInPostgresTransaction<T>(
  work: (client: PgTxClient) => Promise<T>,
): Promise<T> {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
