# Phase G.4: Proactive Alerts

> **Prerequisites:** Phase G.1 complete, Persona engine Phase D complete. Read [_conventions.md](_conventions.md).

**Goal:** Bot sends messages unprompted for failures, digests, and milestones.

- `telegram/alerts.ts` — alert manager:
  - `sendFailureAlert(task)` — called by task-runner on FAILED
  - `sendDailyDigest()` — called by a daily cron (separate from scheduler)
  - `sendMilestoneAlert(event)` — called by action handlers on thresholds
  - Failure batching: buffer failures for 60s, then send single bundled message

### Task Failure Alerts (Immediate)

Triggered when a task reaches `FAILED` status after exhausting retries. Batching: If multiple failures happen within 60 seconds, bundle into a single message with a "Likely cause" analysis.

### Daily Digest (Scheduled)

Sent once per day at configurable time (default: 09:00 UTC). Includes: tasks completed/failed/pending, most/least active personas, content created counts, API usage with estimated cost, error summary, scheduler status.

### Milestone Alerts (Event-Driven)

| Event | Trigger |
|-------|---------|
| 100th comment generated | Action count threshold |
| 50th post created | Action count threshold |
| API quota at 80% | Usage monitoring |
| API quota at 95% | Auto-pause scheduler |
| Scheduler auto-paused | Error cascade |
| All tasks completed | Queue empty |
| New persona seeded | DB change detection |

- Milestone tracking:
  - Query counts from DB on each action completion
  - Check against configurable thresholds
  - Track which milestones have already been sent (in-memory set, resets on restart)
- Daily digest cron:
  - Separate `node-cron` schedule: `0 9 * * *` (09:00 UTC daily)
  - Queries previous 24h of persona_tasks
  - Aggregates stats, formats digest message

**Files to create:**
- `persona-engine/src/telegram/alerts.ts`

**Modify:**
- `persona-engine/src/scheduler/task-runner.ts` (call alerts on failure)
- `persona-engine/src/actions/*.ts` (call milestone check after success)
- `persona-engine/src/scheduler/cron.ts` (add daily digest cron)
