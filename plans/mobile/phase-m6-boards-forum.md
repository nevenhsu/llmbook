# PHASE M6 — Boards Forum Mobile Adaptation

> **Prerequisites:** Complete M1–M5. Read [_conventions.md](_conventions.md). Execute alongside or after webapp Phase 9.
>
> **Applies to webapp Phase 9:** Board Create, Board Settings, Archive Boards, Poll Posts, Enhanced Feed Sorting

---

## Task M6.1: Create Board Page Mobile Adaptation

**Modify file:** `src/app/boards/create/page.tsx`

```
Mobile changes:

1. Form container: full-width on mobile:
   className="max-w-[600px] w-full mx-auto px-4 sm:px-6"

2. Input fields: use DaisyUI input for consistent sizing:
   <input className="input input-bordered w-full bg-base-100 border-neutral" />

3. Banner/Icon upload areas: stack vertically on mobile:
   <div className="flex flex-col sm:flex-row gap-4">
     <div className="w-full sm:w-1/2">Banner upload...</div>
     <div className="w-full sm:w-1/2">Icon upload...</div>
   </div>

4. Rules editor: compact on mobile:
   - Each rule in a DaisyUI collapse component
   - "Add Rule" button full-width on mobile
   <button className="btn btn-outline btn-sm w-full sm:w-auto">Add Rule</button>

5. Submit button: sticky bottom on mobile:
   <div className="fixed bottom-0 left-0 right-0 sm:relative bg-base-200 border-t border-neutral p-3 sm:p-0 sm:border-0 z-40">
     <button className="btn btn-primary w-full sm:w-auto rounded-full">Create Board</button>
   </div>

   Add bottom padding to form: className="pb-20 sm:pb-6"
```

**Acceptance criteria:**
- Create board form usable at 375px
- File upload areas don't overflow
- Sticky submit button on mobile
- DaisyUI components for consistent styling

---

## Task M6.2: Board Settings Page Mobile Adaptation

**Modify file:** `src/app/boards/[slug]/settings/page.tsx`

```
Mobile changes:

1. Tab navigation: use DaisyUI tabs with horizontal scroll:
   <div role="tablist" className="tabs tabs-bordered overflow-x-auto scrollbar-hide mb-6">
     <button role="tab" className={`tab whitespace-nowrap ${activeTab === 'general' ? 'tab-active' : ''}`}>
       General
     </button>
     <button role="tab" className="tab whitespace-nowrap">Rules</button>
     <button role="tab" className="tab whitespace-nowrap">Moderators</button>
     <button role="tab" className="tab whitespace-nowrap">Danger Zone</button>
   </div>

2. Moderator list: card layout on mobile:
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
     {moderators.map(mod => (
       <div className="card bg-base-100 p-3 flex items-center gap-3">
         <Avatar size="sm" />
         <div className="flex-1 min-w-0">
           <p className="truncate">{mod.display_name}</p>
           <span className="badge badge-ghost badge-xs">{mod.role}</span>
         </div>
         <button className="btn btn-ghost btn-xs">Remove</button>
       </div>
     ))}
   </div>

3. Ban list: similar card layout with expiry date visible

4. Danger Zone: full-width button with prominent warning:
   <div className="alert alert-error">
     <span>Archiving is permanent and will make this board read-only.</span>
   </div>
   <button className="btn btn-error w-full mt-4">Archive Board</button>

5. Archive confirmation: use DaisyUI modal-bottom on mobile:
   <dialog className="modal modal-bottom sm:modal-middle">
     <div className="modal-box">
       <h3 className="font-bold text-lg">Archive r/{boardName}?</h3>
       <p className="py-4">This action cannot be undone.</p>
       <div className="modal-action">
         <button className="btn btn-ghost">Cancel</button>
         <button className="btn btn-error">Archive</button>
       </div>
     </div>
   </dialog>
```

**Acceptance criteria:**
- Settings tabs scroll horizontally (DaisyUI tabs)
- Moderator/ban lists readable on mobile
- Danger zone warnings prominent
- Modal slides up from bottom on mobile

---

## Task M6.3: Archive Boards Page Mobile Adaptation

**Modify file:** `src/app/boards/archive/page.tsx`

```
Mobile changes:

1. Page header: compact on mobile:
   <h1 className="text-xl sm:text-2xl font-bold mb-4">Archived Boards</h1>

2. Board list: full-width cards:
   <div className="divide-y divide-neutral">
     {boards.map(board => (
       <div className="py-4 px-4 sm:px-0">
         <div className="flex items-center gap-3">
           <Avatar src={board.icon_url} fallback={board.name[0]} size="md" />
           <div className="flex-1 min-w-0">
             <h2 className="font-medium truncate">r/{board.slug}</h2>
             <p className="text-xs text-[#818384]">
               {board.member_count} members · Archived {formatDate(board.archived_at)}
             </p>
           </div>
         </div>
         <p className="text-sm text-[#818384] mt-2 line-clamp-2">{board.description}</p>
         <Link 
           href={`/boards/${board.slug}`} 
           className="btn btn-outline btn-sm w-full mt-3"
         >
           View (Read-only)
         </Link>
       </div>
     ))}
   </div>

3. Empty state:
   <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
     <Archive size={48} className="text-[#818384] mb-4" />
     <p className="text-[#818384]">No archived boards</p>
   </div>

4. Pagination: sticky bottom on mobile with DaisyUI join:
   <div className="fixed bottom-0 left-0 right-0 sm:relative bg-base-200 border-t border-neutral p-3 sm:p-0 sm:border-0">
     <div className="join w-full sm:w-auto">
       <button className="join-item btn btn-sm flex-1 sm:flex-none">«</button>
       <button className="join-item btn btn-sm flex-1 sm:flex-none">Page {page}</button>
       <button className="join-item btn btn-sm flex-1 sm:flex-none">»</button>
     </div>
   </div>
```

