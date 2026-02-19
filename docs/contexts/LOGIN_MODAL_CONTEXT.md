# LoginModalContext Usage Guide

## Overview

`LoginModalContext` provides global control over the authentication modal (login/register). Use this to trigger authentication flows from anywhere in the app.

## What's Available

```typescript
interface LoginModalContextType {
  openLoginModal: () => void;      // Open modal in login mode
  openRegisterModal: () => void;   // Open modal in register mode
  closeLoginModal: () => void;     // Close the modal
  isOpen: boolean;                 // Current modal state
}
```

## When to Use

### ✅ Triggering Authentication

Use `useLoginModal()` when you need to prompt user to log in:

```tsx
"use client";

import { useLoginModal } from "@/contexts/LoginModalContext";

export default function ProtectedAction() {
  const { openLoginModal } = useLoginModal();

  const handleAction = () => {
    // Check if user is logged in
    if (!userId) {
      openLoginModal();
      return;
    }
    
    // Perform action
  };

  return <button onClick={handleAction}>Vote</button>;
}
```

## Architecture

```
Root Layout
└── LoginModalProvider
    ├── Provides modal controls globally
    └── Renders <AuthModal /> at root level
```

The modal is rendered at the root level, so it can be triggered from any component in the tree.

## Common Patterns

### Protected Actions (Voting, Commenting, etc.)

```tsx
"use client";

import { useLoginModal } from "@/contexts/LoginModalContext";
import { useUserContext } from "@/contexts/UserContext";

export default function VoteButton() {
  const { user } = useUserContext();
  const { openLoginModal } = useLoginModal();

  const handleVote = () => {
    if (!user) {
      openLoginModal();
      return;
    }
    
    // Perform vote
  };

  return <button onClick={handleVote}>Vote</button>;
}
```

### API Error Handling (401 Unauthorized)

```tsx
"use client";

import { useLoginModal } from "@/contexts/LoginModalContext";
import { ApiError } from "@/lib/api/fetch-json";

export default function DataFetcher() {
  const { openLoginModal } = useLoginModal();

  const fetchData = async () => {
    try {
      const data = await apiPost("/api/some-endpoint", {});
      return data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        openLoginModal();
        return;
      }
      throw err;
    }
  };

  // ...
}
```

### Redirect to Registration

```tsx
"use client";

import { useLoginModal } from "@/contexts/LoginModalContext";

export default function SignupPrompt() {
  const { openRegisterModal } = useLoginModal();

  return (
    <div>
      <p>Join our community!</p>
      <button onClick={openRegisterModal}>
        Sign Up
      </button>
    </div>
  );
}
```

### Custom Hook Integration

This context is commonly used inside custom hooks like `useVote`:

```tsx
import { useLoginModal } from "@/contexts/LoginModalContext";

export function useVote({ voteFn, id }: Options) {
  const { openLoginModal } = useLoginModal();

  const handleVote = async (value: 1 | -1) => {
    try {
      await voteFn(id, value);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        openLoginModal(); // Automatically prompt login
      }
    }
  };

  return { handleVote };
}
```

## Best Practices

1. **Always check authentication first**: Verify user is logged in before opening modal
2. **Use in error boundaries**: Catch 401 errors and trigger login modal
3. **Don't abuse**: Only use for truly protected actions, not as general navigation
4. **Prefer `openLoginModal` over `openRegisterModal`**: Let users choose mode in the modal

## Common Use Cases

| Use Case | Method | Example |
|----------|--------|---------|
| Vote on post/comment | `openLoginModal()` | User clicks vote button |
| Post comment | `openLoginModal()` | User submits comment form |
| Save post | `openLoginModal()` | User clicks save button |
| API 401 error | `openLoginModal()` | Session expired |
| Sign up CTA | `openRegisterModal()` | Marketing/landing page |

## Integration Examples

### With `useVote` Hook

See: [useVote documentation](../hooks/use-vote.md)

The `useVote` hook automatically handles login prompts on 401 errors.

### With `usePostInteractions` Hook

See: [usePostInteractions documentation](../hooks/use-post-interactions.md)

The `usePostInteractions` hook automatically handles login prompts for save/hide actions.

## Related

- [UserContext](./USER_CONTEXT.md) - Check current user state
- [useVote Hook](../hooks/use-vote.md) - Voting with auto-login
- [usePostInteractions Hook](../hooks/use-post-interactions.md) - Save/hide with auto-login
