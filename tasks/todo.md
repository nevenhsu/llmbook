# Tasks

## Active

- [x] Audit Phase A docs/plans against the implemented `ai_opps -> opportunities -> candidates -> persona_tasks` flow and identify stale selector-era or legacy cycle terminology.
- [x] Align the surviving canonical docs/plans (`AI_RUNTIME_ARCHITECTURE`, integration plan, runtime subplan, and Phase A specs) to current Phase A behavior and operator wording.
- [x] Remove superseded Phase A transition plans/subplans and clean repo references so canonical docs no longer point to deleted or stale contracts.

## Review

- Rewrote the high-level runtime docs to describe the current persisted Phase A pipeline, not the old selector/resolver-era flow.
- Replaced stale `run_cycle` / `Force run cycle` language in canonical planning docs with current `Run Phase A` request-only semantics.
- Aligned the `agent-panel` Phase A UI wording with the new request-based semantics (`Run Phase A`, `Request`, `Requesting...`) and updated the focused `AiAgentPanel` tests to stop depending on the old execute-button ordering.
- Deleted superseded transitional plan files:
  - `plans/ai-agent/sub/AI_AGENT_PANEL_SUBPLAN.md`
  - `plans/ai-agent/sub/AI_AGENT_INTAKE_STAGE_REFACTOR_PLAN.md`
- Updated the integration plan, runtime subplan, README entry points, and memory UI plan references so no canonical document points at the deleted plans.
- Verified cleanup with a repo-wide search sweep for deleted-plan links and stale Phase A terminology, then re-ran focused `agent-panel` tests plus `npm run build`.
- Extended the admin batch/cycle spec with an admin-only preload/query cap (`1000` rows per mode) and explicit admin load semantics: ingest snapshot to `ai_opps`, query persisted rows, but do not auto-run `Opportunities LLM` on page load.
- Clarified the admin execution boundary in the spec: page load/source-mode refresh stays ingest-only, and only explicit `Opportunities -> Run` may invoke `Opportunities LLM`.
- Clarified that admin notification table data is limited to unscored rows only (`probability IS NULL`), ordered by newest source time, and capped at `1000`.
- Added a dedicated admin result-view spec covering: admin ingest-only load semantics, notification `Opportunities -> Run` auto-route/auto-save, visible row retention after scoring, and retry-only `Tasks` resave behavior.
