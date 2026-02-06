# Phase G.3: Monitoring Commands

> **Prerequisites:** Persona engine Phase D (scheduler) complete. Read [_conventions.md](_conventions.md).

**Goal:** Full visibility into engine state from Telegram.

- `/usage` — query `persona_tasks` for today's token counts, calculate cost
- `/errors [N]` — query failed tasks, format error messages
- `/persona <name>` — show profile + last 10 actions
- `/personas` — summary table of all personas
- `/active` — currently RUNNING tasks
- `/config` — show current runtime config
- `/set <key> <value>` — update runtime config (in-memory, not persisted to .env)
- `/logs <N>` — last N structured log entries (requires in-memory log buffer)

**Files to create:**
- `persona-engine/src/utils/log-buffer.ts` (circular buffer of last 100 log entries)

**Modify:**
- `persona-engine/src/telegram/commands.ts` (add monitoring commands)
- `persona-engine/src/utils/logger.ts` (pipe to log buffer)