**Acceptance criteria:**
- Archive page usable at 375px
- Board cards show key info without overflow
- Pagination accessible at bottom
- Empty state centered and clear

---

## Task M6.4: Archived Board Read-Only Banner Mobile

**Modify file:** `src/app/boards/[slug]/page.tsx`

```
Mobile changes for archived board banner:

1. Banner: full-width, compact on mobile:
   <div className="bg-warning/10 border-y sm:border sm:rounded-box border-warning px-4 py-3 mb-4">
     <div className="flex items-center gap-2">
       <Archive size={18} className="text-warning shrink-0" />
       <p className="text-sm text-warning">
         This community has been archived and is read-only
       </p>
     </div>
   </div>

2. Remove rounded corners on mobile (edge-to-edge):
   className="rounded-none sm:rounded-box"

3. Hide all interactive elements on archived boards:
   - Join button: hidden
   - Create post FAB: hidden
   - Comment forms: hidden
   - Reply buttons: hidden

   Use conditional rendering:
   {!board.is_archived && <CreatePostButton />}
```

**Acceptance criteria:**
- Archive banner visible and clear on mobile
- No interactive elements shown for archived boards
- Banner uses warning color scheme
- Edge-to-edge on mobile

---

## Task M6.5: Enhanced Feed Sort Bar Mobile

**Modify file:** `src/components/feed/FeedSortBar.tsx`

```
Mobile changes for Hot/New/Top/Rising:

1. Sort buttons: horizontal scroll on mobile:
   <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-4 sm:px-0 py-2">
     <button className={`btn btn-sm btn-ghost ${sort === 'hot' ? 'btn-active' : ''}`}>
       <Flame size={16} />
       <span className="hidden sm:inline ml-1">Hot</span>
     </button>
     <button className={`btn btn-sm btn-ghost ${sort === 'new' ? 'btn-active' : ''}`}>
       <Sparkles size={16} />
       <span className="hidden sm:inline ml-1">New</span>
     </button>
     <button className={`btn btn-sm btn-ghost ${sort === 'top' ? 'btn-active' : ''}`}>
       <TrendingUp size={16} />
       <span className="hidden sm:inline ml-1">Top</span>
     </button>
     <button className={`btn btn-sm btn-ghost ${sort === 'rising' ? 'btn-active' : ''}`}>
       <Rocket size={16} />
       <span className="hidden sm:inline ml-1">Rising</span>
     </button>
   </div>

2. Time period dropdown for Top: use DaisyUI dropdown:
   {sort === 'top' && (
     <div className="dropdown dropdown-end">
       <label tabIndex={0} className="btn btn-sm btn-ghost gap-1">
         {timePeriodLabel}
         <ChevronDown size={14} />
       </label>
       <ul tabIndex={0} className="dropdown-content menu bg-base-200 rounded-box w-40 shadow-lg">
         <li><a onClick={() => setTimePeriod('day')}>Today</a></li>
         <li><a onClick={() => setTimePeriod('week')}>This Week</a></li>
         <li><a onClick={() => setTimePeriod('month')}>This Month</a></li>
         <li><a onClick={() => setTimePeriod('year')}>This Year</a></li>
         <li><a onClick={() => setTimePeriod('all')}>All Time</a></li>
       </ul>
     </div>
   )}

3. Icon-only on mobile, icon+text on desktop:
   Use "hidden sm:inline" for labels
```

**Acceptance criteria:**
- Sort buttons fit on mobile (icon-only)
- Horizontal scroll if needed
- Time period dropdown works on touch
- Active state clearly visible

---

## Task M6.6: Poll Post Mobile Adaptation

**Modify file:** `src/components/post/PollDisplay.tsx`

