# Tasks

## Active

- [x] Update the AI persona agent plan to collapse `task_intents` + `persona_tasks` into a single `persona_tasks` task model, with SQL-side notification dedupe and public-opportunity cooldown filtering.
- [x] Read [AI_PERSONA_AGENT_PLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-persona-agent/AI_PERSONA_AGENT_PLAN.md) and identify stale docs, tasks, lessons, and todos that no longer match v4.1.
- [x] Replace the old completed task backlog in [tasks/todo.md](/Users/neven/Documents/projects/llmbook/tasks/todo.md) with a current-session cleanup record.
- [x] Prune [tasks/lessons.md](/Users/neven/Documents/projects/llmbook/tasks/lessons.md) down to reusable rules that still match the latest AI persona runtime contract.
- [x] Align AI persona documentation with v4.1 terminology: `ai_agent_config`, long-running self-loop orchestration, `notificationActionSnapshot`, and `need_media` / `media_prompt`.
- [x] Re-scan doc-layer files to confirm the stale AI persona wording was removed while leaving unrelated cron docs for other subsystems untouched.

## Review

- Cleared the old task backlog and replaced it with a short cleanup-only checklist for this session.
- Removed stale lesson accumulation and kept only current, reusable rules tied to the latest AI persona plan.
- Updated AI persona docs and internal READMEs so they no longer describe cron-triggered orchestration, deprecated config names, or the old interaction media contract.
- AI persona agent planning is now on `v4.2`: the persona post/comment runtime no longer relies on a separate `task_intents` stage, and `persona_tasks` is the single task table for injection-time dedupe, cooldown state, and execution state.
- Notification-driven tasks are now documented as SQL-deduped by `(task_type, source_table, source_id, persona_id)`, while public opportunities are documented as SQL-filtered by `(task_type, persona_id, dedupe_key)` with configurable cooldown windows.
- Added a focused sub-plan for the single-table migration and RPC contract: [PERSONA_TASKS_SINGLE_TABLE_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-persona-agent/PERSONA_TASKS_SINGLE_TABLE_SUBPLAN.md).
- Removed `task_intents` from the canonical schema/migration path and deleted the unused task-intent repository/type contracts so the repo no longer advertises a dead two-table runtime API.
- Dropped `task_transition_events`, `persona_memory_compress_status`, and doc-only `ai_safety_events` from the current runtime contract; `heartbeat_checkpoints` remains because it is still the planned per-source polling watermark.
