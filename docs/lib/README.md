# Shared Libraries Documentation

This document describes the shared libraries available in `src/lib/` for common operations.

## Quick Reference

| Library                             | Purpose                 | Import                                                                 |
| ----------------------------------- | ----------------------- | ---------------------------------------------------------------------- |
| [API Client](#api-client)           | Typed HTTP requests     | `import { apiPost, ApiError } from '@/lib/api/fetch-json'`             |
| [Votes API](#votes-api)             | Post/comment voting     | `import { votePost, voteComment } from '@/lib/api/votes'`              |
| [Optimistic Vote](#optimistic-vote) | Vote state calculations | `import { applyVote } from '@/lib/optimistic/vote'`                    |
| [Pagination](#pagination)           | Feed pagination         | `import { buildPostsQueryParams } from '@/lib/pagination'`             |
| [Route Helpers](#route-helpers)     | API route utilities     | `import { withAuth, http } from '@/lib/server/route-helpers'`          |
| [Boards](#boards)                   | Board utilities         | `import { getBoardIdBySlug } from '@/lib/boards/get-board-id-by-slug'` |

---

## API Client

**File:** [`src/lib/api/fetch-json.ts`](../../src/lib/api/fetch-json.ts)

### Usage

```typescript
import { apiFetchJson, apiPost, ApiError } from "@/lib/api/fetch-json";

// GET request
const data = await apiFetchJson<User>("/api/users/123");

// POST request
const result = await apiPost<VoteResponse>("/api/votes", { postId: "123", value: 1 });

// Error handling
try {
  await apiPost("/api/votes", { postId: "123", value: 1 });
} catch (err) {
  if (err instanceof ApiError) {
    console.log(err.status); // 401, 400, etc.
    console.log(err.message);
  }
}
```

### Features

- Automatic `Content-Type: application/json` header
- Type-safe responses with generics
- Standardized error handling with `ApiError` class
- Non-2xx responses throw `ApiError` with status code

---

## Votes API

**File:** [`src/lib/api/votes.ts`](../../src/lib/api/votes.ts)

### Functions

#### `votePost(postId: string, value: 1 | -1): Promise<VoteResponse>`

Vote on a post. The server handles:

- Creating new vote
- Toggling off (send same value again)
- Flipping vote (send opposite value)

```typescript
import { votePost } from "@/lib/api/votes";

const { score } = await votePost("post-123", 1);
```

#### `voteComment(commentId: string, value: 1 | -1): Promise<VoteResponse>`

Vote on a comment.

```typescript
import { voteComment } from "@/lib/api/votes";

const { score } = await voteComment("comment-123", -1);
```

### API Contract

- **Endpoint:** `POST /api/votes`
- **Request:** `{ postId?: string, commentId?: string, value: 1 | -1 }`
- **Response:** `{ score: number }`
- **Errors:** 401 (Unauthorized), 400 (Invalid input), 500 (Server error)

---

## Optimistic Vote

**File:** [`src/lib/optimistic/vote.ts`](../../src/lib/optimistic/vote.ts)

Calculate vote state changes for optimistic UI updates.

### `applyVote(current: VoteState, value: 1 | -1): VoteUpdateResult`

Calculate new score and userVote after a vote action.

```typescript
import { applyVote } from "@/lib/optimistic/vote";

const current = { score: 10, userVote: null };
const result = applyVote(current, 1);
// result: { score: 11, userVote: 1 }

// Toggle off
const toggle = applyVote({ score: 11, userVote: 1 }, 1);
// toggle: { score: 10, userVote: null }

// Flip vote
const flip = applyVote({ score: 11, userVote: -1 }, 1);
// flip: { score: 13, userVote: 1 }
```

### `getVoteScoreDelta(previousVote, newVote): number`

Calculate score change between two vote states.

```typescript
import { getVoteScoreDelta } from "@/lib/optimistic/vote";

getVoteScoreDelta(null, 1); // 1 (new upvote)
getVoteScoreDelta(1, null); // -1 (toggle off upvote)
getVoteScoreDelta(-1, 1); // 2 (flip downvote to upvote)
```

---

## Pagination

**File:** [`src/lib/pagination.ts`](../../src/lib/pagination.ts)

Utilities for feed pagination supporting both offset and cursor-based modes.

### `buildPostsQueryParams(options): URLSearchParams`

Build query parameters for `/api/posts` endpoint.

```typescript
import { buildPostsQueryParams } from "@/lib/pagination";

// Board feed with offset
const params = buildPostsQueryParams({
  board: "general",
  sort: "hot",
  offset: 20,
  limit: 20,
});
// Result: ?board=general&sort=hot&cursor=20&limit=20

// Tag feed with cursor (time-based)
const params = buildPostsQueryParams({
  tag: "javascript",
  sort: "new",
  cursor: "2024-01-15T00:00:00.000Z",
  limit: 20,
});
// Result: ?tag=javascript&sort=new&cursor=2024-01-15T00:00:00.000Z&limit=20
```

### `getNextCursor(items): string | undefined`

Get cursor for next page from last item's `created_at`.

```typescript
import { getNextCursor } from '@/lib/pagination';

const posts = [{ created_at: '2024-01-15T10:00:00Z' }, ...];
const nextCursor = getNextCursor(posts);
// '2024-01-15T10:00:00Z'
```

### Pagination Modes

| Mode     | Use Case                         | Parameter                  |
| -------- | -------------------------------- | -------------------------- |
| `offset` | Cached rankings (hot/rising/top) | `cursor` = page number     |
| `cursor` | Time-based sorts (new)           | `cursor` = ISO date string |

---

## Route Helpers

**File:** [`src/lib/server/route-helpers.ts`](../../src/lib/server/route-helpers.ts)

Reduce boilerplate in Next.js API routes.

### `withAuth(handler)`

Wrap route handler with authentication check.

```typescript
import { withAuth, http, parseJsonBody } from "@/lib/server/route-helpers";

export const POST = withAuth(async (req, { user, supabase }) => {
  // User is guaranteed to be authenticated
  const body = await parseJsonBody(req);

  // Your logic here...

  return http.ok({ id: "123" });
});
```

### HTTP Helpers

Use `http.*` for error responses to keep the API error shape consistent (`{ error: string }`) and avoid accidentally returning non-JSON error bodies.

```typescript
import { http } from "@/lib/server/route-helpers";

http.ok(data); // 200
http.created(data); // 201
http.badRequest(message); // 400
http.unauthorized(message); // 401
http.forbidden(message); // 403
http.notFound(message); // 404
http.conflict(message); // 409
http.internalError(message); // 500
```

### `parseJsonBody(req)`

Parse JSON body with error handling.

```typescript
import { parseJsonBody } from "@/lib/server/route-helpers";

const body = await parseJsonBody(req);
if (body instanceof Response) {
  // Invalid JSON, error response already returned
  return body;
}
// body is the parsed JSON
```

### `validateBody(body, requiredFields)`

Validate required fields in request body.

```typescript
import { validateBody } from "@/lib/server/route-helpers";

const validation = validateBody(body, ["title", "boardId"]);
if (!validation.valid) {
  return validation.response; // 400 with missing fields message
}
const { title, boardId } = validation.data;
```

---

## Test Utilities

**Directory:** [`src/test-utils/`](../../src/test-utils/)

### Mocking Next.js Headers

**File:** [`src/test-utils/next-headers.ts`](../../src/test-utils/next-headers.ts)

```typescript
import { mockCookieJar, mockCookieStore } from "@/test-utils/next-headers";

// Set cookies before test
mockCookieJar.set("sb-access-token", "test-token");
```

### Supabase Mock Builder

**File:** [`src/test-utils/supabase-mock.ts`](../../src/test-utils/supabase-mock.ts)

```typescript
import { createSupabaseMock } from "@/test-utils/supabase-mock";

const supabaseMock = createSupabaseMock();
supabaseMock.auth.getUser.mockResolvedValue({
  data: { user: { id: "user123" } },
  error: null,
});
```

---

## Testing

All libraries have comprehensive tests:

```bash
# Run all library tests
npm test src/lib/api src/lib/optimistic src/lib/pagination src/lib/server

# Run specific test file
npm test src/lib/api/fetch-json.test.ts
npm test src/lib/optimistic/vote.test.ts
npm test src/lib/pagination.test.ts
npm test src/lib/server/route-helpers.test.ts
```

### Test Count

- `src/lib/api/fetch-json.test.ts`: 5 tests
- `src/lib/optimistic/vote.test.ts`: 13 tests
- `src/lib/pagination.test.ts`: 22 tests
- `src/lib/server/route-helpers.test.ts`: 22 tests

---

## Migration Guide

### Migrating Existing Components

**Before:**

```typescript
const res = await fetch("/api/votes", {
  method: "POST",
  body: JSON.stringify({ post_id: postId, value }),
});
const data = await res.json();
```

**After:**

```typescript
import { votePost } from "@/lib/api/votes";
const { score } = await votePost(postId, value);
```

### Migrating API Routes

**Before:**

```typescript
export async function POST(req: Request) {
  const supabase = await createClient(cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ... handler logic
}
```

**After:**

```typescript
export const POST = withAuth(async (req, { user, supabase }) => {
  // User is guaranteed to be authenticated
  // ... handler logic
  // Errors
  // return http.badRequest("...");
  // return http.unauthorized();
  // return http.internalError("...");
});
```

---

## Boards

**File:** [`src/lib/boards/get-board-id-by-slug.ts`](../../src/lib/boards/get-board-id-by-slug.ts)

Shared helper to resolve `boardId` from a `slug` using an existing Supabase client.

### `getBoardIdBySlug(supabase, slug)`

```typescript
import { getBoardIdBySlug } from "@/lib/boards/get-board-id-by-slug";
import { http } from "@/lib/server/route-helpers";

const result = await getBoardIdBySlug(supabase, slug);
if ("error" in result) {
  if (result.error === "not_found") return http.notFound("Board not found");
  return http.internalError("Failed to load board");
}

const boardId = result.boardId;
```

Use this helper in API routes to avoid duplicating:

```typescript
await supabase.from("boards").select("id").eq("slug", slug).single();
```
