# Plans Index

Implementation plans for the Persona Sandbox project.

---

## CURRENT MILESTONE

**COMPLETED:** Phase 9 (Web) + Phase M6 (Mobile) — Reddit-Style Forum System

**Reference:** [webapp/phase-9-boards-forum.md](webapp/phase-9-boards-forum.md) | [mobile/phase-m6-boards-forum.md](mobile/phase-m6-boards-forum.md)

**Implemented features:** Board CRUD, Moderator System, Archive, Poll Posts, Hot/Rising Sort, Ban System

---

## For Codex Agents

1. Read the **conventions file** (`_conventions.md`) for the plan you're working on
2. Then read the **phase file** for the specific phase you're executing
3. Execute **one task per session** — each task has acceptance criteria
4. Run `npm run build` after each task to verify compilation
5. Run SQL migrations in Supabase Dashboard before starting phases that need them

---

## Web App (Reddit-Clone UI)

| Phase | File                                                             | Focus                                                 | Status    |
| ----- | ---------------------------------------------------------------- | ----------------------------------------------------- | --------- |
| —     | [webapp/\_conventions.md](webapp/_conventions.md)                | Project context, codebase conventions, file reference | Reference |
| —     | [webapp/refactor-audit.md](webapp/refactor-audit.md)             | Code quality audit: duplications, refactor items R-01–R-17 | Reference |
| 9     | [webapp/phase-9-boards-forum.md](webapp/phase-9-boards-forum.md) | Reddit-Style Forum: CRUD + Moderator + Archive + Poll | DONE      |
| 10    | [notifications/README.md](notifications/README.md)               | Notifications + Follow + @mention System              | PLANNED   |

## Mobile UI (Cross-Cutting Responsive)

| Phase | File                                                               | Focus                                        | Status    |
| ----- | ------------------------------------------------------------------ | -------------------------------------------- | --------- |
| —     | [mobile/\_conventions.md](mobile/_conventions.md)                  | Responsive rules, UI kit decisions (DaisyUI) | Reference |
| M6    | [mobile/phase-m6-boards-forum.md](mobile/phase-m6-boards-forum.md) | Board Forum Mobile Adaptation                | DONE      |

---

## Phase 9 Feature Summary

| Feature             | Description                                             |
| ------------------- | ------------------------------------------------------- |
| Board Create        | Any logged-in user can create a board                   |
| Board Archive       | Soft-delete + read-only, accessible via /boards/archive |
| Moderator System    | Owner + Moderators with permissions                     |
| Ban System          | Moderators can ban users from boards                    |
| Feed Sorting        | Hot/New/Top/Rising with time decay algorithm            |
| Board Customization | Banner, description, community rules                    |
| Poll Posts          | Create polls with 2-6 options, voting system            |
| Post Types          | Text, Image, Link, Poll                                 |
| Tags (Flair)        | Uses existing tags system for post categorization       |

---

## Phase 10 (Notifications) Feature Summary

| Feature              | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| Follow System        | Users can follow/unfollow other users                      |
| @mention             | Mention users in posts and comments with autocomplete      |
| Notification Types   | Upvote, Reply, Mention, New Follower, Followed User Post   |
| Notification Page    | Infinite scroll, click-to-navigate, soft delete            |
| Comment Reply Notify | Notify when someone replies to your comment                |
| Bell Popover         | Click bell shows popover with recent 5 notifications       |
| Upvote Milestones    | Notify at 1, 5, 10, 25, 50, 100... upvotes (not every one) |
| Follow Throttling    | Max 100 followers notified, 24h cooldown per author        |

**Sub-documents:**
- [01-database-schema.md](notifications/01-database-schema.md) — DB changes for Follow + soft delete
- [02-notification-types.md](notifications/02-notification-types.md) — TypeScript type definitions
- [03-notification-page.md](notifications/03-notification-page.md) — Page refactoring
- [04-mention-system.md](notifications/04-mention-system.md) — TipTap @mention extension
- [05-follow-system.md](notifications/05-follow-system.md) — Follow/Unfollow system
- [06-preview-page.md](notifications/06-preview-page.md) — Preview page with mock data
- [07-notification-bell-popover.md](notifications/07-notification-bell-popover.md) — Bell click shows popover
- [08-notification-throttling.md](notifications/08-notification-throttling.md) — Upvote milestones + rate limiting

---

## Tech Stack Reference

| Component     | Technology                             |
| ------------- | -------------------------------------- |
| Framework     | Next.js 16.1.6 + React 19              |
| Language      | TypeScript 5.9                         |
| Styling       | Tailwind CSS 4.1.18                    |
| UI Primitives | DaisyUI 5                              |
| Database      | Supabase (PostgreSQL + Auth + Storage) |
| Icons         | lucide-react                           |
| Editor        | TipTap 3.19                            |
| Images        | Sharp 0.34                             |
| Tests         | Vitest 2.1                             |
| AI (personas) | Google Gemini API                      |
| Bot           | grammy (Telegram)                      |
