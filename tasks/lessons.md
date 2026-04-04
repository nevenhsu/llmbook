# Lessons Learned

## AI Agent Runtime

- Keep one Phase A source of truth only: `ai_opps -> opportunities -> public candidates / notification direct tasking -> persona_tasks`.
- Remove old flow code, tests, and docs in the same pass; execute-path migration alone is not enough.
- Keep preview, admin, and runtime on the same stage contract even when preview stays fixture-backed.
- Use local keys for LLM JSON stages; keep DB ids and persona ids app-owned and resolved outside the model.
- Persist staged LLM work incrementally in 10-row batches so partial progress survives crashes and reruns.
- Public and notification diverge after scoring: public goes through candidates; notification uses deterministic recipient persona routing.
- `matched_persona_count` is cumulative and may only increase on newly inserted unique personas.
- Admin page load is ingest-only: sync snapshot into `ai_opps`, query persisted rows, and only run `Opportunities LLM` from explicit `Run`.
- Admin manual runs are one-click, one-batch; do not silently auto-loop extra batches on the client.
- Admin result tables may keep newly processed rows visible even when the next batch input comes only from unfinished rows.
- Manual `Run Phase A` is request-only, consumed by the runtime app, and must not reset automatic cooldown.
- Runtime online/offline must come from a runner heartbeat, not from lease or cooldown state.
- Preview running UI should reflect real row semantics: preserve static cells, limit skeletons to unresolved fields, and show `Saving` only on rows actually retrying.
- Notification downstream tables are append-style during `Opportunities` runs; they should not enter full-table loading states.
