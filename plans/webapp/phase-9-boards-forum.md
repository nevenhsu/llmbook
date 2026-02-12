# PHASE 9 — Reddit-Style Forum: Boards CRUD + Moderator System ✅ COMPLETED

> **Prerequisites:** Complete Phase 8. Read [_conventions.md](_conventions.md). Run SQL migration in Supabase Dashboard before starting.
>
> **Design Decisions (Confirmed):**
> - Board Creation: Any logged-in user can create
> - Archive Behavior: Soft-delete + read-only, archived boards visible via dedicated archive page
> - Moderator System: Full moderator system with permissions
> - Sorting: Hot/New/Top/Rising with time decay algorithm
> - Customization: Basic (banner, description, community rules)
> - Post Flair: Use existing Tags system (no separate flair table)

> **Implementation Status:** All 7 tasks completed
> - ✅ Task 9.1: Board Create Page + API
> - ✅ Task 9.2: Board Settings Page + Archive API
> - ✅ Task 9.3: Board Ban System
> - ✅ Task 9.4: Archive Boards Page
> - ✅ Task 9.5: Enhanced Feed Sorting (Hot/Rising)
> - ✅ Task 9.6: Poll Post Type
> - ✅ Task 9.7: Board Info Sidebar Enhancement

---

## Migration: 008_boards_forum.sql ✅

**Create file:** `supabase/migrations/008_boards_forum.sql`

```sql
-- Migration 008: Boards Forum System
-- Enhanced boards with creation, archive, moderator features

-- ============================================================================
-- PART 1: Extend boards table
-- ============================================================================

-- Add new columns to boards
ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS member_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS post_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create index for archive filtering
CREATE INDEX IF NOT EXISTS idx_boards_archived ON public.boards(is_archived);
CREATE INDEX IF NOT EXISTS idx_boards_creator ON public.boards(creator_id);

-- ============================================================================
-- PART 2: Board Moderators table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.board_moderators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'moderator' CHECK (role IN ('owner', 'moderator')),
  permissions jsonb NOT NULL DEFAULT '{"manage_posts": true, "manage_users": true, "manage_settings": false}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(board_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_board_moderators_board ON public.board_moderators(board_id);
CREATE INDEX IF NOT EXISTS idx_board_moderators_user ON public.board_moderators(user_id);

-- RLS
ALTER TABLE public.board_moderators ENABLE ROW LEVEL SECURITY;

-- Anyone can see moderators
CREATE POLICY "Moderators are viewable by everyone" ON public.board_moderators
  FOR SELECT USING (true);

-- Only board owner can manage moderators
CREATE POLICY "Board owner can manage moderators" ON public.board_moderators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.board_moderators bm
      WHERE bm.board_id = board_moderators.board_id
        AND bm.user_id = auth.uid()
        AND bm.role = 'owner'
    )
  );

-- ============================================================================
-- PART 3: Board Banned Users table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.board_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  expires_at timestamptz, -- NULL = permanent
  created_at timestamptz DEFAULT now(),
  UNIQUE(board_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_board_bans_board ON public.board_bans(board_id);
CREATE INDEX IF NOT EXISTS idx_board_bans_user ON public.board_bans(user_id);

ALTER TABLE public.board_bans ENABLE ROW LEVEL SECURITY;

-- Anyone can see if they're banned
CREATE POLICY "Users can see their own bans" ON public.board_bans
  FOR SELECT USING (auth.uid() = user_id);

-- Moderators can see all bans in their board
CREATE POLICY "Moderators can see board bans" ON public.board_bans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.board_moderators
      WHERE board_moderators.board_id = board_bans.board_id
        AND board_moderators.user_id = auth.uid()
    )
  );

-- Moderators can manage bans
CREATE POLICY "Moderators can manage bans" ON public.board_bans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.board_moderators
      WHERE board_moderators.board_id = board_bans.board_id
        AND board_moderators.user_id = auth.uid()
    )
  );

-- ============================================================================
-- PART 4: Post type column (for Poll support)
-- ============================================================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'text' CHECK (post_type IN ('text', 'poll')),
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS link_preview jsonb;

-- Poll options table
CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  text text NOT NULL,
  vote_count int NOT NULL DEFAULT 0,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, option_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_poll_options_post ON public.poll_options(post_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON public.poll_votes(option_id);

-- RLS
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Poll options viewable by everyone" ON public.poll_options
  FOR SELECT USING (true);

CREATE POLICY "Poll votes private" ON public.poll_votes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can vote on polls" ON public.poll_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- PART 5: Update RLS for boards (allow authenticated users to create)
-- ============================================================================

-- Drop old policy if exists
DROP POLICY IF EXISTS "Boards are viewable by everyone" ON public.boards;

-- Anyone can view non-archived boards
CREATE POLICY "Active boards are viewable by everyone" ON public.boards
  FOR SELECT USING (is_archived = false);

-- Archived boards viewable with explicit query
CREATE POLICY "Archived boards are viewable by everyone" ON public.boards
  FOR SELECT USING (is_archived = true);

-- Authenticated users can create boards
CREATE POLICY "Authenticated users can create boards" ON public.boards
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Board owner/moderator can update
CREATE POLICY "Moderators can update boards" ON public.boards
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.board_moderators
      WHERE board_moderators.board_id = boards.id
        AND board_moderators.user_id = auth.uid()
    )
  );

-- ============================================================================
-- PART 6: Triggers for member_count and post_count
-- ============================================================================

-- Member count trigger
CREATE OR REPLACE FUNCTION public.fn_update_board_member_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.boards SET member_count = member_count + 1 WHERE id = NEW.board_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.boards SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.board_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_board_member_count
  AFTER INSERT OR DELETE ON public.board_members
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_board_member_count();

-- Post count trigger
CREATE OR REPLACE FUNCTION public.fn_update_board_post_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.boards SET post_count = post_count + 1 WHERE id = NEW.board_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.boards SET post_count = GREATEST(post_count - 1, 0) WHERE id = OLD.board_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_board_post_count
  AFTER INSERT OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_board_post_count();

-- Poll vote count trigger
CREATE OR REPLACE FUNCTION public.fn_update_poll_vote_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.poll_options SET vote_count = vote_count + 1 WHERE id = NEW.option_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.poll_options SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.option_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_poll_vote_count
  AFTER INSERT OR DELETE ON public.poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_poll_vote_count();
```

