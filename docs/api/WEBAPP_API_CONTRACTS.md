# Webapp API Contracts（對齊與測試用，非實作）

> 目的：把 client ↔ server 的 request/response 形狀寫死，讓「測試」與「重構」有共同依據。

## 通用規範

- Content-Type：JSON request 使用 `application/json`
- Error response：建議統一 `{ error: string }`（目前多數 route 已符合）

## Votes

### POST `/api/votes`

現行 server 實作（見 `src/app/api/votes/route.ts`）

Request（唯一允許形狀）：

```json
{ "postId": "uuid", "value": 1 }
```

或

```json
{ "commentId": "uuid", "value": -1 }
```

規則：

- `value` 必須是 `1 | -1`
- toggle off：同一 target 重複送同值，server 會刪除 vote
- flip：送反向值，server 會 update vote

Response（成功）：

```json
{ "score": 123 }
```

Error：

- 401 `{ "error": "Unauthorized" }`
- 400 `{ "error": "Invalid input" }`
- 500 `{ "error": "Internal Server Error" }`

Client 端應對：

- 永遠傳 `1 | -1`（不要傳 null）
- 不要傳 `post_id` / `comment_id`（snake_case）

## Notifications

### GET `/api/notifications`

Response：通知陣列（最多 50）

### PATCH `/api/notifications`

Request：

```json
{ "ids": ["uuid1", "uuid2"] }
```

Response：

```json
{ "success": true }
```

## Media Upload

### POST `/api/media/upload`

Request：`multipart/form-data`

- `file`: File（image/*）
- `maxBytes`（optional）
- `maxWidth`（optional）
- `quality`（optional）

Response：

```json
{ "mediaId": "uuid", "url": "https://...", "width": 1600, "height": 1200, "sizeBytes": 12345 }
```

## Posts List

### GET `/api/posts`

Query params（現況混用，建議重構前先統一）：

- `sort`: `new | top | hot | rising`（以及可能的其他值）
- `board`: board slug
- `tag`: tag slug
- `author`: author id
- `includeArchived`: `true|false`
- `limit`: 1..50

Pagination：

- 目前 `cursor` 的語意不一致（offset vs ISO date）。請在重構時改成明確的 `offset`/`before`（詳見 `docs/refactor/WEBAPP_REUSE_BLUEPRINT.md`）。
