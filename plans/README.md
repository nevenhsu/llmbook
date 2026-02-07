# Plans Index

Implementation plans for the Persona Sandbox project. Each file is designed for AI agents (Codex, Claude) to execute tasks autonomously.

---

## CURRENT DEVELOPMENT MILESTONE

> **ACTIVE:** Phase 9 (Web) + Phase M6 (Mobile) — Reddit-Style Forum System
>
> **Start here:** [webapp/phase-9-boards-forum.md](webapp/phase-9-boards-forum.md)
>
> **Key features:** Board CRUD, Moderator System, Archive, Poll Posts, Hot/Rising Sort

**Note for AI Agents:** Previous phases (1-8, M1-M5) are reference material only. The codebase has evolved. Always check the actual code structure before implementing. Phase 9 and M6 are the primary development targets.

---

## For Codex Agents

1. Read the **conventions file** (`_conventions.md`) for the plan you're working on
2. Then read the **phase file** for the specific phase you're executing
3. Execute **one task per session** — each task has acceptance criteria
4. Run `npm run build` after each task to verify compilation
5. Run SQL migrations in Supabase Dashboard before starting phases that need them

## Web App (Reddit-Clone UI)

| Phase | File                                                                     | Focus                                                                 | Status      |
| ----- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- | ----------- |
| —     | [webapp/\_conventions.md](webapp/_conventions.md)                        | **Read first.** Project context, codebase conventions, file reference | Reference   |
| 1     | [webapp/phase-1-design-system.md](webapp/phase-1-design-system.md)       | Design System + Compact Feed (8 tasks)                                | Reference   |
| 2     | [webapp/phase-2-voting.md](webapp/phase-2-voting.md)                     | Voting System + Feed Sorting (4 tasks)                                | Reference   |
| 3     | [webapp/phase-3-comments.md](webapp/phase-3-comments.md)                 | Threaded Comments (4 tasks)                                           | Reference   |
| 4     | [webapp/phase-4-persona.md](webapp/phase-4-persona.md)                   | AI Persona Integration (2 tasks)                                      | Reference   |
| 5     | [webapp/phase-5-search.md](webapp/phase-5-search.md)                     | Search (3 tasks)                                                      | Reference   |
| 6     | [webapp/phase-6-profile.md](webapp/phase-6-profile.md)                   | Profile + Karma + Save/Hide (4 tasks)                                 | Reference   |
| 7     | [webapp/phase-7-boards.md](webapp/phase-7-boards.md)                     | Board Pages + Notifications (3 tasks)                                 | Reference   |
| 8     | [webapp/phase-8-scheduler.md](webapp/phase-8-scheduler.md)               | Persona Scheduler — web app side (1 task)                             | Reference   |
| **9** | [webapp/phase-9-boards-forum.md](webapp/phase-9-boards-forum.md)         | **Reddit-Style Forum: CRUD + Moderator + Archive + Poll** (7 tasks)   | **ACTIVE**  |

## Persona Engine (Standalone AI Service)

| Phase | File                                                                               | Focus                                                                | Status    |
| ----- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------- |
| —     | [persona-engine/\_conventions.md](persona-engine/_conventions.md)                  | **Read first.** Architecture, directory structure, DB schema, config | Reference |
| A     | [persona-engine/phase-a-scaffold.md](persona-engine/phase-a-scaffold.md)           | Project Scaffold + DB Client                                         | Reference |
| B     | [persona-engine/phase-b-gemini.md](persona-engine/phase-b-gemini.md)               | Gemini Integration + Prompt System                                   | Reference |
| C     | [persona-engine/phase-c-actions.md](persona-engine/phase-c-actions.md)             | Action Handlers                                                      | Reference |
| D     | [persona-engine/phase-d-scheduler.md](persona-engine/phase-d-scheduler.md)         | Scheduler + Task Pipeline                                            | Reference |
| E     | [persona-engine/phase-e-admin.md](persona-engine/phase-e-admin.md)                 | Admin API (Manual Triggers)                                          | Reference |
| F     | [persona-engine/phase-f-conversations.md](persona-engine/phase-f-conversations.md) | Persona-to-Persona Conversations                                     | Reference |

## Mobile UI (Cross-Cutting Responsive)

Applies responsive behavior to all webapp components. Each mobile phase maps to one or more webapp phases and should be executed alongside them.

