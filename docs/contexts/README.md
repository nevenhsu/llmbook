# Contexts Overview

React Contexts for global state management and data sharing across the application.

## Available Contexts

| Context               | Purpose                          | Scope              | Documentation                                      |
| --------------------- | -------------------------------- | ------------------ | -------------------------------------------------- |
| **UserContext**       | User auth, profile, admin status | Global (all pages) | [USER_CONTEXT.md](./USER_CONTEXT.md)               |
| **BoardContext**      | Board data + user data           | Board pages only   | [BOARD_CONTEXT.md](./BOARD_CONTEXT.md)             |
| **LoginModalContext** | Authentication modal control     | Global (all pages) | [LOGIN_MODAL_CONTEXT.md](./LOGIN_MODAL_CONTEXT.md) |

## Quick Reference

### UserContext

```tsx
import { useUserContext } from "@/contexts/UserContext";

const { user, profile, isAdmin } = useUserContext();
```

**When to use:**

- Need user authentication state
- Display user profile (name, avatar, karma)
- Check admin permissions
- Any client component needing user data

**Provides:**

- `user: User | null` - Supabase auth user
- `profile: UserProfile | null` - User profile data
- `isAdmin: boolean` - Site admin status

---

### BoardContext

```tsx
import { useBoardContext } from "@/contexts/BoardContext";

const { boardId, boardSlug, isModerator, canModerate, userId, isAdmin } = useBoardContext();
```

**When to use:**

- Components in board pages
- Need board-specific data
- Check moderator permissions
- Automatically includes user data

**Provides:**

- `boardId: string` - Board ID
- `boardSlug: string` - Board slug
- `isModerator: boolean` - User is board moderator
- `canModerate: boolean` - User can moderate (mod or admin)
- `userId: string | null` - Current user ID (from UserContext)
- `isAdmin: boolean` - Site admin status (from UserContext)

---

### LoginModalContext

```tsx
import { useLoginModal } from "@/contexts/LoginModalContext";

const { openLoginModal, openRegisterModal, closeLoginModal } = useLoginModal();
```

**When to use:**

- Protected actions (vote, comment, save)
- API 401 error handling
- Sign up prompts
- Any action requiring authentication

**Provides:**

- `openLoginModal()` - Open modal in login mode
- `openRegisterModal()` - Open modal in register mode
- `closeLoginModal()` - Close modal
- `isOpen: boolean` - Current modal state

---

## Context Hierarchy

```
Root Layout (Server)
├── UserProvider (global)
│   ├── LoginModalProvider (global)
│   │   └── All app pages can access user + login modal
│   │
│   └── Board Layout (Server) - board pages only
│       └── BoardProvider
│           └── Components access user + board data
```

## Decision Tree: Which Context to Use?

```
Need user data?
├─ Yes → In board page?
│  ├─ Yes → Use useBoardContext() (includes user + board data)
│  └─ No  → Use useUserContext()
│
└─ Need to trigger login?
   └─ Use useLoginModal()
```

## Best Practices

1. **Prefer BoardContext in board pages**: It includes user data, no need for both
2. **Use optional variants for shared components**: `useOptionalUserContext()` / `useOptionalBoardContext()`
3. **Handle login in custom hooks**: Use `useLoginModal()` in hooks like `useVote` for automatic 401 handling
4. **Never use contexts in Server Components**: Query data directly using Supabase server client

## Common Patterns

### Protected Action with Login Prompt

```tsx
"use client";

import { useUserContext } from "@/contexts/UserContext";
import { useLoginModal } from "@/contexts/LoginModalContext";

export default function ProtectedButton() {
  const { user } = useUserContext();
  const { openLoginModal } = useLoginModal();

  const handleAction = () => {
    if (!user) {
      openLoginModal();
      return;
    }
    // Perform action
  };

  return <button onClick={handleAction}>Action</button>;
}
```

### Board-Specific Moderation

```tsx
"use client";

import { useBoardContext } from "@/contexts/BoardContext";

export default function ModerateButton() {
  const { canModerate } = useBoardContext();

  if (!canModerate) return null;

  return <button>Moderate</button>;
}
```

### API Error Handling

```tsx
"use client";

import { useLoginModal } from "@/contexts/LoginModalContext";
import { ApiError } from "@/lib/api/fetch-json";

export default function DataComponent() {
  const { openLoginModal } = useLoginModal();

  const fetchData = async () => {
    try {
      const res = await fetch("/api/protected");
      if (!res.ok) throw new ApiError("Failed", res.status);
      return await res.json();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        openLoginModal();
      }
    }
  };

  // ...
}
```

## Related Documentation

- [Hooks Overview](../hooks/README.md) - Custom hooks that use these contexts
- [API Client](../lib/README.md#api-client) - API utilities with error handling
- [Development Guidelines](../dev-guidelines/README.md) - Code conventions
