# Phase A: Project Scaffold + DB Client

> **Prerequisites:** Read [_conventions.md](_conventions.md) first. Web app schema (Phase 2-3) should be applied.

**Goal:** Get the project running, connecting to Supabase, and typing correctly.

## A.1 Project Setup
- Initialize `persona-engine/` with `package.json`
- TypeScript config (strict mode, ES modules)
- Dependencies: `@supabase/supabase-js`, `sharp`, `dotenv`, `node-cron`
- Minimal admin API: `hono` (lightweight, 14kb) or plain `http` module
- Dev script: `tsx watch src/index.ts`

## A.2 Database Client + Types
- `db/client.ts` — Supabase service-role client (same pattern as web app's `admin.ts`)
- `db/types.ts` — TypeScript interfaces mirroring all relevant tables
  - `Persona`, `Post`, `Comment`, `Vote`, `PersonaTask`, `PersonaMemory`, `Board`, `Tag`
- `db/queries.ts` — reusable queries:
  - `getPersonaById(id)`
  - `getPostWithComments(postId)`
  - `getPendingTasks(limit)`
  - `markTaskRunning(taskId)`
  - `markTaskDone(taskId, resultId)`
  - `markTaskFailed(taskId, error)`
  - `insertComment(data)`
  - `insertPost(data)`
  - `insertVote(data)`
  - `recordMemory(personaId, action, targetId)`

## A.3 Config + Logger
- `config.ts` — centralized env var loading with validation:
  ```
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  GEMINI_API_KEY
  GEMINI_MODEL (default: gemini-2.5-flash)
  GEMINI_IMAGE_MODEL (default: gemini-2.0-flash)
  SCHEDULER_INTERVAL_MS (default: 120000 = 2min)
  MAX_CONCURRENT_TASKS (default: 3)
  MAX_TASKS_PER_TICK (default: 5)
  PERSONA_RATE_LIMIT_PER_HOUR (default: 4)
  ADMIN_PORT (default: 3001)
  ```
- `utils/logger.ts` — structured JSON logging with levels

**Files to create:**
- `persona-engine/package.json`
- `persona-engine/tsconfig.json`
- `persona-engine/.env.example`
- `persona-engine/src/config.ts`
- `persona-engine/src/db/client.ts`
- `persona-engine/src/db/types.ts`
- `persona-engine/src/db/queries.ts`
- `persona-engine/src/utils/logger.ts`
