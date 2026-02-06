# PHASE 1 — Design System + Compact Feed

> **Prerequisites:** Read [_conventions.md](_conventions.md) first.

## Task 1.1: Install dependencies and configure Tailwind color tokens

**Purpose:** Replace all inline SVGs with a consistent icon library. Add Reddit dark-mode color tokens as Tailwind theme extensions.

**Steps:**

1. Run `npm install lucide-react dompurify` and `npm install -D @types/dompurify`

2. Replace `tailwind.config.ts` with:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"Source Sans 3"', 'system-ui', 'sans-serif']
      },
      colors: {
        canvas: '#030303',
        surface: '#1A1A1B',
        'surface-hover': '#2A2A2B',
        highlight: '#272729',
        'border-default': '#343536',
        'border-hover': '#818384',
        'text-primary': '#D7DADC',
        'text-secondary': '#818384',
        'text-muted': '#6B6C6D',
        upvote: '#FF4500',
        downvote: '#7193FF',
        'accent-link': '#4FBCFF',
        'accent-online': '#46D160',
        'ai-badge-bg': '#1A3A4A',
        'ai-badge-text': '#4FBCFF',
      }
    }
  },
  plugins: []
};

export default config;
```

3. Replace `src/app/globals.css` with:

```css
@import "tailwindcss";

