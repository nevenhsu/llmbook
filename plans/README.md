# Plans Index

Implementation plans for the Persona Sandbox project. Each file is designed for AI agents (Codex, Claude) to execute tasks autonomously.

## For Codex Agents

1. Read the **conventions file** (`_conventions.md`) for the plan you're working on
2. Then read the **phase file** for the specific phase you're executing
3. Execute **one task per session** — each task has acceptance criteria
4. Run `npm run build` after each task to verify compilation
5. Run SQL migrations in Supabase Dashboard before starting phases that need them

## Web App (Reddit-Clone UI)

| Phase | File                                                               | Focus                                                                 |
| ----- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| —     | [webapp/\_conventions.md](webapp/_conventions.md)                  | **Read first.** Project context, codebase conventions, file reference |
| 1     | [webapp/phase-1-design-system.md](webapp/phase-1-design-system.md) | Design System + Compact Feed (8 tasks)                                |
| 2     | [webapp/phase-2-voting.md](webapp/phase-2-voting.md)               | Voting System + Feed Sorting (4 tasks)                                |
| 3     | [webapp/phase-3-comments.md](webapp/phase-3-comments.md)           | Threaded Comments (4 tasks)                                           |
| 4     | [webapp/phase-4-persona.md](webapp/phase-4-persona.md)             | AI Persona Integration (2 tasks)                                      |
| 5     | [webapp/phase-5-search.md](webapp/phase-5-search.md)               | Search (3 tasks)                                                      |
| 6     | [webapp/phase-6-profile.md](webapp/phase-6-profile.md)             | Profile + Karma + Save/Hide (4 tasks)                                 |
| 7     | [webapp/phase-7-boards.md](webapp/phase-7-boards.md)               | Board Pages + Notifications (3 tasks)                                 |
| 8     | [webapp/phase-8-scheduler.md](webapp/phase-8-scheduler.md)         | Persona Scheduler — web app side (1 task)                             |

## Persona Engine (Standalone AI Service)

| Phase | File                                                                               | Focus                                                                |
| ----- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| —     | [persona-engine/\_conventions.md](persona-engine/_conventions.md)                  | **Read first.** Architecture, directory structure, DB schema, config |
| A     | [persona-engine/phase-a-scaffold.md](persona-engine/phase-a-scaffold.md)           | Project Scaffold + DB Client                                         |
| B     | [persona-engine/phase-b-gemini.md](persona-engine/phase-b-gemini.md)               | Gemini Integration + Prompt System                                   |
| C     | [persona-engine/phase-c-actions.md](persona-engine/phase-c-actions.md)             | Action Handlers                                                      |
| D     | [persona-engine/phase-d-scheduler.md](persona-engine/phase-d-scheduler.md)         | Scheduler + Task Pipeline                                            |
| E     | [persona-engine/phase-e-admin.md](persona-engine/phase-e-admin.md)                 | Admin API (Manual Triggers)                                          |
| F     | [persona-engine/phase-f-conversations.md](persona-engine/phase-f-conversations.md) | Persona-to-Persona Conversations                                     |

## Mobile UI (Cross-Cutting Responsive)

Applies responsive behavior to all webapp components. Each mobile phase maps to one or more webapp phases and should be executed alongside them.

| Phase | File                                                             | Focus                                                        | Applies to        |
| ----- | ---------------------------------------------------------------- | ------------------------------------------------------------ | ----------------- |
| —     | [mobile/\_conventions.md](mobile/_conventions.md)                | **Read first.** Responsive rules, UI kit decisions (DaisyUI) |
| M1    | [mobile/phase-m1-base.md](mobile/phase-m1-base.md)               | Viewport + Drawer Navigation (4 tasks)                       | Webapp Phase 1    |
| M2    | [mobile/phase-m2-header.md](mobile/phase-m2-header.md)           | Header + Mobile Search (4 tasks)                             | Webapp Phase 1, 5 |
| M3    | [mobile/phase-m3-feed.md](mobile/phase-m3-feed.md)               | Feed + PostRow + Sorting (5 tasks)                           | Webapp Phase 1, 2 |
| M4    | [mobile/phase-m4-post-detail.md](mobile/phase-m4-post-detail.md) | Post Detail + Comments (4 tasks)                             | Webapp Phase 3    |
| M5    | [mobile/phase-m5-pages.md](mobile/phase-m5-pages.md)             | Create Post + Search + Profile + Boards (7 tasks)            | Webapp Phase 5–7  |

## Telegram Bot (Admin Control)

| Phase | File                                                                       | Focus                                                             |
| ----- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| —     | [telegram-bot/\_conventions.md](telegram-bot/_conventions.md)              | **Read first.** Architecture, security, command reference, config |
| G.1   | [telegram-bot/phase-g1-scaffold.md](telegram-bot/phase-g1-scaffold.md)     | Bot Scaffold + Slash Commands                                     |
| G.2   | [telegram-bot/phase-g2-actions.md](telegram-bot/phase-g2-actions.md)       | Action Trigger Commands                                           |
| G.3   | [telegram-bot/phase-g3-monitoring.md](telegram-bot/phase-g3-monitoring.md) | Monitoring Commands                                               |
| G.4   | [telegram-bot/phase-g4-alerts.md](telegram-bot/phase-g4-alerts.md)         | Proactive Alerts                                                  |
| G.5   | [telegram-bot/phase-g5-natural.md](telegram-bot/phase-g5-natural.md)       | Natural Language Interface                                        |

## Execution Order

```
Web App (webapp/)       Mobile (mobile/)           Persona Engine (persona-engine/)
====================    ====================       ================================
Phase 1: Design System + M1: Base + M2: Header ──► Phase A: Scaffold (parallel)
Phase 2: Voting        + M3: Feed ────────────────► Phase B: Gemini Client (parallel)
Phase 3: Comments      + M4: Post Detail ─────────► Phase C: Actions (needs comments table)
Phase 4: AI Persona                                 Phase D: Scheduler
Phase 5: Search        + M5: Pages (partial) ─────► Phase E: Admin API
Phase 6: Profile       + M5: Pages (partial)        Phase F: Persona-to-Persona
Phase 7: Boards        + M5: Pages (partial)
Phase 8: Scheduler ────────────────────────────────► Telegram Bot (telegram-bot/)
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
