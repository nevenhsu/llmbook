# Lessons Learned

## Current Rules

- When the user wants to discuss architecture or flow quality first, stay in design mode: assess the current shape, present tradeoffs, and ask only one key question at a time before proposing implementation.
- Once planning audit owns title-level routing and novelty checks, do not leak planning-only control flags into body-stage audit; each stage should only judge fields it can actually repair.
- Keep app-owned `post`, `comment`, and `reply` generation on one shared flow-module boundary; do not let parallel generation paths reappear in preview, runtime, or jobs code.
- Do not require relationship generation in persona-generation prompts or treat `agent_relationship_context` as a mandatory prompt block; current persona/prompt contracts have no relationship data source.
- When removing relationship semantics from persona generation, prefer the smallest contract migration: keep existing containers like `interaction_defaults` unless there is a strong structural reason to rename them.
- For persona-generation design, prefer the smallest staged contract that preserves reference/originalization quality; do not force it into the runtime text prompt-family architecture or generate memories unless there is a concrete downstream need.
- When adding doctrine or fit-dimension logic, define it in generate-persona as derivable from canonical `persona_core` source fields, but do not persist `value_fit`, `reasoning_fit`, `discourse_fit`, or `expression_fit` as new DB fields.
- Treat the simplification plan as the only active generate-persona implementation path; older relationship-removal docs are cleanup/history references, not parallel implementation plans.
- When implementing flow prompt data sources, always verify the prompt block design against the current persona field/schema design first; do not invent runtime prompt fields that drift from persisted persona contracts.
- All audits should consume compact review packets; repairs should consume fuller rewrite packets.
- Audit prompts must be told the packet is intentionally compact and must not fail just because omitted generation background is absent.
- If an audit or repair prompt judges persona fit, feed it compact persona evidence from canonical persona fields. At minimum include `reference_sources` names plus a derived persona lens for that flow; do not ask the model to infer persona fit from board/thread context alone.
- In the current stage, do not emit `[agent_memory]` in `post_plan`, `post_body`, `comment`, or `reply`; only reintroduce memory after a dedicated memory module exists.
- Reference-role influence should be projected as originalized doctrine across values, reasoning, discourse shape, and expression pressure, not treated mainly as style garnish or example flavor.
- `writer_family` main generation should internally self-check `value_fit`, `reasoning_fit`, `discourse_fit`, and `expression_fit` before emitting final JSON; do not reserve persona-fit judgment only for external audit.
- Do not keep compatibility wording for relationship fields in active plans; current persona/prompt contracts have no relationship data, so cleanup should delete those remnants.
- `FlowDiagnostics.attempts` must stay per-stage. Do not merge `post_plan`, `post_body`, `comment`, or `reply` retry counts into one opaque total.
- Keep `post_body`, `comment`, and `reply` output constraints aligned on one shared writer media tail: `need_image`, `image_prompt`, `image_alt`.
- When generate-persona stops authoring memories, omit `persona_memories` entirely in the migrated output; do not keep an always-empty compatibility placeholder.
- `persona_core` quality audit should explicitly judge cross-field coherence, not just per-field prose quality.
- In prompt example docs, do not expose a named prior-stage context block for chained staged generation. Treat prior-stage canonical JSON as internal runtime carry-forward state, and never inline exemplar payloads that could anchor copied prompts.
- Keep preview, admin, and runtime on the same stage contract even when preview stays fixture-backed or no-write.
- If the canonical flow changes, update repo-level docs and `/plans` in the same pass so the written architecture does not drift behind the code/design.
- In this active-development stage, do not preserve compatibility branches for flows that are explicitly being retired.
- Remove old flow code, tests, and docs in the same pass; execution-path migration alone is not enough.
- Keep model-owned JSON semantic only; DB ids, persona ids, routing keys, and final deterministic ranking stay app-owned.
- When shared execution depends on `persona_tasks`, keep the boundary sequence explicit: `executor -> store -> generator -> context builder -> interaction -> persistence`.
- When the user manually reorganizes a plan file under `/plans`, immediately sync task/doc references to the new path instead of leaving stale links behind.

## Archive

- Detailed historical lessons were snapshotted to `tasks/archive/2026-04-09-lessons-history.md` before this file was pruned.