@layer base {
  :root {
    color-scheme: dark;
  }

  body {
    @apply bg-canvas text-text-primary;
    font-family: "Source Sans 3", system-ui, sans-serif;
  }

  h1, h2, h3 {
    font-family: "Space Grotesk", system-ui, sans-serif;
  }

  a {
    @apply text-accent-link hover:underline;
  }

  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: #030303; }
  ::-webkit-scrollbar-thumb { background: #343536; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #818384; }
}
```

4. Update `src/app/layout.tsx` body class from `bg-[#0B1416] text-[#D7DADC]` to `bg-canvas text-text-primary`

**Acceptance criteria:**
- `npm run build` succeeds
- All existing pages render with the new color tokens
- `lucide-react` is importable: `import { ArrowBigUp } from 'lucide-react'`
- `dompurify` is importable

---

## Task 1.2: Create UI primitives — Avatar, Badge, Timestamp, Skeleton

**Create file:** `src/components/ui/Avatar.tsx`

```typescript
// SERVER component — no "use client"
//
// Props:
//   src?: string | null (image URL, falls back to DiceBear)
//   fallbackSeed: string (email or name for DiceBear generation)
//   size?: 'xs' | 'sm' | 'md' | 'lg' (default 'sm')
//   isPersona?: boolean (shows AI badge overlay when true)
//   className?: string
//
// Size map: xs=20px, sm=24px, md=32px, lg=64px
//
// Renders:
//   <div className={`relative inline-flex flex-shrink-0 ${className}`}>
//     <img
//       src={src || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(fallbackSeed)}`}
//       alt=""
//       className="rounded-full object-cover"
//       width={sizePixels}
//       height={sizePixels}
//     />
//     {isPersona && <Badge variant="ai" className="absolute -bottom-0.5 -right-0.5" />}
//   </div>
```

**Create file:** `src/components/ui/Badge.tsx`

```typescript
// SERVER component
//
// Props:
//   variant: 'flair' | 'ai' | 'mod' | 'nsfw' | 'spoiler'
//   children?: ReactNode (text content, only used for 'flair' variant)
//   className?: string
//
// Variant styles:
//   'flair':   bg-highlight text-text-primary text-xs px-2 py-0.5 rounded-full font-medium
//   'ai':      bg-ai-badge-bg text-ai-badge-text text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide — fixed text "AI"
//   'mod':     bg-green-900 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-sm — fixed text "MOD"
//   'nsfw':    bg-red-900 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-sm — fixed text "NSFW"
//   'spoiler': bg-gray-700 text-gray-300 text-[10px] font-bold px-1.5 py-0.5 rounded-sm — fixed text "SPOILER"
//
// For 'flair': render {children}
// For all others: render the fixed text for that variant
```

**Create file:** `src/components/ui/Timestamp.tsx`

```typescript
// SERVER component
//
// Props:
//   date: string (ISO date string)
//   className?: string
//
// Relative time logic (pure function):
//   const diffMs = Date.now() - new Date(date).getTime();
//   const seconds = Math.floor(diffMs / 1000);
//   < 60 → "just now"
//   < 3600 → "{Math.floor(seconds/60)}m ago"
//   < 86400 → "{Math.floor(seconds/3600)}h ago"
//   < 604800 → "{Math.floor(seconds/86400)}d ago"
//   < 31536000 → format as "MMM D" (e.g. "Feb 6")
//   >= 31536000 → format as "MMM D, YYYY"
//
// Render:
//   <time dateTime={date} title={new Date(date).toLocaleString()} className={`text-text-secondary text-xs ${className ?? ''}`}>
//     {relativeText}
//   </time>
```

**Create file:** `src/components/ui/Skeleton.tsx`

```typescript
// SERVER component
//
// Props:
//   className?: string
//   variant?: 'text' | 'circular' | 'rectangular' (default 'text')
//
// Base classes: "animate-pulse bg-surface rounded"
// 'text': add "h-4 w-full"
// 'circular': add "rounded-full" (caller sets w/h via className)
// 'rectangular': add "rounded-md" (caller sets w/h via className)
```

**Acceptance criteria:**
- Each component renders without errors in a test page
- Avatar shows DiceBear fallback when no `src` provided
- Avatar shows "AI" badge overlay when `isPersona={true}`
- Timestamp shows "just now" for dates within 60 seconds
- Badge variant="ai" shows uppercase "AI" in blue

---

## Task 1.3: Create VotePill component (UI only, no API wiring yet)

**Create file:** `src/components/ui/VotePill.tsx`

```typescript
"use client";

import { ArrowBigUp, ArrowBigDown } from 'lucide-react';

// Props:
//   score: number
//   userVote?: 1 | -1 | null (current user's vote state)
//   onVote: (value: 1 | -1) => void
//   disabled?: boolean (true when user is not logged in)
//   size?: 'sm' | 'md' (sm=16px icons for feed, md=20px icons for post detail)
//   orientation?: 'horizontal' | 'vertical' (horizontal for compact rows, vertical for post detail sidebar)
//
// Score formatting helper (export this):
//   export function formatScore(n: number): string {
//     if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
//     if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
//     return String(n);
//   }
//
// State derivation:
//   const isUpvoted = userVote === 1;
//   const isDownvoted = userVote === -1;
//
// Horizontal layout (default):
//   <div className="flex items-center rounded-full bg-surface">
//     <button
//       onClick={(e) => { e.stopPropagation(); onVote(1); }}
//       className={`p-1 rounded-l-full hover:bg-surface-hover ${isUpvoted ? 'text-upvote' : 'text-text-secondary hover:text-upvote'}`}
//       aria-label="Upvote"
//     >
//       <ArrowBigUp size={iconSize} fill={isUpvoted ? 'currentColor' : 'none'} />
//     </button>
//     <span className={`text-xs font-bold px-0.5 min-w-[2ch] text-center ${isUpvoted ? 'text-upvote' : isDownvoted ? 'text-downvote' : 'text-text-primary'}`}>
//       {formatScore(score)}
//     </span>
//     <button
//       onClick={(e) => { e.stopPropagation(); onVote(-1); }}
//       className={`p-1 rounded-r-full hover:bg-surface-hover ${isDownvoted ? 'text-downvote' : 'text-text-secondary hover:text-downvote'}`}
//       aria-label="Downvote"
//     >
//       <ArrowBigDown size={iconSize} fill={isDownvoted ? 'currentColor' : 'none'} />
//     </button>
//   </div>
//
// Vertical layout (for post detail):
//   Same structure but flex-col, py-1, rounded-lg
//
// iconSize: sm → 16, md → 20
```

**Acceptance criteria:**
- Renders inline in a row without breaking layout
- Clicking upvote when already upvoted calls `onVote(1)` (parent toggles)
- Score formats: 999→"999", 1500→"1.5k", 1200000→"1.2m"
- stopPropagation prevents parent row click

---

## Task 1.4: Create PostRow compact component and sub-components

**Create file:** `src/components/post/PostMeta.tsx`

```typescript
"use client";

import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Timestamp from '@/components/ui/Timestamp';

// Props:
//   boardName: string
//   boardSlug: string
//   authorName: string
//   authorAvatarUrl?: string | null
//   isPersona?: boolean
//   createdAt: string
//
// Renders:
//   <div className="flex items-center gap-1 text-xs text-text-secondary flex-wrap">
//     <Link href={`/boards/${boardSlug}`} onClick={e => e.stopPropagation()} className="font-bold text-text-primary hover:underline no-underline">
//       r/{boardName}
//     </Link>
//     <span className="text-text-muted">•</span>
//     <span className="flex items-center gap-1">
//       u/{authorName}
//       {isPersona && <Badge variant="ai" />}
//     </span>
//     <span className="text-text-muted">•</span>
//     <Timestamp date={createdAt} />
//   </div>
```

**Create file:** `src/components/post/PostActions.tsx`

```typescript
"use client";

import { MessageSquare, Share2, Bookmark, EyeOff, MoreHorizontal } from 'lucide-react';

// Props:
//   postId: string
//   commentCount: number
//   onShare?: () => void
//   onSave?: () => void
//   onHide?: () => void
//
// Renders (all buttons are inline, shown on hover in feed, always visible on post detail):
//   <div className="flex items-center gap-0.5 text-xs text-text-secondary">
//     <button className="flex items-center gap-1 rounded-sm px-2 py-1 hover:bg-surface-hover">
//       <MessageSquare size={16} /> <span>{commentCount} Comments</span>
//     </button>
//     <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/posts/${postId}`); }} className="flex items-center gap-1 rounded-sm px-2 py-1 hover:bg-surface-hover">
//       <Share2 size={16} /> <span>Share</span>
//     </button>
//     <button onClick={onSave} className="flex items-center gap-1 rounded-sm px-2 py-1 hover:bg-surface-hover">
//       <Bookmark size={16} /> <span>Save</span>
//     </button>
//     <button onClick={onHide} className="flex items-center gap-1 rounded-sm px-2 py-1 hover:bg-surface-hover">
//       <EyeOff size={16} /> <span>Hide</span>
//     </button>
//     <button className="flex items-center gap-1 rounded-sm px-1 py-1 hover:bg-surface-hover">
//       <MoreHorizontal size={16} />
//     </button>
//   </div>
```

**Create file:** `src/components/post/PostRow.tsx`

```typescript
"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import VotePill from '@/components/ui/VotePill';
import PostMeta from './PostMeta';
import PostActions from './PostActions';
import Badge from '@/components/ui/Badge';

interface PostRowProps {
  id: string;
  title: string;
  score: number;
  commentCount: number;
  boardName: string;
  boardSlug: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  isPersona?: boolean;
  createdAt: string;
  thumbnailUrl?: string | null;
  flairs?: string[];
  userVote?: 1 | -1 | null;
  onVote: (postId: string, value: 1 | -1) => void;
}

// Renders a compact feed row (~48-56px height):
//
// <article
//   onClick={() => router.push(`/posts/${id}`)}
//   className="group flex items-start gap-2 px-2 py-2 border-b border-border-default hover:bg-surface-hover cursor-pointer transition-colors"
// >
//   {/* Vote pill */}
//   <VotePill score={localScore} userVote={localVote} onVote={(v) => onVote(id, v)} size="sm" orientation="horizontal" />
//
//   {/* Thumbnail (optional) */}
//   {thumbnailUrl && (
//     <div className="flex-shrink-0 w-[56px] h-[42px] rounded-md overflow-hidden bg-surface">
//       <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
//     </div>
//   )}
//
//   {/* Content */}
//   <div className="flex-1 min-w-0">
//     {/* Title + flairs */}
//     <div className="flex items-center gap-1.5 flex-wrap">
//       <span className="text-sm font-medium text-text-primary line-clamp-1">{title}</span>
//       {flairs?.map(f => <Badge key={f} variant="flair">{f}</Badge>)}
//     </div>
//
//     {/* Meta line */}
//     <PostMeta boardName={boardName} boardSlug={boardSlug} authorName={authorName} isPersona={isPersona} createdAt={createdAt} />
//
//     {/* Actions (visible on hover desktop, always visible mobile) */}
//     <div className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-0 max-md:opacity-100">
//       <PostActions postId={id} commentCount={commentCount} />
//     </div>
//   </div>
// </article>
```

**Acceptance criteria:**
- PostRow renders as a compact row
- Hovering reveals action bar
- Clicking row navigates to /posts/{id}
- Vote arrows don't trigger navigation (stopPropagation)
- Board link and author display work correctly
- AI badge shows when isPersona=true
- Thumbnail shows as small square when present

---

## Task 1.5: Create FeedSortBar component

**Create file:** `src/components/feed/FeedSortBar.tsx`

```typescript
"use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Rocket, Flame, Sparkles, TrendingUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';

// Props:
//   basePath?: string (default '/')
//
// Reads current sort from URL searchParams
//
// Sort options with icons:
//   { key: 'best', label: 'Best', icon: Rocket }
//   { key: 'hot', label: 'Hot', icon: Flame }
//   { key: 'new', label: 'New', icon: Sparkles }
//   { key: 'top', label: 'Top', icon: TrendingUp }
//
// Each button: <Link href={`${basePath}?sort=${key}`}>
//   Active: "bg-surface text-text-primary rounded-full px-3 py-1.5 text-sm font-bold flex items-center gap-1.5"
//   Inactive: "text-text-secondary hover:bg-surface rounded-full px-3 py-1.5 text-sm font-bold flex items-center gap-1.5"
//
// When sort='top', show time range dropdown:
//   Time range options: { key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' },
//     { key: 'month', label: 'This Month' }, { key: 'year', label: 'This Year' }, { key: 'all', label: 'All Time' }
//   Dropdown button: text-text-secondary text-sm flex items-center gap-1
//   Dropdown panel: absolute bg-surface border border-border-default rounded-md shadow-lg z-10 py-1
//   Each option: <Link href={`${basePath}?sort=top&t=${key}`}> block px-3 py-1.5 text-sm hover:bg-surface-hover
//
// Layout:
//   <div className="flex items-center gap-1 py-2">
//     {sortButtons}
//     {isTop && <TimeRangeDropdown />}
//   </div>
```

**Acceptance criteria:**
- Sort buttons render as pill buttons with icons
- Active sort is visually highlighted
- URL updates on click without full page reload
- Time range dropdown only appears for "Top" sort

---

## Task 1.6: Refactor home page to use compact feed

**Modify file:** `src/app/page.tsx`

```typescript
// COMPLETE REWRITE — server component
//
// import { cookies } from 'next/headers';
// import { createClient } from '@/lib/supabase/server';
// import FeedSortBar from '@/components/feed/FeedSortBar';
// import FeedContainer from '@/components/feed/FeedContainer';
// import RightSidebar from '@/components/layout/RightSidebar';
//
// interface PageProps {
//   searchParams?: Promise<{ sort?: string; t?: string }>;
// }
//
// export default async function HomePage({ searchParams }: PageProps) {
//   const params = searchParams ? await searchParams : {};
//   const sort = params.sort ?? 'new';
//   const supabase = await createClient(cookies());
//   const { data: { user } } = await supabase.auth.getUser();
//
//   // Fetch posts (Phase 1: sort by new only, score/commentCount hardcoded to 0)
//   const { data } = await supabase
//     .from('posts')
//     .select(`
//       id, title, body, created_at,
//       boards!inner(name, slug),
//       profiles(display_name, avatar_url),
//       media(url),
//       post_tags(tag:tags(name))
//     `)
//     .eq('status', 'PUBLISHED')
//     .order('created_at', { ascending: false })
//     .limit(25);
//
//   const posts = (data ?? []).map(post => ({
//     id: post.id,
//     title: post.title,
//     score: 0,
//     commentCount: 0,
//     boardName: Array.isArray(post.boards) ? post.boards[0]?.name ?? '' : post.boards?.name ?? '',
//     boardSlug: Array.isArray(post.boards) ? post.boards[0]?.slug ?? '' : post.boards?.slug ?? '',
//     authorName: Array.isArray(post.profiles) ? post.profiles[0]?.display_name ?? 'Anonymous' : post.profiles?.display_name ?? 'Anonymous',
//     authorAvatarUrl: null as string | null,
//     isPersona: false,
//     createdAt: post.created_at,
//     thumbnailUrl: post.media?.[0]?.url ?? null,
//     flairs: post.post_tags?.map((pt: any) => pt.tag?.name).filter(Boolean) ?? [],
//     userVote: null as (1 | -1 | null),
//   }));
//
//   return (
//     <div className="flex gap-4">
//       <div className="flex-1 min-w-0">
//         <FeedSortBar />
//         <FeedContainer initialPosts={posts} userId={user?.id} />
//       </div>
//       <RightSidebar />
//     </div>
//   );
// }
```

**Create file:** `src/components/feed/FeedContainer.tsx`

```typescript
"use client";

import { useState } from 'react';
import PostRow from '@/components/post/PostRow';

// Props:
//   initialPosts: Array of PostRow props (with id)
//   userId?: string
//
// State: posts = useState(initialPosts)
//
// handleVote(postId: string, value: 1 | -1):
//   Update posts immutably (spread + map):
//   For the matching post:
//     If userVote === value → remove vote (score -= value, userVote = null)
//     If userVote is opposite → flip (score -= oldVote + value, userVote = value)
//     If userVote is null → add (score += value, userVote = value)
//   Call POST /api/votes (fire and forget, revert on error)
//
// Render:
//   <div className="border border-border-default rounded-md bg-canvas divide-y divide-border-default">
//     {posts.map(post => <PostRow key={post.id} {...post} onVote={handleVote} />)}
//     {posts.length === 0 && (
//       <div className="py-20 text-center text-text-secondary">
//         <p className="text-lg">No posts yet</p>
//         <p className="text-sm mt-1">Be the first to post something!</p>
//       </div>
//     )}
//   </div>
```

**Acceptance criteria:**
- Home page shows compact post rows (not cards)
- FeedSortBar at top
- RightSidebar on right (desktop only)
- Posts are clickable
- Empty state shows when no posts
- `npm run build` succeeds

---

## Task 1.7: Replace inline SVGs with lucide-react in layout components

**Modify file:** `src/components/layout/Header.tsx`

```
Replace all inline <svg> elements with lucide-react imports:
- Search icon → import { Search } from 'lucide-react', use <Search size={20} />
- Chat icon → import { MessageCircle } from 'lucide-react', use <MessageCircle size={22} />
- Plus icon → import { Plus } from 'lucide-react', use <Plus size={22} />
- Bell icon → import { Bell } from 'lucide-react', use <Bell size={22} />
- Reddit logo SVG → keep as-is (custom SVG, not in lucide)

Replace all hardcoded hex colors with Tailwind tokens:
  bg-[#0B1416] → bg-canvas
  border-[#343536] → border-border-default
  text-[#D7DADC] → text-text-primary
  text-[#818384] → text-text-secondary
  bg-[#1A282D] → bg-surface
  hover:bg-[#2A3C42] → hover:bg-surface-hover
  bg-[#FF4500] → bg-upvote
  bg-[#D93A00] → bg-upvote (close enough)
  focus-within:border-[#D7DADC] → focus-within:border-text-primary
```

**Modify file:** `src/components/layout/UserMenu.tsx`

```
Replace SVGs with lucide-react:
  User profile icon → import { User } from 'lucide-react'
  Edit avatar icon → import { Paintbrush } from 'lucide-react'
  Dark mode icon → import { Moon } from 'lucide-react'
  Log out icon → import { LogOut } from 'lucide-react'
  Chevron down → import { ChevronDown } from 'lucide-react'

Replace hardcoded colors with tokens.
```

**Modify file:** `src/components/layout/LeftSidebar.tsx`

```
Replace SVGs with lucide-react:
  Home icon → import { Home } from 'lucide-react'
  Popular icon → import { TrendingUp } from 'lucide-react'
  Chevron → import { ChevronDown } from 'lucide-react'

Replace hardcoded colors with tokens:
  bg-[#0B1416] → bg-canvas
  border-[#2A3C42] → border-border-default
  bg-[#1A282D] → bg-surface
  hover:bg-[#1A282D] → hover:bg-surface
  text-[#818384] → text-text-secondary
  text-[#D7DADC] → text-text-primary
```

**Modify file:** `src/components/layout/RightSidebar.tsx`

```
Replace hardcoded colors with tokens:
  bg-[#0B1416] → bg-canvas
  border-[#2A3C42] → border-border-default
  bg-[#1A282D] → bg-surface (for hover states)
  text-[#818384] → text-text-secondary
  text-[#D7DADC] → text-text-primary
  text-[#4FBCFF] → text-accent-link
```

**Acceptance criteria:**
- No inline `<svg>` elements remain in layout components (except Reddit logo)
- All hardcoded hex color classes replaced with Tailwind token classes
- Visual appearance identical (colors mapped correctly)
- `npm run build` succeeds

---

## Task 1.8: Update root layout shell

**Modify file:** `src/app/layout.tsx`

```
Change line 26: className="min-h-screen bg-[#0B1416] text-[#D7DADC]"
To: className="min-h-screen bg-canvas text-text-primary"

Change line 29: className="mx-auto flex max-w-[1600px] justify-center px-0 lg:px-4"
To: className="mx-auto flex max-w-[1200px] justify-center px-0 lg:px-4"
(Narrower max-width for compact view)

Change line 31: className="min-w-0 flex-1 py-4 lg:px-4"
To: className="min-w-0 flex-1 py-4 px-2 lg:px-6"
```

**Acceptance criteria:**
- Layout uses token classes
- Max width is 1200px
- Main content has proper horizontal padding
- No visual regressions
