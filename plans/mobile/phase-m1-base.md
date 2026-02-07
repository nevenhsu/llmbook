# PHASE M1 — Viewport + DaisyUI Drawer Navigation

> **STATUS: REFERENCE ONLY** — This phase has been implemented. The code exists in the codebase. Do not re-implement. Use this document only to understand existing architecture.
>
> **Prerequisites:** Read [_conventions.md](_conventions.md). Execute alongside or after webapp Phase 1.

## Task M1.1: Install DaisyUI and configure theme

**Purpose:** Install DaisyUI 5 as a Tailwind CSS plugin and configure the custom Reddit dark theme.

**Steps:**

1. Run `npm install daisyui@latest`

2. Replace `src/app/globals.css` with the full CSS from `_conventions.md` (includes `@plugin "daisyui"`, custom "redditdark" theme, base styles, and scrollbar-hide utility).

3. Verify `npm run build` succeeds and existing pages render correctly.

**Notes:**
- DaisyUI 5 uses `@plugin "daisyui"` in CSS — no `tailwind.config.ts` changes needed.
- The custom theme maps base-100/base-200/base-300 to surface/canvas/highlight tokens.
- Existing Tailwind utility classes (`bg-[#1A1A1B]`, `text-[#D7DADC]`) continue to work alongside DaisyUI classes (`bg-base-100`, `text-base-content`).
- DaisyUI adds zero JavaScript — it's pure CSS class names.

**Acceptance criteria:**
- `daisyui` in `package.json` dependencies
- DaisyUI classes work: a `<button class="btn">Test</button>` renders styled
- Custom theme active: `bg-base-200` renders as #030303 (canvas)
- No visual regression on existing pages
- `npm run build` succeeds

---

## Task M1.2: Mobile viewport and base responsive padding

**Purpose:** Ensure proper viewport rendering and add mobile-safe padding.

**Modify file:** `src/app/layout.tsx`

```
1. Verify <meta name="viewport"> exists in <head> (Next.js adds automatically, but confirm)

2. The globals.css from M1.1 already includes:
   html { -webkit-text-size-adjust: 100%; touch-action: manipulation; }
   .scrollbar-hide utilities

3. Change root layout main content padding:
   FROM: className="min-w-0 flex-1 py-4 lg:px-4"
   TO:   className="min-w-0 flex-1 py-4 px-4 lg:px-6"

4. Change outer container:
   FROM: className="mx-auto flex max-w-[1600px] justify-center px-0 lg:px-4"
   TO:   className="mx-auto flex max-w-[1200px] justify-center px-0 lg:px-4"
```

**Acceptance criteria:**
- At 375px width: main content has 16px horizontal padding
- At 1024px+: main content has 24px horizontal padding
- No horizontal overflow on any page at 375px
- Text size doesn't auto-adjust on iOS

---

## Task M1.3: DaisyUI drawer layout for mobile navigation

**Purpose:** Wrap the entire app shell in a DaisyUI drawer so the LeftSidebar content becomes a slide-out drawer on mobile and stays visible as a sidebar on desktop.

**Restructure `src/app/layout.tsx` to use DaisyUI drawer pattern:**

```tsx
// The DaisyUI drawer wraps the ENTIRE page shell.
// On desktop (lg+): drawer-side is always visible (lg:drawer-open).
// On mobile (<lg): drawer-side is hidden, toggle via checkbox.
//
// <html lang="en" data-theme="redditdark">
//   <body className="min-h-screen bg-base-200 text-base-content">
//     <div className="drawer lg:drawer-open">
//       <input id="mobile-drawer" type="checkbox" className="drawer-toggle" />
//
//       {/* Main content area */}
//       <div className="drawer-content flex flex-col">
//         <Header user={user} />
//         <div className="pt-16">
//           <div className="mx-auto flex max-w-[1200px] justify-center px-0 lg:px-4">
//             <main className="min-w-0 flex-1 py-4 px-4 lg:px-6">
//               {children}
//             </main>
//           </div>
//         </div>
//       </div>
//
//       {/* Sidebar / Drawer */}
//       <div className="drawer-side z-40">
//         <label htmlFor="mobile-drawer" aria-label="close sidebar" className="drawer-overlay"></label>
//         <aside className="bg-base-200 min-h-full w-[270px] border-r border-neutral py-4">
//           <nav className="menu px-2">
//             <li>
//               <Link href="/" className="flex items-center gap-3">
//                 <Home size={20} /> Home
//               </Link>
//             </li>
//             <li>
//               <Link href="/popular" className="flex items-center gap-3">
//                 <TrendingUp size={20} /> Popular
//               </Link>
//             </li>
//
//             <li className="menu-title text-xs font-semibold uppercase text-[#818384] mt-4">
//               Communities
//             </li>
//             {boards.map(board => (
//               <li key={board.slug}>
//                 <Link href={`/boards/${board.slug}`} className="flex items-center gap-3">
//                   <div className="h-6 w-6 rounded-full bg-base-300 flex items-center justify-center text-xs">r/</div>
//                   r/{board.name}
//                 </Link>
//               </li>
//             ))}
//
//             <div className="divider my-2"></div>
//
//             <li>
//               <Link href="/about">About Persona Sandbox</Link>
//             </li>
//           </nav>
//         </aside>
//       </div>
//     </div>
//   </body>
// </html>
```

**Key points:**
- `lg:drawer-open` makes the sidebar permanently visible on desktop — no JavaScript needed
- On mobile, the checkbox `#mobile-drawer` toggles visibility — DaisyUI handles this with pure CSS
- `drawer-overlay` adds a semi-transparent backdrop on mobile
- The `<aside>` uses DaisyUI `menu` class for consistent nav item styling and built-in active states
- Remove the separate `<LeftSidebar />` component — its content is now in the drawer-side

**Modify file:** `src/components/layout/Header.tsx`

```
Add hamburger toggle button, visible only on mobile:

Before the Logo Section, add:
  <label
    htmlFor="mobile-drawer"
    className="btn btn-ghost btn-circle lg:hidden"
    aria-label="Open navigation"
  >
    <Menu size={24} />
  </label>

The label's htmlFor="mobile-drawer" toggles the DaisyUI drawer checkbox.
No JavaScript state management needed — it's pure CSS.
```

**Modify file:** `src/app/layout.tsx`

```
Fetch boards list server-side (for drawer content):
  const { data: boards } = await supabase.from('boards').select('name, slug').order('name');
```

**Acceptance criteria:**
- At `<1024px`: hamburger icon visible in header, sidebar hidden
- At `>=1024px`: hamburger icon hidden, sidebar always visible (no toggle needed)
- Tapping hamburger opens drawer from left with board navigation
- Tapping overlay closes drawer
- Drawer content: Home, Popular, board list, About
- All nav links have 44px+ tap targets (DaisyUI menu items meet this by default)
- `npm run build` succeeds

---

## Task M1.4: Remove standalone LeftSidebar component

**Purpose:** The LeftSidebar content is now integrated into the DaisyUI drawer in layout.tsx. Remove the standalone component.

**Delete file:** `src/components/layout/LeftSidebar.tsx`

**Modify file:** `src/app/layout.tsx`

```
Remove LeftSidebar import and usage.
The drawer-side section in the drawer (from M1.3) replaces LeftSidebar entirely.
```

**Acceptance criteria:**
- LeftSidebar.tsx is deleted
- No import errors
- Desktop sidebar still shows (via lg:drawer-open)
- Mobile drawer still works
- `npm run build` succeeds
