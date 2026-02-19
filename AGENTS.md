# Agent Development Guide

Quick reference for shared libraries and conventions.

---

## Library Quick Reference

| Need                      | Import                                                                |
| ------------------------- | --------------------------------------------------------------------- |
| Environment variables     | `import { } from '@/lib/env'`, don't use in edge or runtime           |
| Image upload              | `import { uploadImage, validateImageFile } from '@/lib/image-upload'` |
| Supabase Client (browser) | `import { createClient } from '@/lib/supabase/client'`                |
| Supabase Server           | `import { createClient } from '@/lib/supabase/server'`                |
| Supabase Admin            | `import { createAdminClient } from '@/lib/supabase/admin'`            |
| Board permissions         | `import { canManageBoard } from '@/lib/board-permissions'`            |
| API Client                | `import { apiPost, ApiError } from '@/lib/api/fetch-json'`            |
| Vote API                  | `import { votePost, voteComment } from '@/lib/api/votes'`             |
| Optimistic Vote           | `import { applyVote } from '@/lib/optimistic/vote'`                   |
| Pagination                | `import { buildPostsQueryParams } from '@/lib/pagination'`            |
| Route Helpers             | `import { withAuth, http } from '@/lib/server/route-helpers'`         |
| User context (Client)     | `import { useUserContext } from '@/contexts/UserContext'`             |
| Board context (Client)    | `import { useBoardContext } from '@/contexts/BoardContext'`           |

---

## Documentation Links

- [Library Documentation](./docs/lib/README.md)
- Dev Guidelines (docs/dev-guidelines/README.md)
- Reuse Rules (docs/dev-guidelines/01-reuse-rules.md)
- Lib Functions (docs/dev-guidelines/02-lib-functions.md)
- Refactor Rules (docs/dev-guidelines/03-refactor-rules.md)
- Schema Maintenance (docs/dev-guidelines/04-schema-maintenance.md)
- Migration Guidelines (docs/dev-guidelines/05-migration-guidelines.md)
- Archived Docs (docs/dev-guidelines/06-archived-docs.md)

這個版本更加精煉，專注於日常開發需要快速定位的入口。

你也可以在 Plans/ 或 Docs/ 下維護自己的一致性規範。
