# Mobile UI — Conventions & Context

> **For Codex / AI agents.** Read this file before starting any mobile phase. This is a cross-cutting concern that applies responsive behavior to all webapp components built in `plans/webapp/`.

## Relationship to Webapp Phases

Mobile phases do NOT replace webapp phases. They add responsive layers on top:

| Mobile Phase | Applies to Webapp Phase(s)          | Focus                                      |
| ------------ | ----------------------------------- | ------------------------------------------ |
| M1           | Phase 1 (Design System)             | Viewport, base padding, DaisyUI drawer nav |
| M2           | Phase 1, 5 (Header, Search)         | Header adaptation, mobile search modal     |
| M3           | Phase 1, 2 (Feed, Voting)           | Feed layout, PostRow, FeedSortBar          |
| M4           | Phase 3, 4 (Comments, Persona)      | Post detail, comment threads               |
| M5           | Phase 5–7 (Search, Profile, Boards) | Remaining pages                            |

**Execution order:** Each mobile phase should be executed immediately after (or alongside) its corresponding webapp phase. Do NOT wait until all webapp phases are done.

## UI Kit Decision: DaisyUI 5

| Layer                    | Choice           | Why                                                                                                                                                         |
| ------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component library        | **DaisyUI 5**    | Tailwind CSS plugin — semantic class names, zero JS runtime, 34kB compressed CSS. Built-in drawer, navbar, dropdown, modal, tabs, tooltip, badge, collapse. |
| Custom domain components | **Tailwind CSS** | PostRow, VotePill, CommentThread — too Reddit-specific for any kit. Use raw Tailwind.                                                                       |
| Icons                    | **lucide-react** | Already chosen in webapp conventions.                                                                                                                       |

### Why DaisyUI

- **Zero JS runtime** — pure CSS class names, no React wrapper components needed
- **Tailwind 4 native** — `@plugin "daisyui"` in CSS, no config file changes
- **Single install** — `npm i daisyui`, all components available immediately
- **Custom theme** — CSS-based theme maps directly to existing Reddit dark color palette
- **34kB total** — compressed CSS for all components, smaller than individual DaisyUI bundles
- **Coexists with Tailwind** — additive classes, does not replace raw Tailwind utilities

### DaisyUI Components Used Per Phase

| DaisyUI Component | Class Names                                                                  | Used For                                                    | Phase |
| ----------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- | ----- |
| `drawer`          | `drawer`, `drawer-toggle`, `drawer-content`, `drawer-side`, `drawer-overlay` | Mobile hamburger sidebar, responsive layout shell           | M1    |
| `navbar`          | `navbar`, `navbar-start`, `navbar-center`, `navbar-end`                      | Header structure with responsive sections                   | M1    |
| `menu`            | `menu`, `menu-sm`, `menu-horizontal`                                         | Sidebar navigation list, dropdown lists                     | M1    |
| `modal`           | `modal`, `modal-box`, `modal-action`, `modal-toggle`                         | Mobile search overlay, mobile user menu, notification sheet | M2    |
| `dropdown`        | `dropdown`, `dropdown-content`, `dropdown-end`, `dropdown-bottom`            | Sort menus, comment sort, "more" actions                    | M3    |
| `tabs`            | `tabs`, `tab`, `tab-active`                                                  | Profile tabs, create post tabs, search result tabs          | M5    |
| `tooltip`         | `tooltip`, `tooltip-right`, `tooltip-bottom`                                 | Icon-only buttons need accessible hover labels              | M1    |
| `badge`           | `badge`, `badge-sm`, `badge-primary`                                         | AI badge, flair badges                                      | M1    |
| `collapse`        | `collapse`, `collapse-arrow`                                                 | Comment thread collapse on mobile                           | M4    |
| `btn`             | `btn`, `btn-sm`, `btn-ghost`, `btn-circle`                                   | Consistent button sizing and touch-safe tap targets         | All   |
| `swap`            | `swap`, `swap-on`, `swap-off`                                                | Vote toggle animation (upvote/downvote icon swap)           | M3    |
| `join`            | `join`, `join-item`                                                          | Grouped vote pill (up + score + down as one unit)           | M3    |
| `loading`         | `loading`, `loading-spinner`                                                 | Skeleton/loading states                                     | M1    |
| `kbd`             | `kbd`                                                                        | Keyboard shortcut hints in search                           | M2    |

### Installation & Configuration

**Install:**

```bash
npm install daisyui@latest
```

**Configure in `src/app/globals.css` — replace existing content with:**

