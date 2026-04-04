# Tasks

## Active

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
