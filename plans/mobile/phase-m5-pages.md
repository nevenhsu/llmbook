# PHASE M5 — Create Post + Search + Profile + Boards

> **Prerequisites:** Complete M1–M4. Read [_conventions.md](_conventions.md). Execute alongside or after webapp Phases 5–7.

## Task M5.1: Create post page mobile adaptation

**Modify file:** `src/components/create-post/CreatePostForm.tsx`

```
Changes:

1. Tab bar: use DaisyUI tabs with horizontal scroll:
   <div role="tablist" className="tabs tabs-bordered overflow-x-auto scrollbar-hide mb-6">
     <button
       role="tab"
       className={`tab whitespace-nowrap ${activeTab === 'text' ? 'tab-active' : ''}`}
       onClick={() => setActiveTab('text')}
     >
       Text
     </button>
     <button role="tab" className={`tab whitespace-nowrap ${activeTab === 'media' ? 'tab-active' : ''}`} ...>
       Images & Video
     </button>
     <button role="tab" className={`tab whitespace-nowrap ${activeTab === 'link' ? 'tab-active' : ''}`} ...>
       Link
     </button>
     <button role="tab" className="tab whitespace-nowrap opacity-50" disabled>
       Poll
     </button>
   </div>

   DaisyUI tabs-bordered gives underline indicator on active tab.

2. Media upload area: reduce height on mobile:
   FROM: "h-64"
   TO: "h-40 sm:h-64"

3. Submit bar: sticky bottom on mobile:
   FROM: <div className="mt-6 flex justify-end gap-2">
   TO: <div className="mt-6 flex justify-end gap-2 sm:relative fixed bottom-0 left-0 right-0 sm:left-auto sm:right-auto bg-base-200 border-t border-neutral sm:border-0 p-3 sm:p-0 z-40">

   Add bottom padding to form container on mobile to prevent content hiding behind sticky bar:
   <div className="mx-auto max-w-[740px] pb-20 sm:pb-10">

4. Buttons: use DaisyUI btn:
   Save Draft: className="btn btn-ghost btn-sm rounded-full"
   Post:       className="btn btn-primary btn-sm rounded-full"

5. Community selector: verify it works on 375px.
   If board name is long, ensure the pill wraps gracefully.
```

**Acceptance criteria:**
- Create post form usable at 375px
- DaisyUI tabs scroll horizontally if needed
- Submit button accessible as sticky bottom bar on mobile
- Media upload area appropriately sized

---

## Task M5.2: RichTextEditor mobile adaptation

**Modify file:** `src/components/create-post/RichTextEditor.tsx`

```
TipTap editor toolbar may overflow on mobile.

Changes:

1. Toolbar: wrap into scrollable row:
   <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide border-b border-neutral px-2 py-1">
     {toolbarButtons}
   </div>

2. Toolbar buttons: use DaisyUI btn for consistent sizing:
   <button className="btn btn-ghost btn-xs btn-square">
     <Bold size={16} />
   </button>

3. Editor content area: ensure comfortable mobile height:
   className="min-h-[120px] sm:min-h-[200px] p-3 text-sm"
```

**Acceptance criteria:**
- Toolbar scrolls horizontally without breaking layout
- Editor content area usable for typing on mobile
- Toolbar buttons accessible via scroll

---

## Task M5.3: Search results page mobile adaptation

**Modify file:** `src/app/search/page.tsx` (created in webapp Phase 5)

```
Phase 5 spec: search results with tabs for Posts/Communities/People.

Mobile changes:

1. Result tabs: use DaisyUI tabs with scroll:
   <div role="tablist" className="tabs tabs-bordered overflow-x-auto scrollbar-hide">
     <button role="tab" className={`tab whitespace-nowrap ${activeTab === 'posts' ? 'tab-active' : ''}`}>
       Posts
     </button>
     <button role="tab" className={`tab whitespace-nowrap ${activeTab === 'communities' ? 'tab-active' : ''}`}>
       Communities
     </button>
     <button role="tab" className={`tab whitespace-nowrap ${activeTab === 'people' ? 'tab-active' : ''}`}>
       People
     </button>
   </div>

2. Search results: full-width cards (same edge-to-edge pattern as feed):
   No horizontal margin on mobile.

3. Search input at top of results page:
   Full-width on mobile: "w-full px-4"
```

**Acceptance criteria:**
- Search results tabs scroll horizontally on mobile (DaisyUI tabs)
- Result items full-width on mobile
- Search input usable at 375px

---

## Task M5.4: Profile page mobile adaptation

**Modify file:** `src/app/profile/page.tsx` (rewritten in webapp Phase 6)

```
Phase 6 spec: profile with karma, Overview/Posts/Comments/Saved tabs, PostRow lists.

Mobile changes:

1. Profile header: stack vertically on mobile:
   <div className="flex flex-col items-center sm:flex-row sm:items-start gap-4">
     <Avatar size="lg" ... />
     <div className="text-center sm:text-left">
       <h1 className="text-xl font-bold">{displayName}</h1>
       <p className="text-[#818384] text-sm">u/{username}</p>
     </div>
   </div>

2. Stats row: use DaisyUI stats component for clean layout:
   <div className="stats shadow bg-base-100 w-full sm:w-auto mt-4">
     <div className="stat place-items-center sm:place-items-start">
       <div className="stat-title">Karma</div>
       <div className="stat-value text-lg">{karma}</div>
     </div>
     <div className="stat place-items-center sm:place-items-start">
       <div className="stat-title">Posts</div>
       <div className="stat-value text-lg">{postCount}</div>
     </div>
     <div className="stat place-items-center sm:place-items-start">
       <div className="stat-title">Joined</div>
       <div className="stat-value text-lg">{joinDate}</div>
     </div>
   </div>

   DaisyUI stats component renders as horizontal row on desktop and stacks on mobile.
   Override with: className="stats stats-vertical sm:stats-horizontal"

3. Profile tabs: DaisyUI tabs with horizontal scroll:
   <div role="tablist" className="tabs tabs-bordered overflow-x-auto scrollbar-hide mt-6">
     {['Overview', 'Posts', 'Comments', 'Saved'].map(tab => (
       <button key={tab} role="tab" className={`tab whitespace-nowrap ${activeTab === tab ? 'tab-active' : ''}`}>
         {tab}
       </button>
     ))}
   </div>

4. Tab content: PostRow list — already mobile-adapted in M3.
```

