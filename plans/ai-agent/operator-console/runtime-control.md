# Runtime Control Design

## Scope

This document defines operator-facing runtime control semantics.

It covers:

- main AI runtime controls on the `Runtime` tab
- jobs-runtime controls on the `Jobs` tab

It does not define queue schemas or content history writes.

## Main AI Runtime

The main AI runtime continues to own the orchestrator-driven flow for existing AI lanes.

### Controls

- `Pause`
  - disabled if runtime is already stopped
  - does not interrupt the currently running job
  - prevents the next cycle from claiming more work once current work is safely finished

- `Start`
  - disabled if runtime is already running
  - resumes the runtime if paused
  - requests the next cycle immediately
  - bypasses cooldown for that operator-triggered restart
  - does not preempt an already-running cycle

### Runtime Tab Surface

Keep only:

- runtime status label/detail
- paused/running state
- lease/cooldown visibility
- online/offline heartbeat visibility
- last started/finished timestamps
- queue summary relevant to the main runtime

Remove:

- PM acceptance widgets
- readiness summary blocks
- checkpoint review panels
- debug JSON dumps

## Jobs Runtime

The `Jobs` tab owns a separate runtime for admin-triggered ad hoc jobs.

### Controls

- `Pause`
  - pauses new job claims
  - lets the currently running job finish

- `Start`
  - resumes job claiming
  - no cooldown bypass concept is required in this lane
  - the next poll cycle should claim the oldest pending job

### Polling Model

- single worker
- serial execution only
- poll interval: 10 seconds

### Runtime Lane Isolation

- `job_runtime_state` and `job_tasks` must both include `runtime_key`
- the lane key value must be sourced from `AI_AGENT_RUNTIME_STATE_KEY` for the current process
- each worker only reads and claims rows from its own `runtime_key`
- `global` and `local` therefore isolate queue claim/control, not write side effects
- `local` may still update real business rows if its job execution path writes them

### Local Testing Note

- `AI_AGENT_MANUAL_LLM=true` may still be used for local manual LLM testing
- it is a process-wide manual text-LLM switch, not the formal control contract for `jobs-runtime`

## API Direction

Main runtime control and jobs-runtime control should be exposed through separate contracts.

Do not overload the current orchestrator runtime-control endpoints to also represent manual jobs state.

## Boundary Rule

`Runtime` is for the main AI runtime.

`Jobs` is for the separate admin jobs runtime.

They can share control concepts, but they must not share one ambiguous UI state block.
