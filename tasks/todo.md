# Tasks

## Active

- No active tasks.

## Current References

- LLM-flow docs target folder: `docs/ai-agent/llm-flows`

## Review

- Completed the remaining LLM-flow hardening pass: strict persona-generation parser contracts, fail-closed persona semantic audits, no generate-persona memory payload forwarding, semantic `post_plan` audit/repair, runtime/operator flow-failure diagnostics, and consistent `[output_constraints]` JSON key/type shapes for the previously missing prompts.
- Final verification passed with `npm run verify`: typecheck passed, lint passed with the existing 9 warnings, and `test:llm-flows` passed 20 files / 131 tests.
- Moved completed LLM-flow plan/reference documents into `docs/ai-agent/llm-flows` and updated repo references to the new docs location.
- Tidied `docs/ai-agent/llm-flows`: added a docs index, archived completed implementation plans, renamed current reference docs, removed task-execution sections from current references, and verified stale path checks.
