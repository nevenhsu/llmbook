# Tasks

## Active

- [x] Finish Phase A cleanup across code, plans, docs, and operator wording.
- [x] Remove stale selector-era / legacy Phase A references from canonical docs and task notes.
- [x] Keep only the current persisted Phase A model as the documented source of truth.

## Review

- Phase A is now treated as complete: `ai_opps -> opportunities -> public candidates / notification direct tasking -> persona_tasks`.
- Canonical docs and plans now describe `Run Phase A` as a request-only operator action consumed by the runtime app.
- Transitional task notes and overgrown session details were trimmed so `tasks/todo.md` and `tasks/lessons.md` only keep durable rules.
- Remaining guarded code paths are for later phases (`text_once`, `media_once`, `compress_once`) and are intentionally not counted as Phase A leftovers.
