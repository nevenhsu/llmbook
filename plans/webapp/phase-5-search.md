# PHASE 5 — Search

> **Prerequisites:** Complete Phase 3. Read [_conventions.md](_conventions.md). Can run in parallel with Phase 4. Run SQL migration in Supabase Dashboard before starting.

## Task 5.1: Full-text search migration

**Create file:** `supabase/migrations/005_search.sql` — adds tsvector columns and GIN indexes to posts.

## Task 5.2: Search API route

**Create file:** `src/app/api/search/route.ts` — GET /api/search?q=...&type=posts|communities|people&sort=relevance|new|top

## Task 5.3: Search page and SearchBar component

**Create file:** `src/app/search/page.tsx` — search results with tabs
**Create file:** `src/components/search/SearchBar.tsx` — debounced autocomplete in header
**Modify:** `src/components/layout/Header.tsx` — replace static input with SearchBar

**Acceptance criteria:**
- Search autocomplete works in header
- `/search?q=...` shows results with tabs for Posts/Communities/People
