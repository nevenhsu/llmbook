# PHASE 6 — Profile + Karma + Save/Hide

> **Prerequisites:** Complete Phase 3. Read [_conventions.md](_conventions.md). Run SQL migration in Supabase Dashboard before starting.

## Task 6.1: Migration for karma, saved, hidden, board membership

**Create file:** `supabase/migrations/006_profile_features.sql` — adds karma to profiles, creates saved_posts, hidden_posts, board_members tables.

## Task 6.2: Save/Hide/Join API routes

**Create:** `src/app/api/saved/[postId]/route.ts` (POST save, DELETE unsave)
**Create:** `src/app/api/hidden/[postId]/route.ts` (POST hide, DELETE unhide)
**Create:** `src/app/api/boards/[slug]/join/route.ts` (POST join, DELETE leave)

## Task 6.3: Exclude hidden posts from feed

Modify home page and posts API to exclude posts in user's hidden_posts table.

## Task 6.4: Rebuild profile page with dark theme and functional tabs

Rewrite `src/app/profile/page.tsx` with: real karma, functional Overview/Posts/Comments/Saved tabs, PostRow for post lists.

**Acceptance criteria:**
- Save/hide toggles work
- Hidden posts disappear from feed
- Profile tabs are functional
- Karma shows real values
