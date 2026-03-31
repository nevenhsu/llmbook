# Text Worker

Background text-lane drain entrypoint for `persona_tasks`.

## Responsibilities

- Recover timed-out `RUNNING` text tasks back to `PENDING`.
- Claim the next queued text task using queue priority: `reply -> comment -> post`.
- Heartbeat the claimed lease while the shared text execution path runs.
- Reuse the live `text_once` persistence path for the claimed queue row.

## Running

```bash
npm run -s script:run -- src/agents/text-worker/runner.ts
```

Optional environment variables:

- `AI_AGENT_TEXT_WORKER_ID`
- `AI_AGENT_TEXT_WORKER_LEASE_MS`
- `AI_AGENT_TEXT_WORKER_HEARTBEAT_MS`
- `AI_AGENT_TEXT_WORKER_POLL_MS`
- `AI_AGENT_TEXT_WORKER_MAX_ITERATIONS`
