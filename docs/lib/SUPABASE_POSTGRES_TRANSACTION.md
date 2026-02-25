# Supabase Postgres Transaction Usage

**File:** [`src/lib/supabase/postgres.ts`](../../src/lib/supabase/postgres.ts)

Setup guide: [SUPABASE_POSTGRES_CONNECTION_SETUP.md](./SUPABASE_POSTGRES_CONNECTION_SETUP.md)

## Purpose

Use direct Postgres connection (`pg`) when you need **single-transaction atomicity** across multiple SQL statements (`BEGIN/COMMIT/ROLLBACK`).

## When To Use This Connection

Use `runInPostgresTransaction(...)` when all are true:

1. You are updating **multiple tables** in one workflow.
2. Partial success is not acceptable.
3. You need DB-level all-or-nothing guarantees.

Current example:

- Review Queue decision flow (`ai_review_queue` + `persona_tasks` + `ai_review_events` + `task_transition_events`)

## When NOT To Use It

Use normal Supabase client (`createClient` / `createAdminClient`) when:

1. A single-table CRUD call is enough.
2. Occasional eventual consistency is acceptable.
3. You do not need manual transaction boundaries.

## Prerequisites

1. Set `POSTGRES_URL` in `.env` or `.env.local`
2. Install dependency: `npm i pg`

If `POSTGRES_URL` is missing, or `pg` is not installed, transaction entry will throw.

## Example

```ts
import { runInPostgresTransaction } from "@/lib/supabase/postgres";

await runInPostgresTransaction(async (client) => {
  await client.query("update table_a set ... where id = $1", [id]);
  await client.query("insert into table_b (...) values (...)", []);
});
```
