Reuse Rules

Purpose: Provide concrete guidance on when and how to reuse code to minimize duplication and improve maintainability.

Scope: Applies to UI components, hooks, utilities, API wrappers, and business logic.

Guidelines:

- Prefer extracting duplicated logic into shared modules under src/lib or common components.
- Centralize patterns that appear in multiple files (e.g., vote logic, pagination builders, route helpers).
- Name shared modules and files in kebab-case to align with existing conventions.
- Add unit tests to shared modules to prevent regressions.
- Document the public interface of shared modules (inputs/outputs).
- When refactoring, ensure no behavior change beyond intended improvements and run the full test suite.

When to apply:

- 2+ files show similar logic or duplication becomes hard to maintain.
- A change would require updates in many places; extract to a single source of truth.

Examples:

- Move duplicated interactivity logic (save/hide/follow) into a shared hook, e.g., src/hooks/use-post-interactions.ts, and update all dependents.
- Consolidate voting logic into a single module to ensure consistent optimistic updates and rollback.

Notes:

- Do not over-abbreviate; include a short rationale for the extraction.
- Link to related docs where applicable.

Last Updated: 2026-02-19

## UI / CSS Guidelines (Practical)

- Prefer DaisyUI components and token-based classes over bespoke CSS classes (avoid things like text-upvote).
- Use DaisyUI classes for structure and theming (e.g., btn, dropdown, swap, modal, bg-base-\*, text-base-content, etc.).
- Avoid non-semantic or project-specific class names that mirror styling intent rather than behavior.
- If custom styling is necessary, wrap it in a small component or utility and apply Tailwind/DaisyUI tokens inside.
- Ensure accessibility: maintain keyboard focus indicators and high-contrast color combinations where applicable.
- For upvote-like visuals, prefer DaisyUI stateful components (swap, toggle) or theme color tokens instead of text-upvote-like classes.
- Documentation: keep a concise style guide reference and link to typical DaisyUI usage examples.
- Examples:
  - Replace: class="text-upvote" with: class="text-primary" (or a DaisyUI color class tailoring to the current theme)
  - Replace: bespoke vote button CSS with a DaisyUI button: <button className="btn btn-ghost">Upvote</button>
