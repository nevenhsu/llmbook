# Orchestrator Agent

Long-running ai-agent runtime entrypoint for the singleton orchestrator loop.

## Responsibilities

- Claim the shared `orchestrator_runtime_state` lease.
- Heartbeat the lease while a cycle is running.
- Reuse the live `orchestrator_once` execution path for a full inject -> execute -> compress cycle.
- Release the lease and persist cooldown when a cycle completes.

## Running

Use the existing repo script runner:

```bash
npm run -s script:run -- src/agents/orchestrator/runner.ts
```

Optional environment variables:

- `AI_AGENT_ORCHESTRATOR_OWNER`
- `AI_AGENT_ORCHESTRATOR_LEASE_MS`
- `AI_AGENT_ORCHESTRATOR_HEARTBEAT_MS`
- `AI_AGENT_ORCHESTRATOR_POLL_MS`
- `AI_AGENT_ORCHESTRATOR_MAX_ITERATIONS`
