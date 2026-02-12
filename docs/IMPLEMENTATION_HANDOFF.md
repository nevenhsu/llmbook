# Webapp 測試/重構交付索引

## ✅ 已完成項目

### 測試 (73 tests passed)
| 類別 | 測試數 | 內容 |
|------|--------|------|
| API Routes | 11 | Votes + Posts API contract tests |
| Library | 62 | fetch-json, vote logic, pagination, route-helpers |

### Phase 1: API Contract Tests ✅
- **Votes API** (`src/app/api/votes/__tests__/votes.test.ts`): 7 tests
  - 未登入 401、投票創建/切換/翻轉、評論投票
  - Regression: `postId` (camelCase), `value` 不接受 null
  
- **Posts API** (`src/app/api/posts/__tests__/posts.test.ts`): 4 tests
  - hot/rising cached rankings、pagination (cursor/offset)、invalid filters

### Phase 2: 共用 Library ✅

#### Client-side
```
src/lib/api/
├── fetch-json.ts          # Typed API client + error handling
├── fetch-json.test.ts     # 5 tests
└── votes.ts               # votePost(), voteComment()

src/lib/optimistic/
├── vote.ts                # applyVote(), getVoteScoreDelta()
└── vote.test.ts           # 13 tests

src/hooks/
└── use-vote-mutation.ts   # React hooks (供未來使用)
```

#### Server-side
```
src/lib/server/
├── route-helpers.ts       # withAuth, withErrorHandler, http helpers
└── route-helpers.test.ts  # 22 tests

src/lib/
├── pagination.ts          # Pagination utilities
└── pagination.test.ts     # 22 tests
```

### Phase 3: 重構 Routes ✅

| Route | 使用功能 |
|-------|----------|
| `/api/votes` | `withAuth`, `parseJsonBody`, `validateBody`, `http.ok` |
| `/api/posts/[id]/comments` | `withAuth`, `parseJsonBody`, `validateBody` |
| `/api/comments/[id]` | `withAuth`, `parseJsonBody`, `validateBody` |
| `/api/notifications` | `withAuth`, `parseJsonBody`, `http.ok` |
| `/api/boards` | `withAuth`, `parseJsonBody`, `http.ok/created/conflict` |
| `/api/profile/comments` | `getSupabaseServerClient`, `http` |
| `/api/profile/saved` | `withAuth`, `http` |

### Phase 4: Component 遷移 ✅

| Component | 變更 |
|-----------|------|
| `PostDetailVote.tsx` | 使用 `votePost()` + `applyVote()` |
| `ProfilePostList.tsx` | 統一三個 tabs 的 pagination + infinite scroll |
| `FeedContainer.tsx` | 統一支援 board/tag/author，使用 pagination lib |
| `CommentThread.tsx` | 使用 `voteComment()` |

**已刪除**: `TagFeed.tsx` (被 FeedContainer 取代)

### Phase 5: Profile Page 改進 ✅
- `/u/[username]` 支援 infinite scroll pagination (posts/comments/saved)
- Saved posts 僅本人可見 (API 權限控制)
- Posts/Comments 固定按時間排序 (最新優先)

### 修復的 Contract 問題
1. ✅ `ProfilePostList`: `post_id` → `postId` (camelCase)
2. ✅ `TagFeed`: 不再傳送 `value: null`，統一由 server 處理 toggle

## 測試執行

```bash
# All new tests (73 tests)
npm test src/app/api src/lib/api src/lib/optimistic src/lib/pagination src/lib/server

# Build check
npm run build
```

## 如何使用

### Client: Typed API
```typescript
import { votePost } from '@/lib/api/votes';
import { applyVote } from '@/lib/optimistic/vote';

// Optimistic update
const result = applyVote({ score, userVote }, 1);

// Call API
const { score } = await votePost(postId, 1);
```

### Server: Route Helpers
```typescript
import { withAuth, http, parseJsonBody, validateBody } from '@/lib/server/route-helpers';

export const POST = withAuth(async (req, { user, supabase }) => {
  const body = await parseJsonBody(req);
  if (body instanceof Response) return body;
  
  const validation = validateBody(body, ['title']);
  if (!validation.valid) return validation.response;
  
  return http.ok({ id: '123' });
});
```

### Pagination
```typescript
import { buildPostsQueryParams, getPaginationMode } from '@/lib/pagination';

const params = buildPostsQueryParams({
  author: authorId,
  sort: 'new',
  limit: 20,
  cursor: lastPostCreatedAt,
});
```

## 未完成 (可逐步進行)

- [ ] 其他 routes 遷移到 route-helpers (非緊急)
- [ ] Notifications typed client + hook
- [ ] Board management routes 統一

## 參考文件
- `docs/testing/WEBAPP_MODULE_TEST_PLAN.md`
- `docs/refactor/WEBAPP_REUSE_BLUEPRINT.md`
- `docs/api/WEBAPP_API_CONTRACTS.md`

## Build Status
✅ `npm run build` - Success
✅ `npm test` - 73 tests passed
