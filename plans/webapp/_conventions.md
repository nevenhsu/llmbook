# Web App — Conventions & Context

> **For Codex / AI agents.** Read this file before starting any webapp phase. Each phase file is self-contained with exact file paths, interfaces, SQL, component specs, and acceptance criteria. Execute tasks in order within each phase. Phases must be completed sequentially unless noted otherwise.

## Project Context

| Key              | Value                                    |
| ---------------- | ---------------------------------------- |
| Framework        | Next.js 16.1.6, React 19, TypeScript 5.9 |
| Styling          | Tailwind CSS 4.1.18 + **DaisyUI 5**      |
| Database         | Supabase (PostgreSQL + Auth + Storage)   |
| Editor           | TipTap 3.19                              |
| Image processing | Sharp 0.34                               |
| Test framework   | Vitest 2.1                               |
| Package manager  | npm                                      |

### Codebase Conventions (MUST follow)

```
Server components: use `cookies()` from `next/headers`, call `createClient(cookies())` from `@/lib/supabase/server`
Client components: start with "use client", call `createClient()` from `@/lib/supabase/client`
Admin/service operations: call `createAdminClient()` from `@/lib/supabase/admin`
API routes: use NextResponse, export `runtime = 'nodejs'` when using sharp
Supabase queries: use `.select()` with explicit column lists, `.eq()` for filters
DaisyUI: Use semantic classes (bg-base-100, text-base-content, btn-primary) for standard components.
Color palette: bg-base-200 (=#030303), surface-base-100 (=#1A1A1B), highlight-base-300 (=#272729), text-base-content (=#D7DADC)
Accent: upvote=primary (#FF4500), downvote=secondary (#7193FF), link=accent (#4FBCFF)
Immutability: NEVER mutate objects, always spread to create new
Files: max 800 lines, prefer many small files
Functions: max 50 lines
HTML rendering: ALWAYS sanitize with DOMPurify before using dangerouslySetInnerHTML. Install: npm install dompurify @types/dompurify
```

## UI Kit Decision: DaisyUI 5

| Layer             | Choice           | Why                                                          |
| ----------------- | ---------------- | ------------------------------------------------------------ |
| Component library | **DaisyUI 5**    | Tailwind CSS plugin — semantic class names, zero JS runtime. |
| Custom components | **Tailwind CSS** | Reddit-specific components (PostRow, etc.) use raw Tailwind. |

### Color Mapping

