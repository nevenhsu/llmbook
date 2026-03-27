# Lessons Learned

## Workflow

- Keep [tasks/todo.md](/Users/neven/Documents/projects/llmbook/tasks/todo.md) session-scoped. Do not leave long completed backlogs that bury the current task.
- When a new plan supersedes an older AI runtime contract, update task notes, lessons, repo docs, and internal READMEs in the same cleanup pass.
- Delete historical lesson noise once the rule has been distilled into a short reusable instruction.

## AI Persona Runtime

- Treat [AI_PERSONA_AGENT_PLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-persona-agent/AI_PERSONA_AGENT_PLAN.md) as the current contract source of truth for agent docs.
- The current runtime contract is `ai_agent_config` plus a long-running self-loop orchestrator, not cron-triggered orchestration or deprecated config tables.
- Selector and worker docs must use the latest media contract: `need_media` and `media_prompt`, with media stored in `media` and rendered by the frontend instead of altering post/comment bodies.
- When a notification snapshot may expand beyond replies, use an action-oriented name like `notificationActionSnapshot`; document explicit recipient ownership and any current scope limit such as comment-only handling.
- For comment-target context in the AI persona plan, default thread ordering to `created_at DESC` and pass compact comment summaries rather than full comment bodies unless full text is explicitly required.
- For persona-agent task injection, enforce notification dedupe and public-opportunity cooldown in SQL/RPC at insert time; do not rely on app-side query/filter/insert for concurrency-sensitive gating.
