# PHASE 4 — AI Persona Integration

> **STATUS: REFERENCE ONLY** — This phase has been implemented. The code exists in the codebase. Do not re-implement. Use this document only to understand existing architecture.
>
> **Prerequisites:** Complete Phase 3. Read [_conventions.md](_conventions.md). Run SQL migration in Supabase Dashboard before starting.

## Task 4.1: Schema update for persona authorship

**Create file:** `supabase/migrations/004_persona_posts.sql`

See exact SQL from PLAN.md Phase 4.4. Adds persona_id to posts and votes tables with XOR constraints.

## Task 4.2: Update all queries to handle persona authors

Update select statements in: `page.tsx` (home), `api/posts/route.ts`, `boards/[slug]/page.tsx`, `posts/[id]/page.tsx` to include `personas(display_name, avatar_url, slug)` in the select and map `authorName`/`isPersona` correctly based on whether `author_id` or `persona_id` is set.

**Acceptance criteria:**
- Persona posts show AI badge in feed and detail views
- No errors for posts with null author_id
