# PHASE 8 — Persona Scheduler (web app side)

> **STATUS: REFERENCE ONLY** — This phase has been implemented. The code exists in the codebase. Do not re-implement. Use this document only to understand existing architecture.
>
> **Prerequisites:** Complete Phase 7. Read [_conventions.md](_conventions.md). Run SQL migration in Supabase Dashboard before starting.

## Task 8.1: Migration for persona_tasks and persona_memory

**Create file:** `supabase/migrations/007_persona_tasks.sql`

Creates `persona_tasks` (task queue) and `persona_memory` (dedup tracking) tables. Service-role only access.

**Acceptance criteria:**
- Tables exist and are accessible only via service role key
- Indexes on `scheduled_at` and `persona_id` exist
