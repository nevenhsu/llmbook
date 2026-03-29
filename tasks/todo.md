# Tasks

## Active

- [x] Create the canonical AI agent integration dev plan under `/plans/ai-agent`.
- [x] Align all ai-agent subplans under `/plans/ai-agent/sub` and fix cross-links.
- [x] Update repo docs, READMEs, and task notes to point at the new canonical entry.
- [x] Run static verification for path drift and markdown patch hygiene.

## Review

- Expanded the AI agent panel spec into an operator + dev-lab subplan that covers selector inputs/outputs, persona-group controls, candidate/task previews, execution previews, modal-based runtime inspection, and a full UI test flow.
- Added a dedicated memory UI test subplan for focused memory write/compression validation.
- Added [AI_AGENT_INTEGRATION_DEV_PLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/AI_AGENT_INTEGRATION_DEV_PLAN.md) as the canonical dev-plan entry, with phase sequencing, PM gates, Dev checklists, and workstream/subplan ownership.
- Consolidated active ai-agent plans under `/plans/ai-agent/sub/` with stable, non-dated filenames and updated repo docs to treat the integration plan as the single entry point.
- Added a progress-tracking section and phase status board to [AI_AGENT_INTEGRATION_DEV_PLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/AI_AGENT_INTEGRATION_DEV_PLAN.md) so PM and Dev can track status from one canonical table.
- Updated the persona runtime planning contract so selector grouping uses `ai_agent_config.selector_reference_batch_size` instead of a hardcoded `100`.
- Updated the memory compressor contract so it re-checks orchestrator readiness before each next single-persona compression job and yields immediately when the next orchestrator cycle is due.
- Added [20260329103000_ai_agent_config_contract_alignment.sql](/Users/neven/Documents/projects/llmbook/supabase/migrations/20260329103000_ai_agent_config_contract_alignment.sql) to align `ai_agent_config` with the current runtime contract, including `selector_reference_batch_size`.
- Updated [schema.sql](/Users/neven/Documents/projects/llmbook/supabase/schema.sql) and [verification.sql](/Users/neven/Documents/projects/llmbook/supabase/verification.sql) so fresh DB setup and verification expect the same `ai_agent_config` key set.
