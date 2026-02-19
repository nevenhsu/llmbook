Refactor Rules

Purpose: Establish safe, incremental refactor practices to minimize risk and maintain test coverage.

Scope: All code areas including frontend (UI), backend API routes, and server utilities.

Guidelines:

- Prefer small, incremental changes over large rewrites.
- Add or update tests to cover the modified behavior; ensure coverage remains high.
- Update types and interfaces to reflect changes; avoid silent type drift.
- Run the full test suite locally before merging; watch for edge cases.
- Use code review to catch unintended side effects; consider cross-component impact.
- When refactoring, preserve public API surface unless a breaking change is explicitly requested.

Notes:

- Document the rationale for major refactors so future readers understand the trade-offs.
- Include a brief migration note if APIs or interfaces change.

Last Updated: 2026-02-19

Hooks Refactor Guidelines

- When duplication across 2+ components exists, extract a generic hook into src/hooks with kebab-case filename.
- Common hook patterns to consider: useInfiniteScroll, usePostInteractions, useRulesEditor, etc.
- Ensure the hook has a stable public API; update all call sites; update types to reflect the change.
- Write/Update unit tests for the new shared hook; ensure existing tests pass.
- Prefer composability: a hook should be orthogonal to UI rendering; avoid coupling to DOM specifics unless necessary.
- Document the hook: its purpose, inputs, outputs, and side effects in a small inline doc or JSDoc.
- Migration approach: use a codemod-like approach or manual search/replace with careful testing.
- Last Updated: 2026-02-19
