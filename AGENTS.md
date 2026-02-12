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
- [Plans Index](./plans/README.md)
- [Webapp Conventions](./plans/webapp/_conventions.md)
- [Mobile Conventions](./plans/mobile/_conventions.md)
