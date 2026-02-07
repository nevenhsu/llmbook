# PHASE M2 — Header Adaptation + Mobile Search Modal

> **STATUS: REFERENCE ONLY** — This phase has been implemented. The code exists in the codebase. Do not re-implement. Use this document only to understand existing architecture.
>
> **Prerequisites:** Complete M1. Read [_conventions.md](_conventions.md). Execute alongside or after webapp Phase 1 and Phase 5.

## Task M2.1: Mobile search overlay using DaisyUI modal

**Purpose:** The desktop search bar is `hidden md:flex`. On mobile, provide a search icon that opens a full-screen search modal.

**Create file:** `src/components/search/MobileSearchOverlay.tsx`

```typescript
"use client";

// Uses DaisyUI modal for mobile search — zero JS framework dependency.
// Toggle via checkbox or dialog element.
//
// import { Search, X } from 'lucide-react'
// import { useState, useRef, useEffect } from 'react'
//
// export default function MobileSearchOverlay() {
//   const [query, setQuery] = useState('')
//   const inputRef = useRef<HTMLInputElement>(null)
//   const modalRef = useRef<HTMLDialogElement>(null)
//
//   function openModal() {
//     modalRef.current?.showModal()
//     // Auto-focus input after modal opens
//     setTimeout(() => inputRef.current?.focus(), 100)
//   }
//
//   return (
//     <>
//       {/* Trigger — visible on mobile only */}
//       <button
//         className="btn btn-ghost btn-circle md:hidden"
//         onClick={openModal}
//         aria-label="Search"
//       >
//         <Search size={20} />
//       </button>
//
//       {/* Modal — full screen on mobile */}
//       <dialog ref={modalRef} className="modal modal-top">
//         <div className="modal-box w-full max-w-full sm:max-w-lg rounded-none sm:rounded-box bg-base-200 p-0">
//           {/* Search header */}
//           <div className="flex items-center gap-2 border-b border-neutral px-4 py-3">
//             <Search size={20} className="text-[#818384] flex-shrink-0" />
//             <input
//               ref={inputRef}
//               type="text"
//               value={query}
//               onChange={e => setQuery(e.target.value)}
//               placeholder="Search..."
//               className="flex-1 bg-transparent text-base-content placeholder:text-[#818384] outline-none text-sm"
//             />
//             <form method="dialog">
//               <button className="btn btn-ghost btn-circle btn-sm">
//                 <X size={18} />
//               </button>
//             </form>
//           </div>
//
//           {/* Results area — wired in webapp Phase 5 */}
//           <div className="max-h-[calc(100dvh-60px)] overflow-y-auto p-4">
//             {query.length === 0 ? (
//               <p className="text-[#818384] text-sm text-center py-8">
//                 Type to search posts, communities, and people
//               </p>
//             ) : (
//               <p className="text-[#818384] text-sm text-center py-8">
//                 No results
//               </p>
//             )}
//           </div>
//         </div>
//
//         {/* Click outside to close */}
//         <form method="dialog" className="modal-backdrop">
//           <button>close</button>
//         </form>
//       </dialog>
//     </>
//   )
// }
```

**NOTE:** This is a UI shell. Actual search API wiring happens in webapp Phase 5. For now, show placeholder states.

**Acceptance criteria:**
- At `<768px`: search icon visible in header
- Tapping opens full-screen search modal with autofocused input
- Close via X button, Escape key, or tapping backdrop
- At `>=768px`: search icon hidden, desktop search bar shown (unchanged)

---

## Task M2.2: Header responsive refinements

**Purpose:** Ensure all header elements work at mobile widths with DaisyUI button classes.

**Modify file:** `src/components/layout/Header.tsx`

```
Changes:

1. Add MobileSearchOverlay alongside desktop search bar:
   {/* Desktop search */}
   <div className="hidden md:flex ...existing search bar..." />
   {/* Mobile search trigger */}
   <MobileSearchOverlay />

2. Replace icon button styling with DaisyUI btn classes for consistent 44px tap targets:
   FROM: className="rounded-full p-2 text-[#D7DADC] hover:bg-[#1A282D] transition-colors"
   TO:   className="btn btn-ghost btn-circle"

   This applies to: chat icon, create post button, notification bell.
   DaisyUI btn-circle gives consistent 48px tap targets by default.

3. Create post link: use DaisyUI btn:
   FROM: className="flex items-center gap-2 rounded-full px-3 py-2 text-[#D7DADC] hover:bg-[#1A282D]"
   TO:   className="btn btn-ghost gap-2"

4. Login button: use DaisyUI btn-primary:
   FROM: className="rounded-full bg-[#D93A00] px-6 py-1.5 text-sm font-semibold text-white"
   TO:   className="btn btn-primary btn-sm rounded-full"

5. Logo text: already "hidden lg:block" — OK for mobile
```

**Acceptance criteria:**
- At 375px: header fits without overflow, all icons accessible
- All buttons have 44px+ tap targets (DaisyUI btn default)
- Touch feedback built into DaisyUI btn classes (active state)
- Mobile search overlay accessible via icon

---

## Task M2.3: UserMenu mobile adaptation with DaisyUI dropdown

**Purpose:** UserMenu dropdown works on desktop but needs mobile treatment.

**Modify file:** `src/components/layout/UserMenu.tsx`

```
Replace custom dropdown with DaisyUI dropdown component.

Changes:

1. Use DaisyUI dropdown for both mobile and desktop:
   <div className="dropdown dropdown-end">
     <div tabIndex={0} role="button" className="btn btn-ghost gap-2">
       <img src={avatarUrl} alt="User Avatar" className="h-8 w-8 rounded-full object-cover" />
       <div className="hidden md:flex flex-col items-start text-xs">
         <span className="font-semibold text-base-content">{username}</span>
         <span className="text-[#818384]">1 karma</span>
       </div>
       <ChevronDown size={16} className="text-[#818384]" />
     </div>
     <ul tabIndex={-1} className="dropdown-content menu bg-base-100 rounded-box z-50 mt-2 w-64 p-2 shadow-lg border border-neutral">
       <li>
         <Link href="/profile" className="flex items-center gap-3">
           <User size={18} className="text-[#818384]" /> View Profile
         </Link>
       </li>
       <li>
         <Link href="/settings/profile" className="flex items-center gap-3">
           <Paintbrush size={18} className="text-[#818384]" /> Edit Avatar
         </Link>
       </li>
       <li>
         <button className="flex items-center gap-3">
           <Moon size={18} className="text-[#818384]" /> Display Mode
         </button>
       </li>
       <div className="divider my-0"></div>
       <li>
         <button onClick={handleSignOut} className="flex items-center gap-3">
           <LogOut size={18} className="text-[#818384]" /> Log Out
         </button>
       </li>
     </ul>
   </div>

2. DaisyUI dropdown auto-closes on click outside — no useRef/useEffect needed.
   Remove the custom click-outside listener.

3. Menu items use DaisyUI menu class — built-in padding and hover states.
   On mobile: DaisyUI menu items are already 44px+ height.
```

**Acceptance criteria:**
- Tapping avatar opens dropdown menu on all screen sizes
- All menu items have 44px+ tap targets
- Dropdown closes on click outside or item selection
- Sign out works correctly
- Remove custom click-outside JS — DaisyUI handles it
