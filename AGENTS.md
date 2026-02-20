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

## Contexts Quick Reference

| Need                   | Import                                                         | Docs                                                        |
| ---------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| User context (Client)  | `import { useUserContext } from '@/contexts/UserContext'`      | [USER_CONTEXT](docs/contexts/USER_CONTEXT.md)               |
| Board context (Client) | `import { useBoardContext } from '@/contexts/BoardContext'`    | [BOARD_CONTEXT](docs/contexts/BOARD_CONTEXT.md)             |
| Login modal            | `import { useLoginModal } from '@/contexts/LoginModalContext'` | [LOGIN_MODAL_CONTEXT](docs/contexts/LOGIN_MODAL_CONTEXT.md) |

## Hooks Quick Reference

| Need                            | Import                                                                | Docs                                                         |
| ------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| Vote on post/comment            | `import { useVote } from '@/hooks/use-vote'`                          | [use-vote](docs/hooks/use-vote.md)                           |
| Save/hide post                  | `import { usePostInteractions } from '@/hooks/use-post-interactions'` | [use-post-interactions](docs/hooks/use-post-interactions.md) |
| Feed pagination (cursor+offset) | `import { useFeedLoader } from '@/hooks/use-feed-loader'`             | -                                                            |
| Infinite scroll                 | `import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'`     | [use-infinite-scroll](docs/hooks/use-infinite-scroll.md)     |
| Theme toggle                    | `import { useTheme } from '@/hooks/use-theme'`                        | -                                                            |
| Responsive breakpoint           | `import { useIsBreakpoint } from '@/hooks/use-is-breakpoint'`         | -                                                            |
| Rich text editor                | `import { useTiptapEditor } from '@/hooks/use-tiptap-editor'`         | -                                                            |

---

## Documentation Links

### Core Documentation

- **[Contexts Overview](./docs/contexts/README.md)** - React contexts (UserContext, BoardContext, LoginModalContext)
- **[Hooks Overview](./docs/hooks/README.md)** - Custom hooks (useVote, usePostInteractions, useInfiniteScroll)
- **[Library Documentation](./docs/lib/README.md)** - Shared utilities and functions

### Development Guidelines

- [Dev Guidelines](docs/dev-guidelines/README.md)
- [Reuse Rules](docs/dev-guidelines/01-reuse-rules.md)
- [Lib Functions](docs/dev-guidelines/02-lib-functions.md)
- [Refactor Rules](docs/dev-guidelines/03-refactor-rules.md)
- [Schema Maintenance](docs/dev-guidelines/04-schema-maintenance.md)
- [Migration Guidelines](docs/dev-guidelines/05-migration-guidelines.md)
- [Archived Docs](docs/dev-guidelines/06-archived-docs.md)

這個版本更加精煉，專注於日常開發需要快速定位的入口。

你也可以在 Plans/ 或 Docs/ 下維護自己的一致性規範。