**Acceptance criteria:**
- All tables created with proper constraints
- RLS policies enforce:
  - Any authenticated user can create boards
  - Only moderators/owners can update boards
  - Moderators can manage bans
  - Archived boards are read-only
- Triggers update member_count and post_count automatically
- Poll system tables ready for voting

---

## Task 9.1: Board Create Page + API ✅ COMPLETED

**Create file:** `src/app/boards/create/page.tsx`

```typescript
// Server component with auth check
// Redirects to /login if not authenticated

// Form fields:
// - name (required, 3-21 chars, alphanumeric + underscores)
// - slug (auto-generated from name, editable)
// - description (optional, max 500 chars)
// - banner_url (optional, file upload)
// - rules (array of { title: string, description: string })

// On submit:
// 1. Create board via API
// 2. Auto-add creator as owner in board_moderators
// 3. Auto-join creator in board_members
// 4. Redirect to /boards/{slug}
```

**Create file:** `src/app/api/boards/route.ts`

```typescript
// POST /api/boards
// Body: { name, slug, description?, banner_url?, rules? }
// Auth required (401 otherwise)
//
// Validation:
// - name: 3-21 chars, alphanumeric + underscores
// - slug: unique, lowercase, no spaces
// - description: max 500 chars
// - rules: max 15 rules, each { title: max 100 chars, description: max 500 chars }
//
// Actions:
// 1. Insert into boards with creator_id = user.id
// 2. Insert creator into board_moderators with role = 'owner'
// 3. Insert creator into board_members
// 4. Return { board: newRow }
```

**Modify file:** `src/components/layout/Header.tsx`
- Add "Create Board" link in user menu dropdown

**Acceptance criteria:**
- Create board form accessible from header menu
- Board created with proper validation
- Creator automatically becomes owner and member
- Redirects to new board page after creation

---

## Task 9.2: Board Settings Page + Archive API ✅ COMPLETED

**Create file:** `src/app/boards/[slug]/settings/page.tsx`

```typescript
// Server component with moderator check
// Only accessible by board moderators

// Tabs:
// 1. General: name, description, banner, icon
// 2. Rules: manage community rules list
// 3. Moderators: add/remove moderators (owner only)
// 4. Danger Zone: archive board (owner only)

// Archive confirmation modal with warning text
```

**Create file:** `src/app/api/boards/[slug]/route.ts`

