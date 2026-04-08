# Tasks

## Active

- [x] Explore current `/admin/ai/agent-lab` and `/admin/ai/agent-panel` implementation, related tests, existing plans, and recent AI agent runtime commits.
- [x] Clarify that `/admin/ai/agent-panel` is moving toward `Operator Console + Hard Split`, and that this turn is design discussion first rather than implementation.
- [x] Revise the panel design around a client-loaded operator console with no server snapshot dependency on page entry.
- [x] Propose an independent admin jobs-runtime so operator-triggered content-edit and persona-memory jobs do not conflict with the existing AI runtime loop.
- [x] Present the validated design for the simplified `/admin/ai/agent-panel` information architecture, tab order, shared table UI, and jobs-runtime controls.
- [x] Ensure the `Memory` tab reads from `persona_memories` and enqueues persona-scoped memory jobs into the shared jobs-runtime instead of executing inline.
- [x] Write the agreed modular design docs under `/plans/ai-agent/operator-console` and update this task log with the reviewed scope.
- [x] Converge the first schema migration draft for `job_tasks`, `job_runtime_state`, `content_edit_history`, and `personas.last_compressed_at`.
- [ ] Implement the remaining `/admin/ai/agent-lab` Phase A page work required by the approved scope.
- [ ] Add or update targeted tests for any `agent-lab` or `agent-panel` behavior changed in this pass.
- [ ] Run verification commands, capture results, and record the review outcome here before closing.

## Previous Review

- [x] Add a local one-shot Phase A dev command that runs the shared persisted Phase A flow without starting the background runtime loop.
- [x] Add test coverage first for the new dev command and Phase A terminal logging behavior.
- [x] Add structured Phase A terminal logs for snapshot source, ingest/new-row counts, opportunities LLM batch progress, candidate/task injection counts, and computed cooldown timing.
- [x] Ensure the local dev command never runs Phase B or Phase C work and does not persist orchestrator cooldown/lease updates to Supabase.
- [x] Verify the new command and targeted tests, then record the review result here.

## Review

- Added `npm run ai:phase-a:once` as a one-shot local Phase A debug command backed by the shared persisted Phase A pipeline.
- The local command prints terminal logs for snapshot source, new `ai_opps` count, opportunities batch progress, public/notification task injection counts, and the computed cooldown timestamp that would be used by runtime.
- The local command does not claim runtime leases, does not start Phase B/Phase C workers, and does not persist orchestrator cooldown state to `orchestrator_runtime_state`.
- Verified with `npm test -- src/lib/ai/agent/intake/opportunity-pipeline-service.test.ts src/lib/ai/agent/orchestrator/local-phase-a-runner-service.test.ts`.
