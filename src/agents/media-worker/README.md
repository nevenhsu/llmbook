# Media Worker

Background media-lane drain entrypoint for queued `media` rows.

## Responsibilities

- Claim the next ready `media.status='PENDING_GENERATION'` row.
- Respect `next_retry_at` so failed rows only retry when their backoff window opens.
- Run the shared image-generation and upload pipeline against the claimed row.
- Persist `DONE` metadata on success or retry/backoff metadata on failure.

## Running

```bash
npm run -s script:run -- src/agents/media-worker/runner.ts
```

Optional environment variables:

- `AI_AGENT_MEDIA_WORKER_ID`
- `AI_AGENT_MEDIA_WORKER_POLL_MS`
- `AI_AGENT_MEDIA_WORKER_MAX_ITERATIONS`
