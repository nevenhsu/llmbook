# Tasks

## Active

- [x] Replace the stale README `May call external LLM (token cost)` command list with the current Admin Control Panel verification entry points.
- [x] Remove the stale `seed:personas` persona-creation path from repo docs and replace it with the Admin Control Panel workflow.
- [x] Refresh the stale Persona schema guidance in [README.md](/Users/neven/Documents/projects/llmbook/README.md) so it points at the current staged persona payload contract instead of the old `modules` shape.
- [x] Normalize remaining stale persona-facing copy in repo entry docs, especially README seed wording, dead plan links, and `src/agents/README.md` version labels.
- [x] Fold the latest ai-persona-agent plan decisions into the planning docs: notification triage is `respond | skip` only, cycle caps apply to selections, retries run in idle before memory compression, and comment/post context uses deterministic trim plus compact memory writes.
- [x] Lock the retry backoff contract into the ai-persona-agent plan: `persona_tasks` retries immediately on the next idle pass, while media retries use fixed `5m -> 15m -> 30m` backoff.
- [x] Add a dedicated memory-compressor sub-plan and align related runtime docs with the approved contract: one persona at a time, queue-driven idle execution, JSON result schema, and audit / repair gates.
- [x] Tighten the memory-compressor contract to follow the Generate Persona staged pattern: canonical compression JSON, schema repair, separate audit JSON, and quality repair back into canonical JSON.
- [x] Add a dedicated memory-write sub-plan and align related docs with the approved split: comment writes are deterministic, post writes use staged LLM JSON extraction, and metadata keys stay format-consistent.
- [x] Tighten the JSON contracts in memory-write and memory-compressor planning: required keys, allowed enums, no-extra-key rules, and concrete row examples.
- [x] Promote the staged LLM JSON rules into a repo-level implementation guideline under `docs/dev-guidelines`, and link current AI plans back to it.
- [x] Update the AI persona agent plan to collapse `task_intents` + `persona_tasks` into a single `persona_tasks` task model, with SQL-side notification dedupe and public-opportunity cooldown filtering.
- [x] Read [AI_PERSONA_AGENT_PLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-persona-agent/AI_PERSONA_AGENT_PLAN.md) and identify stale docs, tasks, lessons, and todos that no longer match v4.1.
- [x] Replace the old completed task backlog in [tasks/todo.md](/Users/neven/Documents/projects/llmbook/tasks/todo.md) with a current-session cleanup record.
- [x] Prune [tasks/lessons.md](/Users/neven/Documents/projects/llmbook/tasks/lessons.md) down to reusable rules that still match the latest AI persona runtime contract.
- [x] Align AI persona documentation with v4.1 terminology: `ai_agent_config`, long-running self-loop orchestration, `notificationActionSnapshot`, and `need_media` / `media_prompt`.
- [x] Re-scan doc-layer files to confirm the stale AI persona wording was removed while leaving unrelated cron docs for other subsystems untouched.

## Review

- Replaced the fake `npm run ai:*` verification command list in the README with current external-LLM verification entry points from the Admin Control Panel.
- Removed the obsolete `seed:personas` setup path from the README and pointed persona creation back to the Admin Control Panel, which is already the canonical workflow.
- Replaced the old README Persona schema blurb with links to the current staged persona payload contract so seed/runtime work no longer points at the deprecated `modules` structure.
- Updated repo entry docs so persona seed wording, plan entry points, and agent-runtime version labels match the current staged contract instead of older `v4.1` / dead-link copy.
- Cleared the old task backlog and replaced it with a short cleanup-only checklist for this session.
- Removed stale lesson accumulation and kept only current, reusable rules tied to the latest AI persona plan.
- Updated AI persona docs and internal READMEs so they no longer describe cron-triggered orchestration, deprecated config names, or the old interaction media contract.
- AI persona agent planning is now on `v4.2`: the persona post/comment runtime no longer relies on a separate `task_intents` stage, and `persona_tasks` is the single task table for injection-time dedupe, cooldown state, and execution state.
- Notification-driven tasks are now documented as SQL-deduped by `(task_type, source_table, source_id, persona_id)`, while public opportunities are documented as SQL-filtered by `(task_type, persona_id, dedupe_key)` with configurable cooldown windows.
- Added a focused sub-plan for the single-table migration and RPC contract: [PERSONA_TASKS_SINGLE_TABLE_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-persona-agent/PERSONA_TASKS_SINGLE_TABLE_SUBPLAN.md).
- Captured the latest user decisions in the plan: notification triage is `respond | skip` only, selector caps apply to selections rather than expanded task rows, idle retry pass runs before memory compression, and comment/post context plus memory writes use deterministic trimming.
- Added explicit retry timing rules: text tasks return to `PENDING` for the next idle retry pass without extra delay, while media retries wait `5m -> 15m -> 30m` and must respect `next_retry_at` when claiming image jobs.
- Added [MEMORY_COMPRESSOR_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-persona-agent/MEMORY_COMPRESSOR_SUBPLAN.md) and aligned the main plan plus runtime architecture around a queue-driven, one-persona-at-a-time compressor with JSON-first output and audit / repair flow.
- Tightened the compressor flow to mirror Generate Persona: `compression-main` JSON, schema repair, deterministic checks, audit JSON, quality repair, then deterministic render.
- Added [MEMORY_WRITE_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-persona-agent/MEMORY_WRITE_SUBPLAN.md) and aligned the main plan plus runtime architecture around `content + metadata + importance`, with app-owned metadata keys, deterministic comment writes, and staged LLM post-memory writes.
- Tightened the JSON contracts so implementers no longer have to infer shapes: post/comment metadata, semantic metadata, compressor result JSON, and audit JSON now spell out required keys, type rules, and example rows.
- Added [08-llm-json-stage-contract.md](/Users/neven/Documents/projects/llmbook/docs/dev-guidelines/08-llm-json-stage-contract.md) as the shared rulebook for future staged LLM JSON work, then linked the AI runtime and memory sub-plans back to it.
- Removed `task_intents` from the canonical schema/migration path and deleted the unused task-intent repository/type contracts so the repo no longer advertises a dead two-table runtime API.
- Dropped `task_transition_events`, `persona_memory_compress_status`, and doc-only `ai_safety_events` from the current runtime contract; `heartbeat_checkpoints` remains because it is still the planned per-source polling watermark.
