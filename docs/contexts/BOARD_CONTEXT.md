# BoardContext Usage Guide

## Overview

`BoardContext` provides board-specific data and automatically integrates user data from `UserContext`. Use this in components within board pages.

## What's Available

```typescript
interface BoardContextWithUser {
  // Board data
  boardId: string;
  boardSlug: string;
  isModerator: boolean;
  canModerate: boolean;
  
  // User data (from UserContext)
  userId: string | null;
  isAdmin: boolean;
}
```

## When to Use

### ✅ Client Components in Board Pages

Use `useBoardContext()` in any client component within a board layout:

```tsx
"use client";

import { useBoardContext } from "@/contexts/BoardContext";

export default function BoardComponent() {
  const { boardId, boardSlug, isModerator, canModerate, userId, isAdmin } = useBoardContext();

  if (!userId) {
    return <div>Please log in to interact</div>;
  }

  return (
    <div>
      <h1>Board: {boardSlug}</h1>
      {(isModerator || isAdmin) && <ModeratorPanel />}
    </div>
  );
}
```

### ✅ Optional Usage (Components Used Across Pages)

Use `useOptionalBoardContext()` when component might be used outside board pages:

```tsx
"use client";

import { useOptionalBoardContext } from "@/contexts/BoardContext";

export default function OptionalComponent() {
  const boardContext = useOptionalBoardContext();

  if (!boardContext) {
    return <GlobalView />;
  }

  return <BoardView boardSlug={boardContext.boardSlug} />;
}
```

## Architecture

```
Root Layout (Server)
└── UserProvider (global)
    └── Board Layout (Server)
        └── BoardProvider
            └── Components access both user + board data via useBoardContext()
```

## Common Patterns

### Moderator/Admin Actions

```tsx
"use client";

import { useBoardContext } from "@/contexts/BoardContext";

export default function PostActions() {
  const { canModerate, isModerator, isAdmin } = useBoardContext();

  return (
    <div>
      <PublicActions />
      {canModerate && (
        <ModeratorActions 
          label={isAdmin ? "Admin" : "Moderator"} 
        />
      )}
    </div>
  );
}
```

### Board-Specific API Calls

```tsx
"use client";

import { useBoardContext } from "@/contexts/BoardContext";
import { apiPost } from "@/lib/api/fetch-json";

export default function CreatePost() {
  const { boardId, userId } = useBoardContext();

  const handleSubmit = async (data: FormData) => {
    if (!userId) {
      // Redirect to login
      return;
    }

    await apiPost(`/api/boards/${boardId}/posts`, {
      title: data.get("title"),
      content: data.get("content"),
    });
  };

  return <PostForm onSubmit={handleSubmit} />;
}
```

### Permission Checks

```tsx
"use client";

import { useBoardContext } from "@/contexts/BoardContext";

export default function DeleteButton({ postAuthorId }: { postAuthorId: string }) {
  const { userId, canModerate } = useBoardContext();

  const canDelete = canModerate || userId === postAuthorId;

  if (!canDelete) return null;

  return <button>Delete</button>;
}
```

## Key Differences from UserContext

| Feature | UserContext | BoardContext |
|---------|-------------|--------------|
| Scope | Global (all pages) | Board pages only |
| User data | ✅ Yes | ✅ Yes (inherited) |
| Board data | ❌ No | ✅ Yes |
| Admin status | ✅ Yes | ✅ Yes (inherited) |
| Moderator status | ❌ No | ✅ Yes |

## Best Practices

1. **Use BoardContext in board pages**: It automatically includes user data, no need to call both hooks
2. **Use canModerate for actions**: It already combines `isModerator || isAdmin`
3. **Check userId before actions**: Always verify user is logged in
4. **Use optional variant carefully**: Only when component is truly multi-context

## Migration Guide

### Before (using both contexts separately)

```tsx
// ❌ Inefficient - calling both hooks
import { useUserContext } from "@/contexts/UserContext";
import { useBoardContext } from "@/contexts/BoardContext";

export default function Component() {
  const { userId, isAdmin } = useUserContext();
  const { boardId, isModerator } = useBoardContext();
  // ...
}
```

### After (using BoardContext only)

```tsx
// ✅ Efficient - single hook with all data
import { useBoardContext } from "@/contexts/BoardContext";

export default function Component() {
  const { userId, isAdmin, boardId, isModerator } = useBoardContext();
  // All data available from one hook!
}
```

## Related

- [UserContext](./USER_CONTEXT.md) - User authentication and profile data
- [LoginModalContext](./LOGIN_MODAL_CONTEXT.md) - Authentication modal control