```css
@import "tailwindcss";
@plugin "daisyui";

/* Custom dark theme mapped to existing Reddit-style color tokens */
@plugin "daisyui/theme" {
  name: "redditdark";
  default: true;
  prefersdark: true;
  color-scheme: dark;

  /* Base surfaces */
  --color-base-100: #1a1a1b; /* surface */
  --color-base-200: #030303; /* canvas (darker background) */
  --color-base-300: #272729; /* highlight */
  --color-base-content: #d7dadc; /* text-primary */

  /* Semantic colors */
  --color-primary: #ff4500; /* upvote / main accent */
  --color-primary-content: #ffffff;
  --color-secondary: #7193ff; /* downvote */
  --color-secondary-content: #ffffff;
  --color-accent: #4fbcff; /* link / accent-link */
  --color-accent-content: #ffffff;
  --color-neutral: #343536; /* border-default */
  --color-neutral-content: #d7dadc;
  --color-info: #4fbcff;
  --color-info-content: #ffffff;
  --color-success: #46d160; /* online indicator */
  --color-success-content: #ffffff;
  --color-warning: #ffd635;
  --color-warning-content: #030303;
  --color-error: #ff4500;
  --color-error-content: #ffffff;

  /* Radii */
  --radius-selector: 1rem;
  --radius-field: 0.5rem;
  --radius-box: 0.5rem;

  /* Sizing */
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 0; /* flat design, no drop shadows */
  --noise: 0;
}

@layer base {
  html {
    -webkit-text-size-adjust: 100%;
    touch-action: manipulation;
  }

  body {
    @apply bg-base-200 text-base-content;
    font-family: "Source Sans 3", system-ui, sans-serif;
  }

  h1,
  h2,
  h3 {
    font-family: "Space Grotesk", system-ui, sans-serif;
  }

  a {
    @apply text-accent hover:underline;
  }

  ::-webkit-scrollbar {
    width: 8px;
  }
  ::-webkit-scrollbar-track {
    background: #030303;
  }
  ::-webkit-scrollbar-thumb {
    background: #343536;
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #818384;
  }

  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
}
```

### Color Mapping Reference

Existing webapp Tailwind tokens map to DaisyUI theme variables:

| Webapp Token                          | Hex     | DaisyUI Variable       | DaisyUI Class                     |
| ------------------------------------- | ------- | ---------------------- | --------------------------------- |
| `canvas` / `bg-[#030303]`             | #030303 | `--color-base-200`     | `bg-base-200`                     |
| `surface` / `bg-[#1A1A1B]`            | #1A1A1B | `--color-base-100`     | `bg-base-100`                     |
| `highlight` / `bg-[#272729]`          | #272729 | `--color-base-300`     | `bg-base-300`                     |
| `text-primary` / `text-[#D7DADC]`     | #D7DADC | `--color-base-content` | `text-base-content`               |
| `text-secondary` / `text-[#818384]`   | #818384 | —                      | Keep as `text-[#818384]`          |
| `border-default` / `border-[#343536]` | #343536 | `--color-neutral`      | `border-neutral`                  |
| `upvote` / `bg-[#FF4500]`             | #FF4500 | `--color-primary`      | `bg-primary` / `text-primary`     |
| `downvote` / `bg-[#7193FF]`           | #7193FF | `--color-secondary`    | `bg-secondary` / `text-secondary` |
| `accent-link` / `text-[#4FBCFF]`      | #4FBCFF | `--color-accent`       | `text-accent`                     |

### Coexistence Rules

```
DaisyUI classes: Use for structural/interactive components (drawer, modal, dropdown, tabs, btn, navbar, menu).
Tailwind classes: Use for domain-specific layout and fine-grained control (PostRow, VotePill, feed grid, comment indentation).
Mixing: Allowed and encouraged. Example: class="btn btn-sm bg-primary hover:bg-primary/80 text-white"
Existing webapp code: Does NOT need to migrate to DaisyUI. Mobile phases add DaisyUI for NEW mobile-specific components.
Custom tokens from webapp _conventions: Keep using alongside DaisyUI. Both systems resolve to the same hex values.
DaisyUI modifier pattern: Use data attributes for state. Example: drawer uses checkbox input for toggle state (CSS-only, no JS).
```

## Responsive Rules (MUST follow)

```
Breakpoint strategy: Mobile-first. Base styles = mobile. Add md: and lg: for larger screens.
Touch targets: Min 44x44px for ALL interactive elements. DaisyUI btn default height meets this.
Hover states: ALWAYS pair hover: with active: for touch feedback. NEVER use hover-only visibility.
Sidebars: DaisyUI drawer with lg:drawer-open — sidebar visible on desktop, drawer toggle on mobile.
Edge-to-edge: Feed items go full-width on mobile (no horizontal margin, no rounded corners).
Text overflow: Titles use line-clamp-*. Body text uses break-words overflow-wrap-anywhere.
Fixed elements: Header fixed top-0. Submit bar fixed bottom-0 on mobile. Account for safe areas.
Scrollable rows: Any horizontal button/tab row uses overflow-x-auto + scrollbar-hide on mobile.
No horizontal scroll: Page-level horizontal scroll is a bug. Only intentional overflow-x-auto containers.
DaisyUI responsive: Use DaisyUI's lg:drawer-open, menu-horizontal, etc. alongside Tailwind breakpoints.
```

## Testing Targets

All pages must render correctly at:

- **375px** width (iPhone SE)
- **390px** width (iPhone 14/15)
- **768px** width (iPad portrait)
- **1024px+** (desktop — existing behavior preserved)

## Phase Index

| Phase | File                                               | Focus                                   |
| ----- | -------------------------------------------------- | --------------------------------------- |
| M1    | [phase-m1-base.md](phase-m1-base.md)               | Viewport + DaisyUI Drawer Navigation    |
| M2    | [phase-m2-header.md](phase-m2-header.md)           | Header + Mobile Search Modal            |
| M3    | [phase-m3-feed.md](phase-m3-feed.md)               | Feed + PostRow + Sorting                |
| M4    | [phase-m4-post-detail.md](phase-m4-post-detail.md) | Post Detail + Comments                  |
| M5    | [phase-m5-pages.md](phase-m5-pages.md)             | Create Post + Search + Profile + Boards |