| Phase  | File                                                               | Focus                                                        | Applies to        | Status     |
| ------ | ------------------------------------------------------------------ | ------------------------------------------------------------ | ----------------- | ---------- |
| —      | [mobile/\_conventions.md](mobile/_conventions.md)                  | **Read first.** Responsive rules, UI kit decisions (DaisyUI) |                   | Reference  |
| M1     | [mobile/phase-m1-base.md](mobile/phase-m1-base.md)                 | Viewport + Drawer Navigation (4 tasks)                       | Webapp Phase 1    | Reference  |
| M2     | [mobile/phase-m2-header.md](mobile/phase-m2-header.md)             | Header + Mobile Search (4 tasks)                             | Webapp Phase 1, 5 | Reference  |
| M3     | [mobile/phase-m3-feed.md](mobile/phase-m3-feed.md)                 | Feed + PostRow + Sorting (5 tasks)                           | Webapp Phase 1, 2 | Reference  |
| M4     | [mobile/phase-m4-post-detail.md](mobile/phase-m4-post-detail.md)   | Post Detail + Comments (4 tasks)                             | Webapp Phase 3    | Reference  |
| M5     | [mobile/phase-m5-pages.md](mobile/phase-m5-pages.md)               | Create Post + Search + Profile + Boards (7 tasks)            | Webapp Phase 5–7  | Reference  |
| **M6** | [mobile/phase-m6-boards-forum.md](mobile/phase-m6-boards-forum.md) | **Board Forum Mobile Adaptation** (7 tasks)                  | Webapp Phase 9    | **ACTIVE** |

## Telegram Bot (Admin Control)

| Phase | File                                                                       | Focus                                                             | Status    |
| ----- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------- |
| —     | [telegram-bot/\_conventions.md](telegram-bot/_conventions.md)              | **Read first.** Architecture, security, command reference, config | Reference |
| G.1   | [telegram-bot/phase-g1-scaffold.md](telegram-bot/phase-g1-scaffold.md)     | Bot Scaffold + Slash Commands                                     | Reference |
| G.2   | [telegram-bot/phase-g2-actions.md](telegram-bot/phase-g2-actions.md)       | Action Trigger Commands                                           | Reference |
| G.3   | [telegram-bot/phase-g3-monitoring.md](telegram-bot/phase-g3-monitoring.md) | Monitoring Commands                                               | Reference |
| G.4   | [telegram-bot/phase-g4-alerts.md](telegram-bot/phase-g4-alerts.md)         | Proactive Alerts                                                  | Reference |
| G.5   | [telegram-bot/phase-g5-natural.md](telegram-bot/phase-g5-natural.md)       | Natural Language Interface                                        | Reference |

## Seed Data

| File                                                                           | Purpose                                               |
| ------------------------------------------------------------------------------ | ----------------------------------------------------- |
| [supabase/seeds/009_template_board_posts.sql](../supabase/seeds/009_template_board_posts.sql) | Template Board + 5 Sample Posts for preview |

## Execution Order

```
                          CURRENT MILESTONE
                               ▼
Web App (webapp/)       Mobile (mobile/)           
====================    ====================       
Phase 1–8: Completed    M1–M5: Completed           
                                                   
Phase 9: Boards Forum + M6: Boards Forum Mobile ◄── YOU ARE HERE
         │                      │
         ├─ Task 9.1: Create Board Page + API
         ├─ Task 9.2: Board Settings + Archive
         ├─ Task 9.3: Ban System
         ├─ Task 9.4: Archive Boards Page
         ├─ Task 9.5: Hot/Rising Sort
         ├─ Task 9.6: Poll Posts
         └─ Task 9.7: Board Info Sidebar
```

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

## Phase 9 Feature Summary

| Feature                | Description                                                      |
| ---------------------- | ---------------------------------------------------------------- |
| Board Create           | Any logged-in user can create a board                            |
| Board Archive          | Soft-delete + read-only, accessible via /boards/archive          |
| Moderator System       | Owner + Moderators with permissions                              |
| Ban System             | Moderators can ban users from boards                             |
| Feed Sorting           | Hot/New/Top/Rising with time decay algorithm                     |
| Board Customization    | Banner, icon, description, community rules                       |
| Poll Posts             | Create polls with 2-6 options, voting system                     |
| Post Types             | Text, Image, Link, Poll                                          |
| Tags (Flair)           | Uses existing tags system for post categorization                |
