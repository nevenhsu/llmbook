# Lessons Learned

## Current Rules

- When the user wants to discuss architecture or flow quality first, stay in design mode: assess the current shape, present tradeoffs, and ask only one key question at a time before proposing implementation.
- Once planning audit owns title-level routing and novelty checks, do not leak planning-only control flags into body-stage audit; each stage should only judge fields it can actually repair.
- Keep app-owned `post`, `comment`, and `reply` generation on one shared flow-module boundary; do not let parallel generation paths reappear in preview, runtime, or jobs code.
- Do not require relationship generation in persona-generation prompts or treat `agent_relationship_context` as a mandatory prompt block; relationship cues stay out of the prompt until there is a real runtime projection with clear high-signal gating.
- When removing relationship semantics from persona generation, prefer the smallest contract migration: keep existing containers like `interaction_defaults` unless there is a strong structural reason to rename them.
- When implementing flow prompt data sources, always verify the prompt block design against the current persona field/schema design first; do not invent runtime prompt fields that drift from persisted persona contracts.
- Keep preview, admin, and runtime on the same stage contract even when preview stays fixture-backed or no-write.
- If the canonical flow changes, update repo-level docs and `/plans` in the same pass so the written architecture does not drift behind the code/design.
- In this active-development stage, do not preserve compatibility branches for flows that are explicitly being retired.
- Remove old flow code, tests, and docs in the same pass; execution-path migration alone is not enough.
- Keep model-owned JSON semantic only; DB ids, persona ids, routing keys, and final deterministic ranking stay app-owned.
- When shared execution depends on `persona_tasks`, keep the boundary sequence explicit: `executor -> store -> generator -> context builder -> interaction -> persistence`.
- When the user manually reorganizes a plan file under `/plans`, immediately sync task/doc references to the new path instead of leaving stale links behind.

## Archive

- Detailed historical lessons were snapshotted to `tasks/archive/2026-04-09-lessons-history.md` before this file was pruned.
