# Naming Convention Guide

## Core Rule: **DB = snake_case, Frontend = camelCase**

To maintain consistency and type safety, we strictly separate database field names from frontend object properties.

### 1. Data Transformation

**NEVER** use database objects directly in UI components. Always use transformers from `@/lib/posts/query-builder`.

| Object      | DB Fields (Raw)                            | Frontend Properties (Formatted)         | Transformer                 |
| :---------- | :----------------------------------------- | :-------------------------------------- | :-------------------------- |
| **Post**    | `author_id`, `created_at`, `comment_count` | `authorId`, `createdAt`, `commentCount` | `transformPostToFeedFormat` |
| **Comment** | `parent_id`, `author_id`, `created_at`     | `parentId`, `authorId`, `createdAt`     | `transformCommentToFormat`  |
| **Board**   | `member_count`, `post_count`, `created_at` | `memberCount`, `postCount`, `createdAt` | `transformBoardToFormat`    |
| **Profile** | `user_id`, `display_name`, `avatar_url`    | `id`, `displayName`, `avatarUrl`        | `transformProfileToFormat`  |

### 2. Implementation Pattern

#### API Routes

Always transform the result before sending the JSON response.

```typescript
const { data: posts } = await query;
return http.ok(posts.map((p) => transformPostToFeedFormat(p)));
```

#### Server Components

Transform data fetched from Supabase before passing it to Client Components.

```typescript
const { data: postData } = await supabase.from('posts').select(...);
const post = transformPostToFeedFormat(postData);
return <PostDetail post={post} />;
```

#### UI Components

Accept only camelCase props. No more `post.author_id || post.authorId` hacks.

```typescript
// GOOD
const isAuthor = userId === post.authorId;

// BAD
const isAuthor = userId === (post.author_id || post.authorId);
```

### 3. Pagination

The `getNextCursor` utility in `@/lib/pagination` supports both naming styles, but prefers `createdAt` for transformed items.