```
Mobile changes:

1. Option cards: full-width, tap-friendly:
   <div className="space-y-2">
     {options.map(option => (
       <button
         key={option.id}
         onClick={() => handleVote(option.id)}
         disabled={hasVoted}
         className={`
           w-full text-left p-3 rounded-box border transition-all
           ${hasVoted ? 'border-neutral' : 'border-neutral hover:border-primary'}
           ${userVote === option.id ? 'border-primary bg-primary/10' : ''}
         `}
       >
         <div className="flex items-center justify-between gap-2">
           <span className="text-sm flex-1">{option.text}</span>
           {hasVoted && (
             <span className="text-xs text-[#818384]">
               {Math.round((option.vote_count / totalVotes) * 100)}%
             </span>
           )}
         </div>
         {hasVoted && (
           <div className="mt-2 h-1 bg-base-300 rounded-full overflow-hidden">
             <div 
               className="h-full bg-primary transition-all"
               style={{ width: `${(option.vote_count / totalVotes) * 100}%` }}
             />
           </div>
         )}
       </button>
     ))}
   </div>

2. Vote count and expiry: compact row:
   <div className="flex items-center justify-between text-xs text-[#818384] mt-3">
     <span>{totalVotes} votes</span>
     <span>{isExpired ? 'Voting closed' : `${timeRemaining} left`}</span>
   </div>

3. Touch feedback: use active:scale-[0.98] for tap feel
```

**Create Poll in CreatePostForm mobile:**

**Modify file:** `src/components/create-post/CreatePostForm.tsx`

```
Poll creation mobile changes:

1. Option inputs: full-width with remove button:
   <div className="space-y-2">
     {pollOptions.map((opt, idx) => (
       <div key={idx} className="flex gap-2">
         <input
           className="input input-bordered input-sm flex-1"
           placeholder={`Option ${idx + 1}`}
           value={opt}
           onChange={(e) => updateOption(idx, e.target.value)}
         />
         <button 
           className="btn btn-ghost btn-sm btn-square"
           onClick={() => removeOption(idx)}
         >
           <X size={16} />
         </button>
       </div>
     ))}
   </div>

2. Add option button: full-width on mobile:
   <button 
     className="btn btn-outline btn-sm w-full mt-2"
     onClick={addOption}
     disabled={pollOptions.length >= 6}
   >
     <Plus size={16} />
     Add Option
   </button>

3. Duration select: DaisyUI select:
   <select className="select select-bordered select-sm w-full mt-4">
     <option value="1">1 day</option>
     <option value="3">3 days</option>
     <option value="7">1 week</option>
   </select>
```

**Acceptance criteria:**
- Poll options tappable and readable on mobile
- Progress bars visible after voting
- Poll creation form usable at 375px
- Add/remove option buttons accessible

---

## Task M6.7: Board Info Sidebar Mobile Adaptation

**Modify file:** `src/app/boards/[slug]/page.tsx`

```
Board info on mobile: inline below header instead of sidebar

1. Board header section (mobile-first):
   <div className="lg:hidden">
     <!-- Mobile: inline board info -->
     <div className="px-4 py-3 border-b border-neutral">
       <div className="flex items-center gap-3">
         <Avatar src={board.icon_url} size="lg" />
         <div className="flex-1 min-w-0">
           <h1 className="text-lg font-bold truncate">r/{board.slug}</h1>
           <p className="text-xs text-[#818384]">{board.member_count} members</p>
         </div>
         <button className="btn btn-primary btn-sm rounded-full">
           {isMember ? 'Joined' : 'Join'}
         </button>
       </div>
       
       <!-- Expandable description -->
       <details className="mt-3">
         <summary className="text-sm text-accent cursor-pointer">About this community</summary>
         <p className="text-sm text-[#818384] mt-2">{board.description}</p>
       </details>
     </div>
     
     <!-- Rules drawer (optional, tap to expand) -->
     {board.rules?.length > 0 && (
       <details className="px-4 py-2 border-b border-neutral">
         <summary className="text-sm font-medium cursor-pointer">
           Community Rules ({board.rules.length})
         </summary>
         <ol className="list-decimal list-inside text-sm text-[#818384] mt-2 space-y-1">
           {board.rules.map((rule, idx) => (
             <li key={idx}>{rule.title}</li>
           ))}
         </ol>
       </details>
     )}
   </div>
   
   <!-- Desktop: sidebar -->
   <aside className="hidden lg:block w-[312px]">
     <BoardInfoCard board={board} />
     <BoardRulesCard rules={board.rules} />
     <BoardModeratorsCard moderators={moderators} />
   </aside>
```

**Modify file:** `src/components/board/BoardInfoCard.tsx`

```
Desktop card styling (already exists), ensure it uses:
- bg-base-100 rounded-box
- DaisyUI stat component for member count
- btn-primary rounded-full for Join button
```

**Acceptance criteria:**
- Board info visible inline on mobile
- Description expandable to save space
- Rules accessible via expandable section
- Desktop shows sidebar as normal
- Smooth transition between layouts

---

## Summary: All Modified Files

| Task | Modified Files |
|------|----------------|
| M6.1 | `src/app/boards/create/page.tsx` |
| M6.2 | `src/app/boards/[slug]/settings/page.tsx` |
| M6.3 | `src/app/boards/archive/page.tsx` |
| M6.4 | `src/app/boards/[slug]/page.tsx` |
| M6.5 | `src/components/feed/FeedSortBar.tsx` |
| M6.6 | `src/components/post/PollDisplay.tsx`, `src/components/create-post/CreatePostForm.tsx` |
| M6.7 | `src/app/boards/[slug]/page.tsx`, `src/components/board/BoardInfoCard.tsx` |
