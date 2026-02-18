# Refactor Audit — Code Quality & Reuse

Code review findings: duplications, inconsistencies, and refactor opportunities.
Each item is numbered and tagged with a status for tracking discussion progress.

---

## Status Legend

| Tag | Meaning |
|-----|---------|
| `[ ]` | Not yet discussed |
| `[>]` | In discussion |
| `[✓]` | Approved — implement |
| `[x]` | Rejected / not needed |

---

## 🔴 High Priority (Bugs / Significant Duplication)

### R-01 `use-vote-mutation.ts` — Delete (has bug)
**Status:** `[✓]`

`src/hooks/use-vote-mutation.ts:111` passes `state.score.toString()` as `postId`:
```ts
const data = await votePost(state.score.toString(), value); // BUG: should be postId
```

A complete, correct implementation already exists in `src/hooks/useVote.ts` with:
- Optimistic update + rollback
- Sequence number to prevent race conditions
- `isVoting` ref to prevent double-submit

**Proposal:** Delete `use-vote-mutation.ts` entirely, ensure all usages point to `useVote.ts`.

**Implemented:**
- Deleted `src/hooks/use-vote-mutation.ts`

---

### R-02 Save/Hide Logic Duplicated in Two Components
**Status:** `[✓]`

`handleSave`, `handleHide`, `handleUnhide` are copy-pasted between:
- `src/components/post/PostRow.tsx:86-133`
- `src/components/post/PostActionsWrapper.tsx:35-82`

Both fetch the same endpoints, apply the same toast, and manage the same state. Any bug fix must be applied twice.

**Proposal:** Extract `src/hooks/use-post-interactions.ts`:
```ts
export function usePostInteractions(postId: string, initialSaved: boolean, initialHidden: boolean) {
  const [saved, setSaved] = useState(initialSaved);
  const [hidden, setHidden] = useState(initialHidden);

  const handleSave = async () => { ... };
  const handleHide = async () => { ... };
  const handleUnhide = async () => { ... };

  return { saved, hidden, handleSave, handleHide, handleUnhide };
}
```

**Implemented:**
- Added `src/hooks/use-post-interactions.ts`
- Updated:
  - `src/components/post/PostRow.tsx`
  - `src/components/post/PostActionsWrapper.tsx`

---

### R-03 API Routes — Auth Boilerplate Not Using `withAuth`
**Status:** `[✓]`

The following pattern appears in 10+ route handlers manually instead of using the existing `withAuth` wrapper:
```ts
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return new NextResponse("Unauthorized", { status: 401 });
```

Routes that are **not** using `withAuth`:
- `src/app/api/boards/[slug]/route.ts` (PATCH, DELETE)
- `src/app/api/boards/[slug]/moderators/route.ts`
- `src/app/api/boards/[slug]/moderators/[userId]/route.ts`
- `src/app/api/boards/[slug]/bans/route.ts`
- `src/app/api/boards/[slug]/bans/[userId]/route.ts`
- `src/app/api/posts/[id]/route.ts` (PATCH, DELETE)
- `src/app/api/profile/route.ts`

Routes already using `withAuth` correctly (reference):
- `src/app/api/comments/[id]/route.ts`
- `src/app/api/votes/route.ts`

**Proposal:** Migrate all above routes to `withAuth`.

**Implemented:**
- Migrated the listed remaining routes to `withAuth`:
  - `src/app/api/posts/[id]/route.ts` (PATCH, DELETE)
  - `src/app/api/profile/route.ts`
- Also migrated additional auth-gated routes discovered during follow-up cleanup:
  - `src/app/api/posts/route.ts` (POST)
  - `src/app/api/polls/[postId]/vote/route.ts` (POST)
  - `src/app/api/tags/route.ts` (POST)
  - `src/app/api/media/upload/route.ts`
  - `src/app/api/saved/[postId]/route.ts`
  - `src/app/api/hidden/[postId]/route.ts`
  - `src/app/api/users/[userId]/follow/route.ts`

---

### R-04 API Error Response Format — 3 Inconsistent Styles
**Status:** `[✓]`

Three different formats are used across routes:

```ts
// Style A — text/plain (will cause JSON.parse errors on client)
return new NextResponse("Unauthorized", { status: 401 });

// Style B — via route-helpers (correct)
return http.unauthorized();

// Style C — manual JSON
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

Style A is problematic: `new NextResponse("text")` sets `Content-Type: text/plain`, which breaks any client that calls `.json()` on the response.

**Proposal:** Standardise on Style B (`http.*` helpers from `src/lib/server/route-helpers.ts`) across all routes.

**Implemented:**
- Removed remaining manual `NextResponse.json({ error: ... })` (Style C) in favor of `http.*` helpers (Style B):
  - `src/app/api/auth/login/route.ts`
  - `src/app/api/auth/register/route.ts`
  - `src/app/api/boards/check-availability/route.ts`
  - `src/app/api/boards/search/route.ts`

---

### R-05 Board Slug → ID Lookup Duplicated in 8+ Routes
**Status:** `[✓]`

This exact pattern appears in at least 8 route files:
```ts
const { data: board } = await supabase
  .from("boards").select("id").eq("slug", slug).single();
