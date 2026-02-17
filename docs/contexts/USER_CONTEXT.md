# UserContext Usage Guide

## Overview

`UserContext` provides global access to user authentication state and admin status throughout the application.

## What's Available

```typescript
interface UserContextData {
  user: User | null; // Supabase auth user
  profile: UserProfile | null; // User profile data (display_name, avatar_url, username, karma)
  isAdmin: boolean; // Whether user is a site admin
}
```

## When to Use

### ✅ Client Components

Use `useUserContext()` in any client component that needs user information:

```tsx
"use client";

import { useUserContext } from "@/contexts/UserContext";

export default function MyComponent() {
  const { user, profile, isAdmin } = useUserContext();

  if (!user) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <p>Welcome, {profile?.display_name || user.email}</p>
      {isAdmin && <AdminPanel />}
    </div>
  );
}
```

### ✅ Optional Usage (Public Pages)

Use `useOptionalUserContext()` when the component might be used outside UserProvider or on public pages:

```tsx
"use client";

import { useOptionalUserContext } from "@/contexts/UserContext";

export default function OptionalComponent() {
  const userContext = useOptionalUserContext();

  if (!userContext || !userContext.user) {
    return <PublicView />;
  }

  return <AuthenticatedView user={userContext.user} />;
}
```

### ❌ Server Components

**Do NOT use** `useUserContext()` in Server Components. Instead, query directly:

```tsx
// Server Component
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

export default async function ServerPage() {
  const supabase = await createClient(cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userIsAdmin = user ? await isAdmin(user.id, supabase) : false;

  // Use user and userIsAdmin here
}
```

## BoardContext Integration

`BoardContext` now automatically includes user data from `UserContext`:

```tsx
"use client";

import { useBoardContext } from "@/contexts/BoardContext";

export default function BoardComponent() {
  const {
    boardId,
    boardSlug,
    isModerator,
    canModerate,
    // These come from UserContext:
    userId,
    isAdmin,
  } = useBoardContext();

  // Use board and user data together
}
```

## Architecture

```
Root Layout (Server)
├── Queries: user, profile, isAdmin
├── Provides: UserProvider
│   ├── Available globally in all client components
│   └── Board Layout (Server)
│       ├── Queries: board data, moderator status
│       └── Provides: BoardProvider
│           └── Combines board + user data via useBoardContext()
```

## Common Patterns

### Admin-Only Features

```tsx
"use client";

import { useUserContext } from "@/contexts/UserContext";

export default function FeatureWithAdminOption() {
  const { isAdmin } = useUserContext();

  return (
    <div>
      <RegularFeature />
      {isAdmin && <AdminOnlyFeature />}
    </div>
  );
}
```

### Authenticated Actions

```tsx
"use client";

import { useUserContext } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";

export default function AuthenticatedButton() {
  const { user } = useUserContext();
  const router = useRouter();

  const handleAction = () => {
    if (!user) {
      router.push("/login");
      return;
    }

    // Perform authenticated action
  };

  return <button onClick={handleAction}>{user ? "Do Action" : "Log In to Continue"}</button>;
}
```

### User Profile Display

```tsx
"use client";

import { useUserContext } from "@/contexts/UserContext";

export default function UserGreeting() {
  const { user, profile } = useUserContext();

  if (!user) return null;

  return (
    <div>
      <Avatar src={profile?.avatar_url} />
      <span>{profile?.display_name || user.email}</span>
      <span>{profile?.karma} karma</span>
    </div>
  );
}
```

## Migration Guide

### Before (each component queries separately)

```tsx
// ❌ Old way - inefficient, multiple queries
export default async function Page() {
  const supabase = await createClient(cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userIsAdmin = user ? await isAdmin(user.id) : false;
  // ... rest of component
}
```

### After (use context)

```tsx
// ✅ New way - single query at root, available everywhere
"use client";

export default function PageContent() {
  const { user, isAdmin } = useUserContext();
  // No additional queries needed!
}
```

## Benefits

1. **Performance**: Single query at root instead of repeated queries
2. **Consistency**: Same user data across all components
3. **Simplicity**: No need to pass user props through component tree
4. **Type Safety**: Typed context with full IntelliSense support
