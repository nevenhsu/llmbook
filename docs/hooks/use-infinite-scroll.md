# useInfiniteScroll Hook

## Overview

The `useInfiniteScroll` hook provides automatic infinite scroll pagination using the Intersection Observer API.

## Features

- ✅ **Automatic loading**: Triggers when sentinel element is visible
- ✅ **Performance optimized**: Uses IntersectionObserver (no scroll listeners)
- ✅ **Configurable threshold**: Control when loading triggers
- ✅ **Enable/disable**: Toggle functionality dynamically
- ✅ **SSR safe**: Handles missing IntersectionObserver gracefully

## Usage

```tsx
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

function PostList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = async () => {
    setIsLoading(true);
    try {
      const newPosts = await fetchMorePosts(posts.length);
      setPosts(prev => [...prev, ...newPosts]);
      setHasMore(newPosts.length > 0);
    } finally {
      setIsLoading(false);
    }
  };

  const sentinelRef = useInfiniteScroll(loadMore, hasMore, isLoading);

  return (
    <div>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
      {/* Sentinel element - triggers loading when visible */}
      <div ref={sentinelRef} />
      {isLoading && <Spinner />}
      {!hasMore && <div>No more posts</div>}
    </div>
  );
}
```

## API

### Parameters

```typescript
function useInfiniteScroll(
  loadMore: () => void | Promise<void>,  // Function to load more data
  hasMore: boolean,                      // Whether more data is available
  isLoading: boolean,                    // Whether currently loading
  options?: UseInfiniteScrollOptions     // Optional configuration
): RefObject<HTMLDivElement>             // Ref for sentinel element
```

### Options

```typescript
interface UseInfiniteScrollOptions {
  enabled?: boolean;      // Enable/disable (default: true)
  threshold?: number;     // Intersection threshold 0-1 (default: 0.1)
  rootMargin?: string;    // Root margin for IntersectionObserver (e.g., "100px")
}
```

### Return Value

```typescript
RefObject<HTMLDivElement>  // Attach to sentinel element
```

## Behavior Details

### When Loading Triggers

Loading triggers when **all** conditions are met:
1. ✅ `enabled === true`
2. ✅ `hasMore === true`
3. ✅ `isLoading === false`
4. ✅ Sentinel element is visible (IntersectionObserver detects intersection)

### Threshold

The `threshold` option controls how much of the sentinel element must be visible:

- `0`: Triggers as soon as any pixel is visible
- `0.1` (default): Triggers when 10% is visible
- `0.5`: Triggers when 50% is visible
- `1.0`: Triggers when 100% is visible

### Root Margin

The `rootMargin` option extends the viewport boundary:

```tsx
// Trigger 200px before sentinel enters viewport
useInfiniteScroll(loadMore, hasMore, isLoading, {
  rootMargin: "200px",
});
```

## Examples

### Basic Usage

```tsx
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

function PostList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = async () => {
    setIsLoading(true);
    const newPosts = await fetchPosts({ offset: posts.length, limit: 20 });
    setPosts(prev => [...prev, ...newPosts]);
    setHasMore(newPosts.length === 20);
    setIsLoading(false);
  };

  const sentinelRef = useInfiniteScroll(loadMore, hasMore, isLoading);

  return (
    <div>
      {posts.map(post => <PostCard key={post.id} post={post} />)}
      <div ref={sentinelRef} className="h-10" /> {/* Sentinel */}
      {isLoading && <LoadingSpinner />}
      {!hasMore && <EndOfList />}
    </div>
  );
}
```

### With Early Loading (Root Margin)

```tsx
// Start loading 300px before sentinel is visible
const sentinelRef = useInfiniteScroll(loadMore, hasMore, isLoading, {
  rootMargin: "300px",
});
```

### With Custom Threshold

```tsx
// Only trigger when sentinel is 50% visible
const sentinelRef = useInfiniteScroll(loadMore, hasMore, isLoading, {
  threshold: 0.5,
});
```

### With Enable/Disable Toggle

