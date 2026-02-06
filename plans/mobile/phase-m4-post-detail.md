# PHASE M4 — Post Detail + Comments

> **Prerequisites:** Complete M1, M3. Read [_conventions.md](_conventions.md). Execute alongside or after webapp Phase 3.

## Task M4.1: Post detail page mobile layout

**Modify file:** `src/app/posts/[id]/page.tsx` (rewritten in webapp Phase 3, Task 3.4)

```
Phase 3 spec layout:
  <div className="flex gap-4">
    <div className="flex-1 min-w-0"> ... post + comments ... </div>
    <aside className="hidden lg:block w-[312px]"> ... board info ... </aside>
  </div>

Mobile changes:

1. Remove gap on mobile (same pattern as home page):
   FROM: "flex gap-4"
   TO: "flex gap-0 lg:gap-4"

2. Board info card: on mobile, show as a collapsible section ABOVE comments
   instead of a sidebar. Use DaisyUI collapse:
   <div className="lg:hidden collapse collapse-arrow bg-base-100 border border-neutral rounded-box mb-4">
     <input type="checkbox" />
     <div className="collapse-title flex items-center justify-between">
       <Link href={`/boards/${boardSlug}`} className="font-bold text-sm text-base-content">
         r/{boardName}
       </Link>
       <span className="text-xs text-[#818384]">{memberCount} members</span>
     </div>
     <div className="collapse-content text-sm text-[#818384]">
       {description}
     </div>
   </div>

3. Post body: ensure long content doesn't overflow:
   Add to post body container: "break-words [overflow-wrap:anywhere]"

4. Media images: ensure viewport-bounded:
   <img className="max-w-full h-auto" />
   Already handled if using w-full, but verify no fixed-width images.

5. VotePill: always use horizontal orientation on post detail page.
   Matches Reddit mobile behavior.
```

**Acceptance criteria:**
- Post detail page renders cleanly at 375px
- No horizontal overflow from post body or media
- Board info visible on mobile as collapsible section (DaisyUI collapse)
- Vote buttons usable on mobile

---

## Task M4.2: Comment thread mobile indentation

**Modify file:** `src/components/comment/CommentItem.tsx` (created in webapp Phase 3)

```
Phase 3 spec: marginLeft = min(depth, 10) * 16px
At depth 5 on mobile: 80px indentation on 375px screen = only 295px for content.
At depth 10: 160px = only 215px — barely usable.

Mobile changes:

1. Reduce indent multiplier on mobile:
   Desktop: depth * 16px (existing)
   Mobile: depth * 8px
   Implementation (inline style — Tailwind can't do dynamic values):
     const indent = isMobile ? Math.min(depth, 6) * 8 : Math.min(depth, 10) * 16;
     style={{ marginLeft: `${indent}px` }}

   For isMobile detection, use a simple CSS approach instead of JS:
   Wrap in a container with two style variants:
     <div className="hidden sm:block" style={{ marginLeft: `${Math.min(depth, 10) * 16}px` }}>
       ... comment content ...
     </div>
     <div className="sm:hidden" style={{ marginLeft: `${Math.min(depth, 6) * 8}px` }}>
       ... comment content ...
     </div>
   OR simpler: use a single inline style and detect via window.innerWidth in a useEffect.

2. Reduce max depth threshold on mobile:
   Desktop: max depth 10, then "Continue this thread"
   Mobile: max depth 4, then "Continue this thread"
   This prevents deeply nested content from becoming unreadable.

3. Collapse bar tap target:
   Phase 3 uses a vertical line for collapse/expand.
   On mobile, increase hitbox width:
   <button
     className="w-5 sm:w-3 flex-shrink-0 flex justify-center cursor-pointer group"
     onClick={toggleCollapse}
     aria-label={isCollapsed ? 'Expand thread' : 'Collapse thread'}
   >
     <div className="w-0.5 h-full bg-neutral group-hover:bg-accent group-active:bg-accent" />
   </button>
   The button itself is 20px wide on mobile — wider tap area than the visual line.
```

**Acceptance criteria:**
- At 375px: comments at depth 4+ show "Continue this thread" link
- Indentation uses 8px per level on mobile (vs 16px desktop)
- Collapse line is tappable on touch devices
- Comment text remains readable at all visible depths

---

## Task M4.3: CommentForm mobile adaptation

**Modify file:** `src/components/comment/CommentForm.tsx` (created in webapp Phase 3)

```
Phase 3 spec: minimal textarea editor.

Mobile changes:

1. Textarea: use DaisyUI textarea class for consistent styling:
   <textarea
     className="textarea textarea-bordered w-full min-h-[80px] sm:min-h-[60px] text-sm bg-base-100 border-neutral focus:border-accent resize-y"
     placeholder="What are your thoughts?"
   />

2. Submit button: use DaisyUI btn:
   <button className="btn btn-primary btn-sm rounded-full">
     Comment
   </button>

3. Cancel button (for replies):
   <button className="btn btn-ghost btn-sm rounded-full">
     Cancel
   </button>

4. Reply form inline positioning: on mobile, when replying to a deeply nested comment,
   the form should NOT be indented further. Instead, indent at same level as parent comment.
```

**Acceptance criteria:**
- Comment textarea is comfortable to type in on mobile (min 80px height)
- Submit/Cancel buttons are easily tappable (DaisyUI btn default)
- Reply forms don't get pushed off-screen by indentation

---

## Task M4.4: CommentSort mobile adaptation with DaisyUI dropdown

**Modify file:** `src/components/comment/CommentSort.tsx` (created in webapp Phase 3)

```
Phase 3 spec: dropdown to select sort (Best, Top, New, Old, Controversial).

Mobile changes:

1. Use DaisyUI dropdown instead of custom dropdown:
   <div className="dropdown">
     <div tabIndex={0} role="button" className="btn btn-ghost btn-sm gap-1 text-[#818384]">
       Sort by: {currentSort} <ChevronDown size={14} />
     </div>
     <ul tabIndex={-1} className="dropdown-content menu bg-base-100 rounded-box z-10 w-44 p-2 shadow-lg border border-neutral">
       {sortOptions.map(opt => (
         <li key={opt.key}>
           <button onClick={() => onChange(opt.key)} className={opt.key === currentSort ? 'active' : ''}>
             {opt.label}
           </button>
         </li>
       ))}
     </ul>
   </div>

   DaisyUI menu items have built-in hover states and adequate tap target sizing.
   The `active` class on the selected item gives visual highlight.

2. DaisyUI dropdown auto-closes on click outside — no custom JS needed.
```

**Acceptance criteria:**
- Sort dropdown opens correctly on mobile without clipping
- All dropdown items tappable (DaisyUI menu default sizing)
- Selected sort shown in trigger button with visual active state
- Dropdown closes on selection or outside click
