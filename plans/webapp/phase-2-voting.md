# PHASE 2 — Voting System + Feed Sorting

> **STATUS: REFERENCE ONLY** — This phase has been implemented. The code exists in the codebase. Do not re-implement. Use this document only to understand existing architecture.
>
> **Prerequisites:** Complete Phase 1. Read [_conventions.md](_conventions.md). Run SQL migration in Supabase Dashboard before starting.

## Task 2.1: Database migration — votes table + post score columns

**Create file:** `supabase/migrations/002_votes_and_scores.sql`

```sql
-- Add score and comment_count columns to posts
alter table public.posts
  add column if not exists score int not null default 0,
  add column if not exists comment_count int not null default 0;

-- Create votes table
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz default now(),
  constraint vote_target check (
    (post_id is not null and comment_id is null) or
    (post_id is null and comment_id is not null)
  ),
  unique (user_id, post_id),
  unique (user_id, comment_id)
);

-- RLS policies
alter table public.votes enable row level security;

create policy "Votes are viewable by everyone" on public.votes
  for select using (true);
create policy "Authenticated users can vote" on public.votes
  for insert with check (auth.uid() = user_id);
create policy "Users can update their votes" on public.votes
  for update using (auth.uid() = user_id);
create policy "Users can delete their votes" on public.votes
  for delete using (auth.uid() = user_id);

-- Trigger: auto-update post score when vote changes
create or replace function public.fn_update_post_score()
returns trigger as $$
begin
  if TG_OP = 'INSERT' and NEW.post_id is not null then
    update public.posts set score = score + NEW.value where id = NEW.post_id;
  elsif TG_OP = 'DELETE' and OLD.post_id is not null then
    update public.posts set score = score - OLD.value where id = OLD.post_id;
  elsif TG_OP = 'UPDATE' and NEW.post_id is not null then
    update public.posts set score = score - OLD.value + NEW.value where id = NEW.post_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger trg_vote_post_score
  after insert or update or delete on public.votes
  for each row execute function public.fn_update_post_score();

-- Indexes
create index if not exists idx_posts_score on public.posts(score desc);
create index if not exists idx_votes_user_post on public.votes(user_id, post_id);
create index if not exists idx_votes_post on public.votes(post_id);
```

**Run in:** Supabase Dashboard → SQL Editor → New Query → Paste → Run

**Acceptance criteria:**
- `votes` table exists
- `posts` has `score` and `comment_count` columns (default 0)
- Inserting a vote with `value=1` on a post increases that post's `score` by 1
- Deleting the vote decreases it back

---

## Task 2.2: Vote API route

**Create file:** `src/app/api/votes/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// POST /api/votes
// Body: { postId?: string, commentId?: string, value: 1 | -1 }
//
// Logic:
// 1. Auth check → 401 if not logged in
// 2. Validate inputs → 400 if invalid
// 3. Look for existing vote by this user on this target
// 4. If existing vote with SAME value → DELETE it (toggle off) → return { vote: null }
// 5. If existing vote with DIFFERENT value → UPDATE it → return { vote: { id, value } }
// 6. If no existing vote → INSERT → return { vote: { id, value } }
// 7. Fetch updated post/comment score and include in response
//
// Response: { vote: { id: string, value: number } | null, score: number }
```

**Acceptance criteria:**
- First upvote: creates vote, score increases
- Second upvote (same value): removes vote (toggle), score decreases
- Upvote then downvote: changes vote, score adjusts by -2
- Unauthenticated: returns 401

---

## Task 2.3: Wire voting into feed

**Modify file:** `src/app/page.tsx`

```
Update Supabase select to include score:
  .select(`id, title, body, created_at, score, comment_count, ...existing fields...`)

If user is authenticated, also fetch their votes:
  const postIds = posts.map(p => p.id);
  const { data: userVotes } = await supabase
    .from('votes')
    .select('post_id, value')
    .in('post_id', postIds)
    .eq('user_id', user.id);

Map votes to posts:
  const voteMap = Object.fromEntries((userVotes ?? []).map(v => [v.post_id, v.value]));
  // When mapping posts: userVote: voteMap[post.id] ?? null
```

**Modify file:** `src/components/feed/FeedContainer.tsx`

```
handleVote now calls the API:
  const res = await fetch('/api/votes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId, value })
  });

On success: API returns { score }, use it to correct any drift
On error: revert optimistic state
```

**Acceptance criteria:**
- Real scores shown in feed
- Upvoting/downvoting works with optimistic UI
- Refreshing page preserves vote state (arrows stay highlighted)

---

## Task 2.4: Feed sorting with URL params

**Create file:** `src/lib/ranking.ts`

```typescript
// Hot ranking algorithm (export for use in API route)
export function hotScore(score: number, createdAtIso: string): number {
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  const epoch = new Date('2024-01-01').getTime() / 1000;
  const seconds = new Date(createdAtIso).getTime() / 1000 - epoch;
  return sign * order + seconds / 45000;
}

// Time range filter helper
export function getTimeRangeDate(range: string): string | null {
  const now = Date.now();
  const ranges: Record<string, number> = {
    today: 86400000,
    week: 604800000,
    month: 2592000000,
    year: 31536000000,
  };
  const ms = ranges[range];
  if (!ms) return null;
  return new Date(now - ms).toISOString();
}
```

**Modify file:** `src/app/api/posts/route.ts`

```
Add sort and t params to GET handler.
Apply sorting logic:
  'new' → .order('created_at', { ascending: false })
  'top' → .order('score', { ascending: false }) + time range filter
  'hot' → .order('created_at', { ascending: false }) then sort result with hotScore() in-memory
  'best' → alias for 'hot'

Add time range filter when sort='top':
  const since = getTimeRangeDate(t);
  if (since) query = query.gte('created_at', since);
```

**Modify file:** `src/app/page.tsx`

```
Read sort/t from searchParams and apply the same sorting server-side.
Pass currentSort to FeedSortBar.
```

**Acceptance criteria:**
- `/?sort=new` shows newest posts first
- `/?sort=top&t=week` shows highest-scored posts from last 7 days
- `/?sort=hot` shows hot-ranked posts
- Sort buttons in FeedSortBar reflect the current URL
