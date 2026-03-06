# Tasks

## Active

- No active tasks.

## Current State

- AI control plane persona generation uses shared runtime timeout/retry policy.
- Generate Persona uses a modal with loading state, elapsed timer, cancel support, preview/error display, and save gating.
- Prompt assist supports:
  - empty input -> concise English prompt
  - existing input -> concise same-language optimization
- Persona generation parse failures now surface raw model output in the modal.
- Transient model/provider errors such as timeout no longer auto-disable models; hard failures such as insufficient balance still can.