if (!board) return new NextResponse("Board not found", { status: 404 });
```

Files affected:
- `boards/[slug]/route.ts` (PATCH line 25, DELETE line 135)
- `boards/[slug]/bans/route.ts` (GET line 28, POST line 98)
- `boards/[slug]/bans/[userId]/route.ts` (line 28)
- `boards/[slug]/members/route.ts` (line 25)
- `boards/[slug]/moderators/route.ts` (lines 14, 65)
- `boards/[slug]/moderators/[userId]/route.ts` (lines 70, 160)
- `boards/[slug]/join/route.ts` (POST line 14, DELETE line 53)

**Proposal:** Extract utility in `src/lib/boards/`:
```ts
export async function getBoardIdBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<{ boardId: string } | { error: "not_found" } | { error: "query_failed" }>
```

**Implemented:**
- Added `src/lib/boards/get-board-id-by-slug.ts`
- Updated usages in:
  - `src/app/api/boards/[slug]/route.ts`
  - `src/app/api/boards/[slug]/bans/route.ts`
  - `src/app/api/boards/[slug]/bans/[userId]/route.ts`
  - `src/app/api/boards/[slug]/members/route.ts`
  - `src/app/api/boards/[slug]/members/[userId]/route.ts`
  - `src/app/api/boards/[slug]/moderators/route.ts`
  - `src/app/api/boards/[slug]/moderators/[userId]/route.ts`
  - `src/app/api/boards/[slug]/join/route.ts`

---

## 🟡 Medium Priority (Shared Logic / Type Inconsistency)

### R-06 `ModeratorPermissions` Type Defined in 3 Places
**Status:** `[✓]`

The same type is independently declared in:
- `src/components/board/BoardSettingsForm.tsx:29-39`
- `src/app/api/boards/[slug]/moderators/[userId]/route.ts:7-17`
- `src/app/api/boards/[slug]/moderators/route.ts:83-88` (inline)

**Proposal:** Centralise in `src/types/board.ts` or `src/lib/boards/permissions.ts`, import everywhere.

**Implemented:**
- Added `src/types/board.ts` exporting `ModeratorPermissions` and `DEFAULT_MODERATOR_PERMISSIONS`
- Updated:
  - `src/components/board/BoardSettingsForm.tsx`
  - `src/app/api/boards/[slug]/moderators/route.ts`
  - `src/app/api/boards/[slug]/moderators/[userId]/route.ts`

---

### R-07 Infinite Scroll Logic Duplicated
**Status:** `[✓]`

`IntersectionObserver` setup is copy-pasted between:
- `src/components/feed/FeedContainer.tsx:52-68`
- `src/components/profile/ProfilePostList.tsx:228-263`

**Proposal:** Extract `src/hooks/use-infinite-scroll.ts`:
```ts
export function useInfiniteScroll(
  loadMore: () => Promise<void>,
  hasMore: boolean,
  isLoading: boolean,
): RefObject<HTMLDivElement>
```

**Implemented:**
- `src/hooks/use-infinite-scroll.ts`
- `src/components/feed/FeedContainer.tsx`
- `src/components/profile/ProfilePostList.tsx`

---

### R-08 Rules Editor Logic Duplicated
**Status:** `[✓]`

`addRule`, `updateRule`, `removeRule` functions are identical in:
- `src/components/board/CreateBoardForm.tsx:104-118`
- `src/components/board/BoardSettingsForm.tsx:394-408`

**Proposal:** Extract `src/hooks/use-rules-editor.ts`:
```ts
export function useRulesEditor(initialRules: Rule[] = []) {
  const [rules, setRules] = useState(initialRules);
  const addRule = () => { ... };
  const updateRule = (index, field, value) => { ... };
  const removeRule = (index) => { ... };
  return { rules, addRule, updateRule, removeRule };
}
```

**Implemented:**
- Added `src/hooks/use-rules-editor.ts`
- Updated:
  - `src/components/board/CreateBoardForm.tsx`
  - `src/components/board/BoardSettingsForm.tsx`

---

### R-09 `board-permissions.ts` Creates New Supabase Client Per Call
**Status:** `[✓]`

Every function in `src/lib/board-permissions.ts` calls `createServerClient(cookies())` internally. When route handlers already have a client, calling these functions opens an additional unnecessary connection.

Compare: `isAdmin(user.id, supabase)` already accepts a client, but `isBoardModerator` and `canManageBoard` do not.

**Proposal:** Add optional `supabase?` parameter to all functions in `board-permissions.ts`:
```ts
export async function isBoardModerator(
  boardId: string,
  userId: string,
  supabase?: SupabaseClient,
): Promise<boolean>
```

**Implemented:**
- Updated `src/lib/board-permissions.ts` to accept optional `supabase` and reuse it internally
- Updated common call sites that already have a Supabase client (routes/pages) to pass it

---

### R-10 `canModerate` Check in `r/[slug]/page.tsx` Bypasses Library
**Status:** `[✓]`

`src/app/r/[slug]/page.tsx:38-54` manually queries `board_moderators` with raw SQL instead of using `isBoardModerator()` from `src/lib/board-permissions.ts`.

**Proposal:** Replace inline raw query with the library function.

**Implemented:**
- Updated `src/app/r/[slug]/page.tsx` to use `isBoardModerator()`

---

### R-11 `BoardSettingsForm.tsx` — Inconsistent Modal Usage
**Status:** `[✓]`

Three different dialog patterns in the same file:
- Archive confirmation → raw `<dialog>` element (line 700)
- Remove moderator → `<ConfirmModal>` component (line 828)
- Add moderator → another raw `<dialog>` element (line 728)

**Proposal:** Standardise on `<ConfirmModal>` for all confirmation dialogs.

**Implemented:**
- Switched board archive confirmation to shared `<ConfirmModal>` and improved `<ConfirmModal>` to be a generic confirmation dialog (optional text confirmation) instead of delete-specific copy.

---

## 🟢 Low Priority (Polish / Consistency)

### R-12 Search Page — Three Identical List Structures
**Status:** `[✓]`

`src/app/search/page.tsx:102-177` repeats the same list structure for boards, users, and personas tabs (Avatar + name + subtitle + empty state).

**Proposal:** Extract `src/components/search/SearchResultList.tsx` with `items`, `renderItem`, `emptyMessage` props.

**Implemented:**
- Added `src/components/search/SearchResultList.tsx`
- Updated `src/app/search/page.tsx` to reuse it for boards/users/personas tabs

---

### R-13 `CommentItem.tsx` — Manual Dropdown Instead of `ResponsiveMenu`
**Status:** `[✓]`

`src/components/comment/CommentItem.tsx:215-280` manually implements a dropdown with `showMoreMenu` state and click-outside overlay. `PostActions.tsx` already uses the shared `<ResponsiveMenu>` component.

**Proposal:** Replace the manual dropdown in `CommentItem` with `<ResponsiveMenu>`.

**Implemented:**
- Updated `src/components/comment/CommentItem.tsx` to use `src/components/ui/ResponsiveMenu.tsx`

---

### R-14 Hook File Naming Inconsistent
**Status:** `[✓]`

Two naming conventions in `src/hooks/`:
- camelCase: `useVote.ts`, `useTheme.ts`
- kebab-case: `use-vote-mutation.ts`, `use-window-size.ts`, `use-scrolling.ts`

**Proposal:** Standardise all hooks to kebab-case (align with the majority of existing hook files). Note: R-01 (deleting `use-vote-mutation.ts`) already removes one offender.

**Implemented:**
- Renamed:
  - `src/hooks/useVote.ts` → `src/hooks/use-vote.ts`
  - `src/hooks/useTheme.ts` → `src/hooks/use-theme.ts`
- Updated imports:
  - `src/components/comment/CommentItem.tsx`
  - `src/components/post/PostRow.tsx`
  - `src/components/profile/ProfilePostList.tsx`
  - `src/components/post/PostDetailVote.tsx`
  - `src/components/ui/ThemeToggle.tsx`
  - `src/components/layout/UserMenu.tsx`

---

### R-15 `any` Type Overuse
**Status:** `[>]`

Key locations using `any`:
| File | Line | Field |
|------|------|-------|
| `components/comment/CommentItem.tsx` | 16 | `comment: any` |
| `components/profile/ProfilePostList.tsx` | 43 | `posts: any[]` |
| `components/feed/FeedContainer.tsx` | 17 | `initialPosts: any[]` |
| `components/board/BoardSettingsForm.tsx` | 49 | `board: any` |
| `lib/query-builder.ts` | multiple | various |

**Proposal:** Replace with proper TypeScript types. Start with the most-used components (FeedContainer, PostList).

**Implemented (partial):**
- Introduced stronger shared types in `src/lib/posts/query-builder.ts`:
  - `VoteValue`
  - `FormattedComment.isDeleted`
  - `RawPost.updated_at` (remove `(post as any).updated_at`)
- Removed `any` from key UI surfaces:
  - `src/components/feed/FeedContainer.tsx` (`initialPosts: FeedPost[]`)
  - `src/components/comment/CommentItem.tsx` (`comment: FormattedComment`)
  - `src/components/comment/CommentThread.tsx`
  - `src/components/profile/ProfilePostList.tsx` (posts/comments/saved typing)
  - `src/components/feed/FeedSortBar.tsx` (Lucide icon type)
  - `src/app/search/page.tsx` (typed search result unions)
  - `src/components/search/SearchBar.tsx`, `src/components/search/MobileSearchOverlay.tsx` (typed quick results)
  - `src/components/notification/NotificationBell.tsx` (typed notification rows)
- Reduced route-level `any` in comment/vote related endpoints:
  - `src/app/api/profile/comments/route.ts`
  - `src/app/api/posts/[id]/comments/route.ts`
  - `src/app/api/profile/saved/route.ts`
- Reduced `any` in board and voting routes:
  - `src/app/api/boards/[slug]/route.ts`
  - `src/app/api/boards/[slug]/members/route.ts`
  - `src/app/api/votes/route.ts`
- Removed `any` in core post feed/edit endpoints:
  - `src/app/api/posts/route.ts`
  - `src/app/api/posts/[id]/route.ts`
- Removed `any` in ranking/admin/notifications libs and core SSR pages:
  - `src/lib/ranking.ts`
  - `src/lib/admin.ts`
  - `src/lib/notifications.ts`
  - `src/app/page.tsx`
  - `src/app/r/[slug]/page.tsx`
  - `src/app/u/[username]/page.tsx`
- Deduplicated vote parsing helper:
  - Added `src/lib/vote-value.ts` (`toVoteValue`, `VoteValue`) and replaced repeated local helpers

---

### R-16 `notifications/archive/page.tsx` — Entire Page is Mock Data
**Status:** `[✓]`

`src/app/notifications/archive/page.tsx:31-62` uses a hardcoded `ARCHIVED_NOTIFICATIONS` array and a fake `loadMore` function backed by `setTimeout`. No TODO comment marks it as incomplete.

**Proposal:** Either implement the real feature or add a clear `// TODO:` comment and a "Coming soon" UI placeholder.

