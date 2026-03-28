# Lessons Learned

## Workflow

- Keep [tasks/todo.md](/Users/neven/Documents/projects/llmbook/tasks/todo.md) session-scoped. Do not leave long completed backlogs that bury the current task.
- When a new plan supersedes an older AI runtime contract, update task notes, lessons, repo docs, and internal READMEs in the same cleanup pass.
- Delete historical lesson noise once the rule has been distilled into a short reusable instruction.

## AI Persona Runtime

- Treat [AI_PERSONA_AGENT_PLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-persona-agent/AI_PERSONA_AGENT_PLAN.md) as the current contract source of truth for agent docs.
- When README or setup docs mention persona schema, point to the current staged control-plane/runtime contract; do not leave deprecated high-level field lists like the old `modules` shape as if they were canonical.
- Keep repo entry docs executable: README/agent indexes must not point to nonexistent plan indexes or stale version labels when the active persona plan has already moved on.
- When a persona creation path has been replaced by the Admin Control Panel, remove the old CLI/setup wording entirely instead of documenting both paths in parallel.
- Do not list `npm` verification commands in README unless they exist in `package.json`; if verification is now UI/admin-driven, document the real control-plane entry points instead.
- The current runtime contract is `ai_agent_config` plus a long-running self-loop orchestrator, not cron-triggered orchestration or deprecated config tables.
- Selector and worker docs must use the latest media contract: `need_media` and `media_prompt`, with media stored in `media` and rendered by the frontend instead of altering post/comment bodies.
- For notification triage in the current persona runtime, default to `respond | skip` only; do not invent a deferred task path unless the user explicitly asks for delayed scheduling.
- When documenting cycle caps for persona selection, state clearly whether they apply to selector outputs or final expanded task rows; default to selection-count caps if the user says so.
- When a notification snapshot may expand beyond replies, use an action-oriented name like `notificationActionSnapshot`; document explicit recipient ownership and any current scope limit such as comment-only handling.
- For comment-target context in the AI persona plan, use deterministic trim rather than LLM summaries: parent chain first, then sibling comments in `created_at DESC`, capped at 20 comments unless the user asks for something else.
- For retry policy in the current persona runtime, keep text-task retries immediate on the next idle pass, but use explicit backoff windows for media retries; do not silently invent separate backoff behavior.
- For memory-compressor planning in the current persona runtime, process one persona at a time through a queue, require JSON-first output with parse/audit/repair stages, and render canonical long memory deterministically from the audited result.
- When a runtime LLM flow is compressor-like and format-sensitive, mirror the `Generate Persona` pattern: generation JSON, schema repair, separate audit JSON, then quality repair back into the original canonical JSON schema.
- For memory-write planning in the current persona runtime, keep metadata schema-consistent across rows, let the app own IDs/scope/write-method fields, use deterministic writes for comments, and require staged JSON/audit/repair for LLM-based post memory extraction.
- When a plan introduces JSON contracts, define required keys, allowed enums, no-extra-key rules, and at least one concrete row example; do not leave JSON shape implicit.
- When a repo-level implementation rule becomes reusable across multiple AI flows, promote it out of a sub-plan into `docs/dev-guidelines` and link the specialized plans back to that shared contract.
- For persona-agent task injection, enforce notification dedupe and public-opportunity cooldown in SQL/RPC at insert time; do not rely on app-side query/filter/insert for concurrency-sensitive gating.
