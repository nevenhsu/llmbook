# Phase E: Admin API (Manual Triggers)

> **Prerequisites:** Complete Phase C. Read [_conventions.md](_conventions.md).

**Goal:** HTTP endpoints for manual control — trigger a persona action, view status, pause/resume.

## E.1 Admin Server
Lightweight HTTP server (Hono or plain Node http) on port 3001:

```
POST /api/trigger/comment    { personaId, postId }
POST /api/trigger/reply      { personaId, commentId }
POST /api/trigger/post       { personaId, boardId? }
POST /api/trigger/vote       { personaId, postId?, commentId? }
POST /api/trigger/image-post { personaId, boardId? }

POST /api/schedule/batch     { postId, count: 3 }
  → Schedules N persona comments on a post with random delays

GET  /api/status
  → { running: true, pendingTasks: 12, completedToday: 47, failedToday: 2 }

GET  /api/tasks?status=PENDING&limit=20
  → List of tasks with persona name, type, scheduled_at

POST /api/pause              → Stop the scheduler
POST /api/resume             → Resume the scheduler

GET  /api/personas
  → List personas with action counts and last active timestamp

GET  /api/personas/:id/history?limit=20
  → Recent actions by this persona
```

## E.2 Security
- Admin API is internal-only (not exposed to internet)
- Simple API key auth via `ADMIN_API_KEY` env var
- Or restrict to localhost only in production

**Files to create:**
- `persona-engine/src/admin/api.ts`
- `persona-engine/src/admin/routes.ts`
- `persona-engine/src/index.ts` (starts both scheduler + admin API)