**Implemented:**
- Replaced mock archived notifications page content with a "Coming soon" placeholder and added a TODO marker.

---

### R-17 Homepage (`app/page.tsx`) is `"use client"` — No SSR
**Status:** `[✓]`

`src/app/page.tsx` is a client component that fetches posts in `useEffect`. Meanwhile `r/[slug]/page.tsx` and `tags/[slug]/page.tsx` are Server Components with proper SSR.

**Proposal:** Convert homepage to a Server Component + Suspense pattern, consistent with other feed pages.

**Implemented:**
- `src/app/page.tsx`
- `src/components/feed/FeedSortBar.tsx` (link-mode `t` support)
- `src/lib/pagination.ts` (treat `top` as offset pagination)

---

## Summary Table

| ID | Area | Affected Files | Effort | Priority |
|----|------|----------------|--------|----------|
| R-01 | Delete buggy hook | 1 hook | XS | 🔴 High |
| R-02 | `usePostInteractions` hook | 2 components | S | 🔴 High |
| R-03 | `withAuth` in all routes | 7 routes | M | 🔴 High |
| R-04 | Unified API error format | All routes | M | 🔴 High |
| R-05 | `getBoardIdBySlug` utility | 8+ routes | S | 🔴 High |
| R-06 | `ModeratorPermissions` type | 3 files | XS | 🟡 Medium |
| R-07 | `useInfiniteScroll` hook | 2 components | S | 🟡 Medium |
| R-08 | `useRulesEditor` hook | 2 components | S | 🟡 Medium |
| R-09 | `board-permissions` optional client | 1 lib file | S | 🟡 Medium |
| R-10 | Use library in `r/[slug]/page.tsx` | 1 page | XS | 🟡 Medium |
| R-11 | Consistent modal in `BoardSettingsForm` | 1 component | S | 🟡 Medium |
| R-12 | `SearchResultList` component | 1 page | S | 🟢 Low |
| R-13 | `CommentItem` use `ResponsiveMenu` | 1 component | XS | 🟢 Low |
| R-14 | Hook file naming convention | 2 files | XS | 🟢 Low |
| R-15 | Eliminate `any` types | 5+ files | L | 🟢 Low |
| R-16 | Archive page real implementation | 1 page | L | 🟢 Low |
| R-17 | Homepage SSR conversion | 1 page | M | 🟢 Low |
