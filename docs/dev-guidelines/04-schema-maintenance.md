Schema Maintenance Guidelines

Purpose: Define the policy to keep the schema.sql as the single source of truth and how to manage migrations.

Scope: All schema changes affecting public or app state; migrations live under supabase/migrations.

Guidelines:

- Always keep the canonical current schema in: schema.sql at the repo root (or specified path).
- Required pairing rule: if you add or modify a file in `supabase/migrations/`, you must update `supabase/schema.sql` in the same change.
- Do not rely on inline migration data to reflect the latest schema state; migrations should be the historical steps.
- When schema changes, add a corresponding migration under migrations/ with a clear, timestamped filename.
- Run migrations in staging first, verify outcomes, then apply to production as part of release.
- Keep a short migration note in the migration file header describing intent.

Checklist:

- [ ] schema.sql updated
- [ ] Migration file created and named with date prefix
- [ ] Tests or checks confirm the schema state (e.g., via information_schema queries)

Last Updated: 2026-02-19
