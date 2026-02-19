# Hooks Overview

Custom React hooks for common functionality and patterns.

## Categories

### 🎯 User Interactions
| Hook | Purpose | Documentation |
|------|---------|---------------|
| `useVote` | Vote on posts/comments with optimistic updates | [use-vote.md](./use-vote.md) |
| `usePostInteractions` | Save/hide posts | [use-post-interactions.md](./use-post-interactions.md) |

### 🎨 UI & Display
| Hook | Purpose | File |
|------|---------|------|
| `useInfiniteScroll` | Infinite scroll pagination | [use-infinite-scroll.md](./use-infinite-scroll.md) |
| `useTheme` | Theme management (light/dark/system) | `src/hooks/use-theme.ts` |
| `useWindowSize` | Responsive window dimensions | `src/hooks/use-window-size.ts` |
| `useIsBreakpoint` | Tailwind breakpoint detection | `src/hooks/use-is-breakpoint.ts` |
| `useElementRect` | Element dimensions tracking | `src/hooks/use-element-rect.ts` |
| `useCursorVisibility` | Track cursor visibility state | `src/hooks/use-cursor-visibility.ts` |
| `useScrolling` | Detect scrolling state | `src/hooks/use-scrolling.ts` |
| `useMenuNavigation` | Keyboard navigation for menus | `src/hooks/use-menu-navigation.ts` |

### ✏️ Editors
| Hook | Purpose | File |
|------|---------|------|
| `useTiptapEditor` | Rich text editor (TipTap) | `src/hooks/use-tiptap-editor.ts` |
| `useRulesEditor` | Board rules editor | `src/hooks/use-rules-editor.ts` |

### 📊 Data Fetching
| Hook | Purpose | File |
|------|---------|------|
| `useProfileData` | Fetch user profile data | `src/hooks/use-profile-data.ts` |
| `useUserList` | Fetch user lists | `src/hooks/use-user-list.ts` |

### 🛠️ Utilities
| Hook | Purpose | File |
|------|---------|------|
| `useThrottledCallback` | Throttle callback execution | `src/hooks/use-throttled-callback.ts` |
| `useUnmount` | Run cleanup on unmount | `src/hooks/use-unmount.ts` |
| `useComposedRef` | Compose multiple refs | `src/hooks/use-composed-ref.ts` |

## Quick Examples

### Voting on Posts/Comments

```tsx
import { useVote } from "@/hooks/use-vote";
import { votePost } from "@/lib/api/votes";

function PostVoteButtons({ post }: { post: Post }) {
  const { score, userVote, handleVote, voteDisabled } = useVote({
    id: post.id,
    initialScore: post.score,
    initialUserVote: post.user_vote,
    voteFn: votePost,
    disabled: post.status === "ARCHIVED",
  });

  return (
    <div>
      <button 
        onClick={() => handleVote(1)} 
        disabled={voteDisabled}
      >
        ▲ {userVote === 1 ? "Upvoted" : "Upvote"}
      </button>
      <span>{score}</span>
      <button 
        onClick={() => handleVote(-1)} 
        disabled={voteDisabled}
      >
        ▼ {userVote === -1 ? "Downvoted" : "Downvote"}
      </button>
    </div>
  );
}
```

### Saving/Hiding Posts

```tsx
import { usePostInteractions } from "@/hooks/use-post-interactions";

function PostActions({ postId, initialSaved }: Props) {
  const { saved, hidden, handleSave, handleHide } = usePostInteractions({
    postId,
    initialSaved,
  });

  if (hidden) return null;

  return (
    <div>
      <button onClick={handleSave}>
        {saved ? "Unsave" : "Save"}
      </button>
      <button onClick={handleHide}>Hide</button>
    </div>
  );
}
```

### Infinite Scroll

```tsx
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

function PostList({ posts, hasMore, isLoading, loadMore }: Props) {
  const sentinelRef = useInfiniteScroll(loadMore, hasMore, isLoading);

  return (
    <div>
      {posts.map(post => <PostCard key={post.id} post={post} />)}
      <div ref={sentinelRef} />
      {isLoading && <Spinner />}
    </div>
  );
}
```

### Theme Toggle

```tsx
import { useTheme } from "@/hooks/use-theme";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      {theme === "dark" ? "🌙" : "☀️"}
    </button>
  );
}
```

### Responsive Breakpoints

```tsx
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint";

function ResponsiveComponent() {
  const isMobile = useIsBreakpoint("md", "max"); // max-width: md

  return (
    <div>
      {isMobile ? <MobileView /> : <DesktopView />}
    </div>
  );
}
```

## Hook Development Guidelines

### When to Create a Custom Hook

Create a custom hook when:
1. **Reusable logic**: Used in 2+ components
2. **Complex state management**: Multiple useState/useEffect interactions
3. **Side effects**: API calls, subscriptions, timers
4. **Context consumption**: Wrapping useContext with additional logic

### Hook Naming Convention

- ✅ `use<Feature>` - e.g., `useVote`, `useTheme`
- ✅ `use<Action><Target>` - e.g., `useInfiniteScroll`, `usePostInteractions`
- ❌ Avoid generic names like `useData`, `useApi`

### Hook Structure Template

```tsx
"use client";

import { useState, useCallback } from "react";

interface UseFeatureOptions {
  // Required options
  id: string;
  // Optional options with defaults
  enabled?: boolean;
}

interface UseFeatureReturn {
  // State
  data: Data | null;
  isLoading: boolean;
  error: Error | null;
  // Actions
  refetch: () => Promise<void>;
}

export function useFeature({
  id,
  enabled = true,
}: UseFeatureOptions): UseFeatureReturn {
  const [data, setData] = useState<Data | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    
    setIsLoading(true);
    try {
      const result = await fetchData(id);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [id, enabled]);

  return { data, isLoading, error, refetch };
}
```

### Best Practices

1. **Always type options and return values**: Use TypeScript interfaces
2. **Document parameters**: Add JSDoc comments for complex options
3. **Handle edge cases**: Disabled state, missing data, errors
4. **Optimize with useCallback/useMemo**: Prevent unnecessary re-renders
5. **Use refs for non-reactive values**: Avoid stale closures
6. **Clean up side effects**: Return cleanup function from useEffect
7. **Test thoroughly**: Unit test hooks with @testing-library/react-hooks

### Common Patterns

#### Optimistic Updates

See: [useVote](./use-vote.md) for full example

```tsx
const handleAction = async () => {
  // 1. Save previous state
  const previous = state;
  
  // 2. Update optimistically
  setState(newState);
  
  try {
    // 3. Call API
    await apiCall();
  } catch (err) {
    // 4. Rollback on error
    setState(previous);
  }
};
```

#### Debouncing/Throttling

```tsx
import { useThrottledCallback } from "@/hooks/use-throttled-callback";

const throttledSearch = useThrottledCallback(
  (query: string) => {
    performSearch(query);
  },
  500, // 500ms delay
);
```

#### Refs for Fresh Values in Callbacks

```tsx
const valueRef = useRef(value);
valueRef.current = value; // Always fresh

useEffect(() => {
  const timer = setTimeout(() => {
    console.log(valueRef.current); // Never stale
  }, 1000);
  return () => clearTimeout(timer);
}, []); // No dependencies needed
```

## Related Documentation

- [Contexts](../contexts/README.md) - React contexts used by hooks
- [API Client](../lib/README.md#api-client) - API utilities for data fetching
- [Development Guidelines](../dev-guidelines/README.md) - Code conventions
