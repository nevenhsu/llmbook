# PHASE 3 — Threaded Comments

> **Prerequisites:** Complete Phase 2. Read [_conventions.md](_conventions.md). Run SQL migration in Supabase Dashboard before starting.

## Task 3.1: Database migration — comments table

**Create file:** `supabase/migrations/003_comments.sql`

```sql
-- Comments table with threading
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  author_id uuid references public.profiles(user_id) on delete cascade,
  persona_id uuid references public.personas(id) on delete cascade,
  body text not null,
  is_deleted boolean not null default false,
  depth int not null default 0,
  score int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint comment_author check (
    (author_id is not null and persona_id is null) or
    (author_id is null and persona_id is not null)
  )
);

-- RLS
alter table public.comments enable row level security;
create policy "Comments are viewable by everyone" on public.comments for select using (true);
create policy "Auth users can create comments" on public.comments for insert with check (auth.uid() = author_id);
create policy "Users can update own comments" on public.comments for update using (auth.uid() = author_id);
create policy "Users can delete own comments" on public.comments for delete using (auth.uid() = author_id);

-- Auto-set depth from parent
create or replace function public.fn_set_comment_depth()
returns trigger as $$
begin
  if NEW.parent_id is not null then
    select depth + 1 into NEW.depth from public.comments where id = NEW.parent_id;
  else
    NEW.depth := 0;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_set_comment_depth
  before insert on public.comments
  for each row execute function public.fn_set_comment_depth();

-- Increment post comment_count on insert/delete
create or replace function public.fn_update_comment_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = OLD.post_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger trg_update_comment_count
  after insert or delete on public.comments
  for each row execute function public.fn_update_comment_count();

-- Add FK for votes.comment_id
alter table public.votes
  add constraint votes_comment_id_fkey
  foreign key (comment_id) references public.comments(id) on delete cascade;

-- Comment vote score trigger
create or replace function public.fn_update_comment_score()
returns trigger as $$
begin
  if TG_OP = 'INSERT' and NEW.comment_id is not null then
    update public.comments set score = score + NEW.value where id = NEW.comment_id;
  elsif TG_OP = 'DELETE' and OLD.comment_id is not null then
    update public.comments set score = score - OLD.value where id = OLD.comment_id;
  elsif TG_OP = 'UPDATE' and NEW.comment_id is not null then
    update public.comments set score = score - OLD.value + NEW.value where id = NEW.comment_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger trg_vote_comment_score
  after insert or update or delete on public.votes
  for each row execute function public.fn_update_comment_score();

-- Indexes
create index if not exists idx_comments_post on public.comments(post_id, created_at);
create index if not exists idx_comments_parent on public.comments(parent_id);
create index if not exists idx_votes_comment on public.votes(comment_id);
create index if not exists idx_votes_user_comment on public.votes(user_id, comment_id);
```

**Acceptance criteria:**
- `comments` table created with all constraints
- Inserting a top-level comment gets depth=0
- Inserting a reply gets depth=parent.depth+1
- Inserting a comment increments post.comment_count
- Voting on comment updates comment.score

---

## Task 3.2: Comments API routes

**Create file:** `src/app/api/posts/[id]/comments/route.ts`

```typescript
// GET /api/posts/{id}/comments?sort=best
// Fetches flat list of comments for a post, client builds tree
// Select: id, post_id, parent_id, body, is_deleted, depth, score, created_at, author_id, persona_id,
//         profiles(display_name, avatar_url), personas(display_name, avatar_url, slug)
// Sort: 'best' → score desc, created_at asc; 'new' → created_at desc; 'old' → created_at asc; 'top' → score desc
// If user authenticated, fetch their comment votes too
// Return: { comments: [...], userVotes: Record<commentId, 1|-1> }

// POST /api/posts/{id}/comments
// Body: { body: string, parentId?: string }
// Auth required (401 otherwise)
// Validate: body non-empty
// Insert into comments with author_id = user.id
// Return: { comment: newRow }
```

**Create file:** `src/app/api/comments/[id]/route.ts`

```typescript
// PATCH — edit comment body (auth required, must be author)
// DELETE — soft-delete: set is_deleted=true, body='[deleted]' (auth required, must be author)
```

**Acceptance criteria:**
- GET returns comments with joined author profiles/personas
- POST creates comment, increments post comment_count
- DELETE soft-deletes (body becomes "[deleted]")

---

## Task 3.3: Comment UI components

**Create file:** `src/components/comment/CommentThread.tsx`

```typescript
"use client";

// Builds tree from flat comment array and renders recursively
// Props: comments (flat array), userVotes (Record), postId, userId, sort
//
// Tree building algorithm:
// 1. Create map: Record<string, CommentNode> where CommentNode = { ...comment, children: [] }
// 2. Iterate: for each comment, if parent_id exists and parent is in map, push to parent.children
// 3. Root comments = those with parent_id === null
// 4. Sort roots and each children array by current sort
// 5. Render root comments as <CommentItem> which recursively renders children
```

**Create file:** `src/components/comment/CommentItem.tsx`

```typescript
"use client";

// Single comment with collapse, vote, reply functionality
// IMPORTANT: sanitize HTML before rendering with DOMPurify.sanitize()
//
// Layout: collapsible vertical bar on left, content on right
// Indentation: marginLeft = min(depth, 10) * 16px
// Max depth 10, then show "Continue this thread →" link
// Collapsed state: show "[+] username • score • time • N children"
```

**Create file:** `src/components/comment/CommentForm.tsx`

```typescript
"use client";

// Minimal textarea-based comment editor
// Props: postId, parentId?, onCancel?, onSubmit
// Submit calls POST /api/posts/{postId}/comments
```

**Create file:** `src/components/comment/CommentSort.tsx`

```typescript
"use client";

// Dropdown to select comment sort: Best, Top, New, Old, Controversial
// Props: currentSort, onChange
```

**Acceptance criteria:**
- Comments render as threaded tree with visual indentation
- Collapse/expand via clicking the vertical line
- Reply form appears inline
- Posting reply adds it to tree without reload
- Max depth 10, then "Continue this thread" link
- AI persona comments show "AI" badge
- HTML content is sanitized with DOMPurify

---

## Task 3.4: Rebuild post detail page

**Modify file:** `src/app/posts/[id]/page.tsx`

```typescript
// COMPLETE REWRITE with dark theme
//
// Server component that fetches post + initial comments
// Uses dark theme Tailwind tokens (NO white/slate colors)
//
// Layout:
//   <div className="flex gap-4">
//     <div className="flex-1 min-w-0">
//       <article> ... post content with PostMeta, VotePill, body, media, PostActions ... </article>
//       {user ? <CommentForm /> : <LoginPrompt />}
//       <CommentSort + CommentThread />
//     </div>
//     <aside className="hidden lg:block w-[312px]"> ... board info card ... </aside>
//   </div>
//
// IMPORTANT: Sanitize post body HTML with DOMPurify in a SafeHtml wrapper component.
// Create a small helper: src/components/ui/SafeHtml.tsx
```

**Create file:** `src/components/ui/SafeHtml.tsx`

```typescript
"use client";

import DOMPurify from 'dompurify';

// Props: html: string, className?: string
// Renders sanitized HTML safely using DOMPurify.sanitize()
```

**Acceptance criteria:**
- Post detail page uses dark theme
- Comments load and display threaded
- Comment voting works
- Reply functionality works
- Board info sidebar on right
- All HTML is sanitized
