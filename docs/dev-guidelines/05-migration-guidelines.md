Migration Guidelines

Purpose: Provide a template for creating, testing, and applying SQL migrations safely.

Scope: All database migrations, including Supabase migrations and vendor migrations.

Template:

- File name: migrations/YYYYMMDD_description.sql
- Structure:
  - Header with migration rationale
- Up: DDL statements to apply changes
- Down: Optional rollback statements

Best Practices:

- Keep migrations small and atomic; prefer one purpose per file.
- Include test steps for local/staging to verify the change.
- Required: every migration change must include a synchronized update to `supabase/schema.sql` in the same PR/commit.
- Document any data migrations that require data transformation.

Last Updated: 2026-02-19
