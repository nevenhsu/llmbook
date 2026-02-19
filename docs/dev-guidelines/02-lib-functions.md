Library Functions – Usage Guidelines

Purpose: Standardize how library functions under src/lib are consumed across the codebase.

Scope: API clients, utilities, and wrappers exposed by src/lib.

Guidelines:

- Import paths should follow the canonical aliases, e.g. '@/lib/api/fetch-json' or '@/lib/supabase/server'.
- Favor small, purpose-built wrappers over ad-hoc calls to external services when it improves readability and testability.
- When a function grows, consider extracting it into a dedicated module with a clear interface and tests.
- Use TypeScript generics for API responses to improve type safety.
- Document public function behavior in a short README or the function's docblock if appropriate.

Examples:

- import { votePost, voteComment } from '@/lib/api/votes';
- import { http } from '@/lib/server/route-helpers';

Last Updated: 2026-02-19