```tsx
function PostList({ autoLoad }: { autoLoad: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = async () => {
    setIsLoading(true);
    const newPosts = await fetchPosts({ offset: posts.length });
    setPosts(prev => [...prev, ...newPosts]);
    setHasMore(newPosts.length > 0);
    setIsLoading(false);
  };

  const sentinelRef = useInfiniteScroll(loadMore, hasMore, isLoading, {
    enabled: autoLoad, // Dynamically enable/disable
  });

  return (
    <div>
      {posts.map(post => <PostCard key={post.id} post={post} />)}
      <div ref={sentinelRef} />
      {!autoLoad && hasMore && (
        <button onClick={loadMore}>Load More</button>
      )}
    </div>
  );
}
```

### With Server-Side Rendering

```tsx
function PostList({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = async () => {
    setIsLoading(true);
    const newPosts = await fetchPosts({ offset: posts.length });
    setPosts(prev => [...prev, ...newPosts]);
    setHasMore(newPosts.length > 0);
    setIsLoading(false);
  };

  // SSR safe: hook handles missing IntersectionObserver
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

### With Tabs (Enable/Disable by Tab)

```tsx
function TabbedPostList() {
  const [activeTab, setActiveTab] = useState<"hot" | "new">("hot");
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = async () => {
    setIsLoading(true);
    const newPosts = await fetchPosts({
      filter: activeTab,
      offset: posts.length,
    });
    setPosts(prev => [...prev, ...newPosts]);
    setHasMore(newPosts.length > 0);
    setIsLoading(false);
  };

  // Only enable infinite scroll on "new" tab
  const sentinelRef = useInfiniteScroll(loadMore, hasMore, isLoading, {
    enabled: activeTab === "new",
  });

  return (
    <div>
      <Tabs value={activeTab} onChange={setActiveTab} />
      {posts.map(post => <PostCard key={post.id} post={post} />)}
      <div ref={sentinelRef} />
      {activeTab === "hot" && hasMore && (
        <button onClick={loadMore}>Load More</button>
      )}
    </div>
  );
}
```

## Common Pitfalls

### ❌ Not Setting hasMore Correctly

```tsx
// Bad: Never stops loading
const loadMore = async () => {
  const newPosts = await fetchPosts();
  setPosts(prev => [...prev, ...newPosts]);
  // Missing: setHasMore(newPosts.length > 0);
};

// Good: Stop when no more data
const loadMore = async () => {
  const newPosts = await fetchPosts();
  setPosts(prev => [...prev, ...newPosts]);
  setHasMore(newPosts.length > 0); // or check specific limit
};
```

### ❌ Sentinel Element Not Visible

```tsx
// Bad: Sentinel has no height, never triggers
<div ref={sentinelRef} />

// Good: Give sentinel some height or use margin
<div ref={sentinelRef} className="h-10" />
```

### ❌ Not Handling Loading State

```tsx
// Bad: Can trigger multiple loads
const loadMore = async () => {
  const newPosts = await fetchPosts(); // No loading state
  setPosts(prev => [...prev, ...newPosts]);
};

// Good: Set loading state
const loadMore = async () => {
  setIsLoading(true);
  try {
    const newPosts = await fetchPosts();
    setPosts(prev => [...prev, ...newPosts]);
  } finally {
    setIsLoading(false);
  }
};
```

### ❌ Forgetting to Reset on Filter Change

```tsx
// Bad: Keeps old posts when filter changes
const handleFilterChange = (filter: string) => {
  setFilter(filter);
  // Missing: reset posts and hasMore
};

// Good: Reset state
const handleFilterChange = (filter: string) => {
  setFilter(filter);
  setPosts([]);
  setHasMore(true);
  setIsLoading(false);
};
```

## Performance Considerations

1. **Use IntersectionObserver**: This hook uses IntersectionObserver (not scroll listeners), which is very performant
2. **Debounce loadMore if needed**: If loadMore is expensive, consider debouncing
3. **Virtualize long lists**: For very long lists (1000+ items), use virtualization libraries like `react-window`

## Browser Compatibility

- ✅ Modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Gracefully handles SSR (no IntersectionObserver on server)
- ❌ IE11: Not supported (IntersectionObserver not available)

## Related

- [Pagination Utilities](../lib/README.md#pagination) - Build query params for pagination
- [API Client](../lib/README.md#api-client) - Fetch data from API

## Implementation Details

Located at: `src/hooks/use-infinite-scroll.ts:1`

Key dependencies:
- Uses `IntersectionObserver` API
- Refs to avoid stale closures
