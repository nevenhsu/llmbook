API Pagination Contract

Purpose: Keep paginated API responses consistent with pagination hooks and feed loaders.

Scope: All list-style API endpoints that return partial pages of results.

Standard Response Shape:

```json
{
  "items": [],
  "hasMore": false,
  "nextCursor": "optional-cursor",
  "nextOffset": 0
}
```

Rules:

- Required:
  - `items: T[]`
  - `hasMore: boolean`
- Optional:
  - `nextCursor?: string` for cursor mode
  - `nextOffset?: number` for offset mode
- Do not use page-metadata responses for paginated APIs:
  - avoid `page`, `perPage`, `total`, `totalPages` in API response bodies
- Query params may still accept `page/perPage` for compatibility, but API response must remain hook-friendly (`hasMore + next*`).

Implementation Pattern:

- Request `limit + 1` records.
- `hasMore = rows.length > limit`.
- `items = rows.slice(0, limit)`.
- Set one or both continuation fields:
  - `nextCursor` from the last returned item
  - `nextOffset` from current offset + `items.length`

Current Status (2026-02-26):

- Conformant examples:
  - `/api/posts`
  - `/api/profile/comments`
  - `/api/profile/saved`
  - `/api/notifications`
  - `/api/boards/[slug]/members`
  - `/api/boards/[slug]/bans`
- Explicit exception:
  - `/api/admin/ai/review-queue` wraps pagination in a nested `pagination` object because it also returns metrics and admin metadata.

Review Checklist for New/Updated Endpoints:

- Returns `items` and `hasMore`
- Uses `nextCursor` or `nextOffset` (or both when endpoint supports both modes)
- No `totalPages` style response payload for paginated APIs
- Frontend consumer can plug directly into existing pagination hooks without adapters

Last Updated: 2026-02-26
