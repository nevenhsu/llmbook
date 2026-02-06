# PHASE M3 — Feed + PostRow + Sorting

> **Prerequisites:** Complete M1. Read [_conventions.md](_conventions.md). Execute alongside or after webapp Phase 1 and Phase 2.

## Task M3.1: FeedSortBar mobile responsive with DaisyUI

**Modify file:** `src/components/feed/FeedSortBar.tsx` (created in webapp Phase 1)

```
Current spec: horizontal row of pill buttons with icons.
Problem on mobile: pills may overflow at <375px, especially when "Top" is selected (shows time range dropdown).

Changes:

1. Make pill row horizontally scrollable on mobile:
   <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-hide">

   (scrollbar-hide utility added in M1.1 globals.css)

2. Sort buttons: use DaisyUI btn for consistent sizing:
   Active:   className="btn btn-sm bg-base-100 text-base-content rounded-full gap-1.5"
   Inactive: className="btn btn-sm btn-ghost text-[#818384] rounded-full gap-1.5"

   DaisyUI btn-sm gives ~32px height — sufficient for inline pill buttons.

3. Time range dropdown for "Top" sort: use DaisyUI dropdown:
   <div className="dropdown dropdown-bottom">
     <div tabIndex={0} role="button" className="btn btn-sm btn-ghost text-[#818384] gap-1">
       {timeRangeLabel} <ChevronDown size={14} />
     </div>
     <ul tabIndex={-1} className="dropdown-content menu bg-base-100 rounded-box z-10 w-40 p-2 shadow-lg border border-neutral">
       {timeRanges.map(range => (
         <li key={range.key}>
           <Link href={`${basePath}?sort=top&t=${range.key}`}>{range.label}</Link>
         </li>
       ))}
     </ul>
   </div>

4. Ensure active sort pill is scrolled into view on mount.
```

**Acceptance criteria:**
- At 375px: sort pills scroll horizontally without page overflow
- Active pill visible without manual scrolling
- Time range dropdown uses DaisyUI dropdown, doesn't clip off-screen
- All pills are tappable

---

## Task M3.2: PostRow mobile adaptation

**Modify file:** `src/components/post/PostRow.tsx` (created in webapp Phase 1)

```
Current spec: compact row with vote pill, optional thumbnail, title, meta, hover actions.
Mobile issues:
  - Actions hidden via opacity-0 group-hover:opacity-100 — no hover on touch
  - Thumbnail may be too large on narrow screens
  - Touch targets on vote buttons may be too small

Changes:

1. Actions visibility — already partially handled in Phase 1 spec:
   "mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-0 max-md:opacity-100"
   Verify this works. The max-md:opacity-100 makes actions always visible on mobile.

2. Thumbnail sizing:
   Desktop: w-[56px] h-[42px] (existing)
   Mobile: w-[48px] h-[36px]
   Change to: className="flex-shrink-0 w-[48px] h-[36px] sm:w-[56px] sm:h-[42px] rounded-md overflow-hidden bg-base-100"

3. Vote pill tap targets:
   Use DaisyUI join for grouped vote buttons:
   <div className="join join-horizontal bg-base-100 rounded-full">
     <button className="join-item btn btn-ghost btn-xs sm:btn-xs p-2 sm:p-1" onClick={...}>
       <ArrowBigUp size={iconSize} />
     </button>
     <span className="join-item flex items-center px-0.5 text-xs font-bold">
       {formatScore(score)}
     </span>
     <button className="join-item btn btn-ghost btn-xs sm:btn-xs p-2 sm:p-1" onClick={...}>
       <ArrowBigDown size={iconSize} />
     </button>
   </div>

   DaisyUI btn ensures minimum tap target sizing.

4. Title text:
   Mobile: allow 2 lines (line-clamp-2) for readability
   Desktop: keep 1 line (line-clamp-1) for compactness
   Change: "text-sm font-medium text-base-content line-clamp-2 sm:line-clamp-1"

5. Touch feedback:
   Add active: state to article:
   "hover:bg-base-300 active:bg-base-300"
```

**Acceptance criteria:**
- Post actions always visible on mobile (not hover-dependent)
- Vote buttons easily tappable
- Thumbnails slightly smaller on mobile
- Titles can wrap to 2 lines on mobile
- Touch produces visual feedback

---

## Task M3.3: PostActions mobile adaptation with DaisyUI

**Modify file:** `src/components/post/PostActions.tsx` (created in webapp Phase 1)

```
Current spec: inline row of text buttons (Comments, Share, Save, Hide, More).
On mobile 375px: "136 Comments" + "Share" + "Save" + "Hide" + "..." may overflow.

Changes:

1. Use DaisyUI btn-ghost btn-sm for consistent action buttons:
   <button className="btn btn-ghost btn-sm gap-1 text-[#818384]">
     <MessageSquare size={16} />
     <span className="hidden sm:inline">{commentCount} Comments</span>
     <span className="sm:hidden">{commentCount}</span>
   </button>

   For Share, Save, Hide — hide text on mobile:
   <button className="btn btn-ghost btn-sm gap-1 text-[#818384]">
     <Share2 size={16} />
     <span className="hidden sm:inline">Share</span>
   </button>

2. "More" button: use DaisyUI dropdown for overflow actions:
   <div className="dropdown dropdown-end">
     <div tabIndex={0} role="button" className="btn btn-ghost btn-sm btn-circle text-[#818384]">
       <MoreHorizontal size={16} />
     </div>
     <ul tabIndex={-1} className="dropdown-content menu bg-base-100 rounded-box z-10 w-40 p-2 shadow-lg border border-neutral">
       <li><button><Save size={16} /> Save</button></li>
       <li><button><EyeOff size={16} /> Hide</button></li>
       <li><button><Flag size={16} /> Report</button></li>
     </ul>
   </div>
```

**Acceptance criteria:**
- At 375px: action row fits without overflow
- Icons visible, text labels hidden on mobile
- Each action button tappable (DaisyUI btn handles sizing)
- More menu opens as dropdown on all screen sizes

---

## Task M3.4: FeedContainer edge-to-edge mobile layout

**Modify file:** `src/components/feed/FeedContainer.tsx` (created in webapp Phase 1)

```
Current spec: wraps posts in bordered, rounded container.
On mobile: remove border/rounding for edge-to-edge card-less feel.

Changes:

1. Container styling:
   FROM: "border border-border-default rounded-md bg-canvas divide-y divide-border-default"
   TO: "border-0 sm:border sm:border-neutral sm:rounded-box bg-base-200 divide-y divide-neutral"

2. Empty state: no changes needed (centered text works at any width)
```

**Acceptance criteria:**
- At `<640px`: feed items are edge-to-edge with divider lines only
- At `>=640px`: feed has border and rounded corners (desktop behavior)
- No visual gap between feed and screen edges on mobile

---

## Task M3.5: Home page layout responsive fix

**Modify file:** `src/app/page.tsx`

```
Current: <div className="flex gap-4"> wraps feed + RightSidebar.
RightSidebar is hidden lg:block, but gap-4 still applies padding on mobile.

Changes:

1. Remove gap on mobile:
   FROM: "flex gap-4"
   TO: "flex gap-0 lg:gap-4"

2. Feed takes full width on mobile (already does since RightSidebar hidden):
   No change needed — flex-1 min-w-0 handles it.
```

**Acceptance criteria:**
- No extra right padding from gap when RightSidebar is hidden on mobile
- Feed content area uses full available width on mobile