| Webapp Token             | DaisyUI Variable       | DaisyUI Class       |
| ------------------------ | ---------------------- | ------------------- |
| `canvas` (#030303)       | `--color-base-200`     | `bg-base-200`       |
| `surface` (#1A1A1B)      | `--color-base-100`     | `bg-base-100`       |
| `highlight` (#272729)    | `--color-base-300`     | `bg-base-300`       |
| `text-primary` (#D7DADC) | `--color-base-content` | `text-base-content` |
| `upvote` (#FF4500)       | `--color-primary`      | `bg-primary`        |
| `downvote` (#7193FF)     | `--color-secondary`    | `bg-secondary`      |
| `accent-link` (#4FBCFF)  | `--color-accent`       | `text-accent`       |

### Existing Files Reference

```
src/lib/supabase/server.ts   — createClient(cookieStore) → server Supabase client
src/lib/supabase/client.ts   — createClient() → browser Supabase client
src/lib/supabase/admin.ts    — createAdminClient() → service role client
src/app/layout.tsx            — root layout, fetches user, renders Header + LeftSidebar + main
src/app/page.tsx              — home feed (server component)
src/app/posts/[id]/page.tsx   — post detail (server component, currently uses light theme — NEEDS REWRITE)
src/app/boards/[slug]/page.tsx— board feed (server component, currently uses light theme — NEEDS REWRITE)
src/app/submit/page.tsx       — create post page
src/app/profile/page.tsx      — user profile
src/app/api/posts/route.ts    — GET (list) + POST (create) posts
src/app/api/media/upload/route.ts — POST image upload
src/components/layout/Header.tsx      — fixed top nav
src/components/layout/LeftSidebar.tsx  — left nav (hardcoded boards)
src/components/layout/RightSidebar.tsx — right sidebar (mock data)
src/components/layout/UserMenu.tsx     — user dropdown (client component)
src/components/create-post/CreatePostForm.tsx — post creation form
src/components/create-post/RichTextEditor.tsx — TipTap editor
supabase/schema.sql — current DB schema
```

### Phase Index

| Phase | File                                                 | Focus                            |
| ----- | ---------------------------------------------------- | -------------------------------- |
| 1     | [phase-1-design-system.md](phase-1-design-system.md) | Design System + Compact Feed     |
| 2     | [phase-2-voting.md](phase-2-voting.md)               | Voting System + Feed Sorting     |
| 3     | [phase-3-comments.md](phase-3-comments.md)           | Threaded Comments                |
| 4     | [phase-4-persona.md](phase-4-persona.md)             | AI Persona Integration           |
| 5     | [phase-5-search.md](phase-5-search.md)               | Search                           |
| 6     | [phase-6-profile.md](phase-6-profile.md)             | Profile + Karma + Save/Hide      |
| 7     | [phase-7-boards.md](phase-7-boards.md)               | Board Pages + Notifications      |
| 8     | [phase-8-scheduler.md](phase-8-scheduler.md)         | Persona Scheduler (web app side) |

### Summary: All Files Created/Modified by Phase

| Phase | New Files                                                                                                                                                                                                                        | Modified Files                                                                                                                      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `ui/Avatar.tsx`, `ui/Badge.tsx`, `ui/Timestamp.tsx`, `ui/Skeleton.tsx`, `ui/VotePill.tsx`, `post/PostRow.tsx`, `post/PostMeta.tsx`, `post/PostActions.tsx`, `feed/FeedSortBar.tsx`, `feed/FeedContainer.tsx`                     | `tailwind.config.ts`, `globals.css`, `layout.tsx`, `page.tsx`, `Header.tsx`, `LeftSidebar.tsx`, `RightSidebar.tsx`, `UserMenu.tsx`  |
| 2     | `migrations/002_votes_and_scores.sql`, `api/votes/route.ts`, `lib/ranking.ts`                                                                                                                                                    | `page.tsx`, `api/posts/route.ts`, `FeedContainer.tsx`, `FeedSortBar.tsx`                                                            |
| 3     | `migrations/003_comments.sql`, `api/posts/[id]/comments/route.ts`, `api/comments/[id]/route.ts`, `comment/CommentThread.tsx`, `comment/CommentItem.tsx`, `comment/CommentForm.tsx`, `comment/CommentSort.tsx`, `ui/SafeHtml.tsx` | `posts/[id]/page.tsx`                                                                                                               |
| 4     | `migrations/004_persona_posts.sql`                                                                                                                                                                                               | `page.tsx`, `api/posts/route.ts`, `boards/[slug]/page.tsx`, `posts/[id]/page.tsx`, `PostRow.tsx`, `PostMeta.tsx`, `CommentItem.tsx` |
| 5     | `migrations/005_search.sql`, `api/search/route.ts`, `search/page.tsx`, `search/SearchBar.tsx`                                                                                                                                    | `Header.tsx`                                                                                                                        |
| 6     | `migrations/006_profile_features.sql`, `api/saved/[postId]/route.ts`, `api/hidden/[postId]/route.ts`, `api/boards/[slug]/join/route.ts`                                                                                          | `page.tsx`, `api/posts/route.ts`, `profile/page.tsx`, `LeftSidebar.tsx`                                                             |
| 7     | `api/notifications/route.ts`, `notification/NotificationBell.tsx`, `lib/notifications.ts`                                                                                                                                        | `boards/[slug]/page.tsx`, `Header.tsx`, `api/posts/[id]/comments/route.ts`, `api/votes/route.ts`                                    |
| 8     | `migrations/007_persona_tasks.sql`                                                                                                                                                                                               | —                                                                                                                                   |
