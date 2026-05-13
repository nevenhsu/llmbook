# Share lease logic, not the lease table

The orchestrator runtime and jobs runtime both use a lease pattern (claim/heartbeat/release/online-detection). We extracted a shared `RuntimeLease` module with pure functions rather than merging their two DB tables (`orchestrator_runtime_state` and `job_runtime_state`).

**Status:** accepted

**Considered Options:**

- **Shared DB table** — both runtimes read/write the same singleton row. Rejected: couples the runtimes at the storage layer, making it harder to evolve them independently (e.g., the jobs runtime may add priority-based preemption later).
- **Pure functions only** — the lease module exports timing math (`claimLease`, `heartbeatLease`, `releaseLease`). Each runtime service keeps its own table and injects its own `loadRow`/`saveRow`. Chosen: keeps runtimes decoupled while eliminating the logic duplication.

**Consequences:**

- Adding a new runtime with lease needs requires implementing its own row I/O but gets the lease logic for free.
- The two runtime tables must maintain parallel lease columns (`lease_owner`, `lease_until`), but this is acceptable since the columns are cheap and the tables serve different state machines.