```typescript
// PATCH /api/boards/{slug}
// Body: { name?, description?, banner_url?, rules? }
// Auth required + moderator check
//
// Returns: { board: updatedRow }

// DELETE /api/boards/{slug} (Archive, not delete)
// Auth required + owner check
//
// Sets is_archived = true, archived_at = now()
// Returns: { success: true }
```

**Create file:** `src/app/api/boards/[slug]/moderators/route.ts`

```typescript
// GET /api/boards/{slug}/moderators
// Returns list of moderators with profiles

// POST /api/boards/{slug}/moderators
// Body: { user_id, role?, permissions? }
// Auth required + owner check
// Add new moderator

// DELETE /api/boards/{slug}/moderators/{userId}
// Auth required + owner check
// Remove moderator (cannot remove owner)
```

**Acceptance criteria:**
- Settings page accessible only to moderators
- Board info can be updated
- Rules can be added/removed/reordered
- Moderators can be managed by owner
- Archive confirmation requires explicit action
- Archived boards become read-only

---

## Task 9.3: Board Ban System ✅ COMPLETED

**Create file:** `src/app/api/boards/[slug]/bans/route.ts`

```typescript
// GET /api/boards/{slug}/bans
// Auth required + moderator check
// Returns list of banned users

// POST /api/boards/{slug}/bans
// Body: { user_id, reason?, expires_at? }
// Auth required + moderator check
// Ban a user from the board

// DELETE /api/boards/{slug}/bans/{userId}
// Auth required + moderator check
// Unban a user
```

**Create file:** `src/lib/board-permissions.ts`

```typescript
// Helper functions:
// - isBoardModerator(boardId, userId): Promise<boolean>
// - isBoardOwner(boardId, userId): Promise<boolean>
// - isUserBanned(boardId, userId): Promise<boolean>
// - canPostInBoard(boardId, userId): Promise<boolean>
// - canManageBoard(boardId, userId): Promise<boolean>
```

**Modify file:** `src/app/api/posts/route.ts`
- Check if user is banned before allowing post creation
- Return 403 if banned

**Modify file:** `src/app/api/posts/[id]/comments/route.ts`
- Check if user is banned from the post's board before allowing comment
- Return 403 if banned

**Acceptance criteria:**
- Moderators can ban/unban users
- Banned users cannot post or comment in the board
- Ban list viewable in settings
- Temporary bans auto-expire

---

## Task 9.4: Archive Boards Page ✅ COMPLETED

**Create file:** `src/app/boards/archive/page.tsx`

```typescript
// Server component
// Lists all archived boards with:
// - Board name, description
// - Member count, post count
// - Archived date
// - "View (Read-only)" button

// Sort by archived_at desc (newest first)
// Pagination with 20 per page
```

**Modify file:** `src/app/boards/[slug]/page.tsx`

```typescript
// Check if board is archived
// If archived, show banner:
//   "This community has been archived and is read-only"
// Hide:
//   - Create post button
//   - Comment forms
//   - Join button
// Keep visible:
//   - All posts and comments
//   - Voting (read-only display)
```

**Modify file:** `src/components/layout/LeftSidebar.tsx`
- Add "Archived Boards" link at bottom of boards list

**Acceptance criteria:**
- Archived boards accessible from dedicated page
- Archived board pages show read-only banner
- No posting/commenting/joining on archived boards
- Historical content fully visible

---

## Task 9.5: Enhanced Feed Sorting (Hot/Rising) ✅ COMPLETED

**Modify file:** `src/lib/ranking.ts`

```typescript
// Add new sorting algorithms:

// Hot: Reddit-style time decay
// hot_score = log10(max(|score|, 1)) * sign(score) + (created_at_epoch - 1134028003) / 45000

// Rising: Recent posts with velocity
// velocity = score / hours_since_creation
// Only posts < 24 hours old

// Top: By time period
// top(period: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all')
// Filter by created_at within period, then sort by score desc
```

**Modify file:** `src/components/feed/FeedSortBar.tsx`

```typescript
// Add sort options:
// - Hot (default)
// - New
// - Top (with time period dropdown: Today, Week, Month, Year, All Time)
// - Rising

// Update URL with sort param: ?sort=hot&t=day
```

**Modify file:** `src/app/api/posts/route.ts`

```typescript
// Support query params:
// - sort: 'hot' | 'new' | 'top' | 'rising'
// - t: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' (for top)
// - board: board slug (optional)
//
// Apply corresponding sorting algorithm
```

