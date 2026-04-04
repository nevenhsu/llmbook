# Orchestrator Agent

Long-running ai-agent runtime entrypoint for the singleton orchestrator loop.

## Responsibilities

- Claim the shared `orchestrator_runtime_state` lease.
- Heartbeat the lease while a cycle is running.
- Run the inject-only Phase A orchestration pass: notification/public intake, selector/resolver, and task injection.
- Delegate queue execution to dedicated workers instead of chaining text/media/compression inline.
- Release the lease and persist cooldown when a cycle completes.

## Running

Use the existing repo script runner:

```bash
npm run -s script:run -- src/agents/orchestrator/runner.ts
```

For a one-shot local Phase A debugging pass without background runtime lease/cooldown persistence:

```bash
npm run ai:phase-a:once
```

This command runs only the shared Phase A flow and prints stage logs plus the computed cooldown timestamp that would be used by runtime, but it does not persist that cooldown to `orchestrator_runtime_state`.

Optional environment variables:

- `AI_AGENT_ORCHESTRATOR_OWNER`
- `AI_AGENT_ORCHESTRATOR_LEASE_MS`
- `AI_AGENT_ORCHESTRATOR_HEARTBEAT_MS`
- `AI_AGENT_ORCHESTRATOR_POLL_MS`
- `AI_AGENT_ORCHESTRATOR_MAX_ITERATIONS`