**Acceptance criteria:**
- Profile header stacks vertically on mobile, horizontal on desktop
- Stats display cleanly using DaisyUI stats component
- Tabs scroll horizontally (DaisyUI tabs)
- Post lists use mobile PostRow treatment from M3

---

## Task M5.5: Board page mobile adaptation

**Modify file:** `src/app/boards/[slug]/page.tsx` (rewritten in webapp Phase 7)

```
Phase 7 spec: board header, join button, FeedSortBar, compact PostRow feed, board info sidebar.

Mobile changes:

1. Board header banner: full-width, reduced height on mobile:
   className="w-full h-[120px] sm:h-[200px] bg-base-100 rounded-none sm:rounded-t-box overflow-hidden"

2. Board info: on mobile, show inline below banner instead of sidebar:
   <div className="lg:hidden px-4 py-3 border-b border-neutral">
     <div className="flex items-center justify-between">
       <div>
         <h1 className="text-lg font-bold text-base-content">r/{boardName}</h1>
         <p className="text-xs text-[#818384]">{memberCount} members</p>
       </div>
       <button className="btn btn-primary btn-sm rounded-full">
         {isMember ? 'Joined' : 'Join'}
       </button>
     </div>
     {description && (
       <p className="mt-2 text-sm text-[#818384] line-clamp-2">{description}</p>
     )}
   </div>

3. Feed: same treatment as home feed — edge-to-edge, no gap.

4. FeedSortBar: already responsive from M3.1.
```

**Acceptance criteria:**
- Board page renders cleanly at 375px
- Board info visible inline on mobile (not hidden in sidebar)
- Join button accessible and tappable (DaisyUI btn)
- Feed uses mobile treatment from M3

---

## Task M5.6: Notification bell mobile adaptation

**Modify file:** `src/components/notification/NotificationBell.tsx` (created in webapp Phase 7)

```
Phase 7 spec: bell icon in header with unread count badge, dropdown with notification list.

Mobile changes:

1. Bell icon: use DaisyUI indicator for badge:
   <div className="indicator">
     <span className="indicator-item badge badge-primary badge-xs">{unreadCount}</span>
     <button className="btn btn-ghost btn-circle">
       <Bell size={22} />
     </button>
   </div>

   DaisyUI indicator positions the badge count in the top-right corner.

2. Notification list: use DaisyUI modal on mobile, dropdown on desktop.
   Mobile (<md):
     <dialog className="modal modal-bottom">
       <div className="modal-box bg-base-200 max-h-[80dvh]">
         <div className="flex items-center justify-between mb-4">
           <span className="font-bold text-base-content">Notifications</span>
           <button className="btn btn-ghost btn-xs text-accent">Mark all read</button>
         </div>
         <ul className="menu p-0">
           {notifications.map(n => (
             <li key={n.id}>
               <a className="flex flex-col items-start gap-1 py-3">
                 <span className="text-sm">{n.message}</span>
                 <span className="text-xs text-[#818384]">{n.time}</span>
               </a>
             </li>
           ))}
         </ul>
       </div>
       <form method="dialog" className="modal-backdrop"><button>close</button></form>
     </dialog>

   Desktop (md+): use DaisyUI dropdown:
     <div className="dropdown dropdown-end hidden md:block">
       ... trigger + dropdown-content ...
     </div>

3. Use responsive classes to show/hide the correct trigger:
   "md:hidden" for modal trigger, "hidden md:block" for dropdown trigger.
```

**Acceptance criteria:**
- At `<768px`: tapping bell opens bottom modal (DaisyUI modal-bottom)
- At `>=768px`: tapping bell opens dropdown
- Unread badge uses DaisyUI indicator
- Notification items are tappable and readable on mobile

---

## Task M5.7: Login and Register pages mobile adaptation

**Modify files:** `src/app/login/login-form.tsx`, `src/app/register/register-form.tsx`

```
Changes:

1. Form container: ensure full-width on mobile:
   className="max-w-[400px] w-full mx-auto px-4 sm:px-0"

2. Input fields: use DaisyUI input class:
   <input className="input input-bordered w-full bg-base-100 border-neutral" />
   DaisyUI input has built-in comfortable height (~48px).

3. Submit buttons: use DaisyUI btn:
   <button className="btn btn-primary w-full rounded-full">
     Log In
   </button>

4. Links (forgot password, sign up): adequate tap targets:
   <Link className="link link-accent text-sm py-2 inline-flex items-center min-h-[44px]">
     Don't have an account? Sign up
   </Link>

   DaisyUI `link` class gives consistent link styling.
```

**Acceptance criteria:**
- Login/Register forms centered and usable at 375px
- All inputs and buttons have comfortable tap targets (DaisyUI defaults)
- No horizontal overflow