**Modify file:** `src/app/boards/[slug]/page.tsx`
- Pass sort params to feed API
- Persist sort selection in URL

**Acceptance criteria:**
- Hot/New/Top/Rising sorting works correctly
- Top has time period filter
- Sort persists in URL for sharing
- Default sort is Hot

---

## Task 9.6: Poll Post Type ✅ COMPLETED

**Create file:** `src/components/post/PollDisplay.tsx`

```typescript
"use client";

// Props: postId, options, userVote, isExpired
//
// Display:
// - List of options with progress bars
// - Vote button for each option (if not voted)
// - After voting: show percentages and total votes
// - Highlighted user's choice
//
// API call: POST /api/polls/{postId}/vote
```

**Create file:** `src/app/api/polls/[postId]/vote/route.ts`

```typescript
// POST /api/polls/{postId}/vote
// Body: { optionId }
// Auth required
//
// Check: user hasn't already voted on this poll
// Insert into poll_votes
// Return: { userVote: optionId, options: updatedOptions }
```

**Modify file:** `src/components/create-post/CreatePostForm.tsx`

```typescript
// Add Poll tab (currently disabled in M5.1)
// Enable and add poll creation UI:
// - "Add Option" button (max 6 options)
// - Each option: text input + remove button
// - Poll duration: 1 day, 3 days, 1 week, or custom
//
// On submit: include poll_options in request body
```

**Modify file:** `src/app/api/posts/route.ts`

```typescript
// POST handling for post_type = 'poll':
// 1. Create post with post_type = 'poll'
// 2. Create poll_options from request body
// 3. Return post with options
```

**Modify file:** `src/app/posts/[id]/page.tsx`
- If post_type = 'poll', render PollDisplay instead of body

**Acceptance criteria:**
- Users can create poll posts with 2-6 options
- Voting updates counts in real-time
- Users can only vote once per poll
- Results show after voting

---

## Task 9.7: Board Info Sidebar Enhancement ✅ COMPLETED

**Modify file:** `src/app/boards/[slug]/page.tsx`

```typescript
// Right sidebar content:
// 1. Board card:
//    - Icon + Name
//    - Description
//    - Created date
//    - Member count + Online count (placeholder)
//    - Join/Leave button
//
// 2. Rules card:
//    - Numbered list of rules
//    - Expandable descriptions
//
// 3. Moderators card:
//    - List of moderators with avatars
//    - "Message Mods" button (placeholder)
//
// 4. Related boards card (placeholder)
```

**Create file:** `src/components/board/BoardInfoCard.tsx`

```typescript
// Props: board, isMember, memberCount
// Displays board info with join button
// DaisyUI card styling
```

**Create file:** `src/components/board/BoardRulesCard.tsx`

```typescript
// Props: rules (array)
// Expandable accordion for each rule
// DaisyUI collapse component
```

**Create file:** `src/components/board/BoardModeratorsCard.tsx`

```typescript
// Props: moderators (array with profiles)
// Avatar grid with usernames
// Links to profiles
```

**Acceptance criteria:**
- Board sidebar shows complete info
- Rules are expandable
- Moderators visible with avatars
- Cards use DaisyUI styling

---

## Summary: All Files Created/Modified

| New Files | Modified Files |
|-----------|----------------|
| `supabase/migrations/008_boards_forum.sql` | `src/app/boards/[slug]/page.tsx` |
| `src/app/boards/create/page.tsx` | `src/app/api/posts/route.ts` |
| `src/app/boards/[slug]/settings/page.tsx` | `src/app/api/posts/[id]/comments/route.ts` |
| `src/app/boards/archive/page.tsx` | `src/components/layout/Header.tsx` |
| `src/app/api/boards/route.ts` | `src/components/layout/LeftSidebar.tsx` |
| `src/app/api/boards/[slug]/route.ts` | `src/components/feed/FeedSortBar.tsx` |
| `src/app/api/boards/[slug]/moderators/route.ts` | `src/lib/ranking.ts` |
| `src/app/api/boards/[slug]/bans/route.ts` | `src/components/create-post/CreatePostForm.tsx` |
| `src/app/api/polls/[postId]/vote/route.ts` | `src/app/posts/[id]/page.tsx` |
| `src/lib/board-permissions.ts` | |
| `src/components/post/PollDisplay.tsx` | |
| `src/components/board/BoardInfoCard.tsx` | |
| `src/components/board/BoardRulesCard.tsx` | |
| `src/components/board/BoardModeratorsCard.tsx` | |
