# usePostInteractions Hook

## Overview

The `usePostInteractions` hook manages **saving** and **hiding** posts with automatic login prompts and optimistic updates.

## Features

- ✅ **Save/unsave posts**: Toggle saved state
- ✅ **Hide/unhide posts**: Toggle hidden state
- ✅ **Automatic login prompt**: Opens login modal on 401 errors
- ✅ **Optimistic updates**: UI updates immediately
- ✅ **Toast notifications**: Success/error feedback

## Usage

```tsx
import { usePostInteractions } from "@/hooks/use-post-interactions";

function PostActions({ post }: { post: Post }) {
  const { saved, hidden, handleSave, handleHide, handleUnhide } = usePostInteractions({
    postId: post.id,
    initialSaved: post.is_saved ?? false,
    initialHidden: post.is_hidden ?? false,
  });

  // Don't render if post is hidden
  if (hidden) {
    return <div>Post hidden</div>;
  }

  return (
    <div className="flex gap-2">
      <button onClick={handleSave}>{saved ? "★ Saved" : "☆ Save"}</button>
      <button onClick={handleHide}>Hide Post</button>
    </div>
  );
}
```

## API

### Parameters

```typescript
interface UsePostInteractionsOptions {
  postId: string; // Post ID
  initialSaved?: boolean; // Initial saved state (default: false)
  initialHidden?: boolean; // Initial hidden state (default: false)
}
```

### Return Value

```typescript
interface UsePostInteractionsReturn {
  saved: boolean; // Current saved state
  hidden: boolean; // Current hidden state
  handleSave: () => Promise<void>; // Toggle save/unsave
  handleHide: () => Promise<void>; // Hide post
  handleUnhide: () => Promise<void>; // Unhide post
}
```

## Behavior Details

### Save/Unsave

When user clicks save:

1. **Optimistic update**: `saved` state toggles immediately
2. **API call**: `POST /api/saved/:postId` or `DELETE /api/saved/:postId`
3. **Success**: Shows toast "Post saved" or "Post unsaved"
4. **Error (401)**: Opens login modal
5. **Error (other)**: Shows toast "Failed to save post", keeps optimistic state

### Hide Post

When user clicks hide:

1. **API call**: `POST /api/hidden/:postId`
2. **Success**: Sets `hidden = true`
3. **Error (401)**: Opens login modal
4. **Error (other)**: Silent failure (no rollback)

### Unhide Post

When user unhides:

1. **API call**: `DELETE /api/hidden/:postId`
2. **Success**: Sets `hidden = false`
3. **Error (401)**: Opens login modal
4. **Error (other)**: Silent failure

## Examples

### Basic Usage

```tsx
import { usePostInteractions } from "@/hooks/use-post-interactions";

function PostCard({ post }: { post: Post }) {
  const { saved, handleSave } = usePostInteractions({
    postId: post.id,
    initialSaved: post.is_saved,
  });

  return (
    <div>
      <h2>{post.title}</h2>
      <button onClick={handleSave}>{saved ? "Unsave" : "Save"}</button>
    </div>
  );
}
```

### Hide Post with Conditional Rendering

```tsx
import { usePostInteractions } from "@/hooks/use-post-interactions";

function PostListItem({ post }: { post: Post }) {
  const { hidden, handleHide } = usePostInteractions({
    postId: post.id,
    initialHidden: post.is_hidden,
  });

  if (hidden) {
    return <div className="italic text-gray-500">Post hidden</div>;
  }

  return (
    <div>
      <h3>{post.title}</h3>
      <button onClick={handleHide}>Hide</button>
    </div>
  );
}
```

### Dropdown Menu with All Actions

```tsx
import { usePostInteractions } from "@/hooks/use-post-interactions";

function PostMenu({ post }: { post: Post }) {
  const { saved, hidden, handleSave, handleHide, handleUnhide } = usePostInteractions({
    postId: post.id,
    initialSaved: post.is_saved,
    initialHidden: post.is_hidden,
  });

  return (
    <DropdownMenu>
      <DropdownMenuItem onClick={handleSave}>{saved ? "Unsave" : "Save"}</DropdownMenuItem>
      <DropdownMenuItem onClick={hidden ? handleUnhide : handleHide}>
        {hidden ? "Unhide" : "Hide"}
      </DropdownMenuItem>
    </DropdownMenu>
  );
}
```

### Profile Page - Saved Posts

```tsx
function SavedPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);

  return (
    <div>
      {posts.map((post) => (
        <SavedPostCard
          key={post.id}
          post={post}
          onUnsave={(id) => {
            // Remove from list when unsaved
            setPosts((prev) => prev.filter((p) => p.id !== id));
          }}
        />
      ))}
    </div>
  );
}

function SavedPostCard({ post, onUnsave }: Props) {
  const { saved, handleSave } = usePostInteractions({
    postId: post.id,
    initialSaved: true, // Always true in saved posts page
  });

  const handleUnsaveClick = async () => {
    await handleSave();
    if (!saved) {
      onUnsave(post.id); // Remove from parent list
    }
  };

  return (
    <div>
      <h3>{post.title}</h3>
      <button onClick={handleUnsaveClick}>Unsave</button>
    </div>
  );
}
```

### Hidden Posts Management

```tsx
function HiddenPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);

  return (
    <div>
      <h1>Hidden Posts</h1>
      {posts.map((post) => (
        <HiddenPostCard
          key={post.id}
          post={post}
          onUnhide={(id) => {
            setPosts((prev) => prev.filter((p) => p.id !== id));
          }}
        />
      ))}
    </div>
  );
}

function HiddenPostCard({ post, onUnhide }: Props) {
  const { hidden, handleUnhide } = usePostInteractions({
    postId: post.id,
    initialHidden: true,
  });

  const handleUnhideClick = async () => {
    await handleUnhide();
    if (!hidden) {
      onUnhide(post.id);
    }
  };

  return (
    <div>
      <h3>{post.title}</h3>
      <button onClick={handleUnhideClick}>Unhide</button>
    </div>
  );
}
```

## API Endpoints

This hook calls the following endpoints:

| Action | Method   | Endpoint              | Response |
| ------ | -------- | --------------------- | -------- |
| Save   | `POST`   | `/api/saved/:postId`  | `200 OK` |
| Unsave | `DELETE` | `/api/saved/:postId`  | `200 OK` |
| Hide   | `POST`   | `/api/hidden/:postId` | `200 OK` |
| Unhide | `DELETE` | `/api/hidden/:postId` | `200 OK` |

All endpoints return `401` if user is not authenticated.

## Error Handling

| Error                | Behavior                                      |
| -------------------- | --------------------------------------------- |
| **401 Unauthorized** | Opens login modal (via `useLoginModal`)       |
| **Network error**    | Shows toast "Failed to save post" (save only) |
| **Other errors**     | Silent failure (hide/unhide)                  |

## Common Pitfalls

### ❌ Not Handling Hidden State in UI

```tsx
// Bad: Post still visible when hidden
function PostCard({ post }: { post: Post }) {
  const { handleHide } = usePostInteractions({ postId: post.id });

  return (
    <div>
      <h3>{post.title}</h3>
      <button onClick={handleHide}>Hide</button>
    </div>
  );
}

// Good: Conditional rendering
function PostCard({ post }: { post: Post }) {
  const { hidden, handleHide } = usePostInteractions({ postId: post.id });

  if (hidden) return <div>Hidden</div>;

  return (
    <div>
      <h3>{post.title}</h3>
      <button onClick={handleHide}>Hide</button>
    </div>
  );
}
```

### ❌ Not Removing from List After Unsave

```tsx
// Bad: Post stays in saved list after unsaving
function SavedPosts() {
  const [posts, setPosts] = useState<Post[]>([]);

  return posts.map((post) => (
    <PostCard post={post} /> // Stays visible after unsave
  ));
}

// Good: Remove from list
function SavedPosts() {
  const [posts, setPosts] = useState<Post[]>([]);

  const handleUnsave = (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  return posts.map((post) => <PostCard post={post} onUnsave={handleUnsave} />);
}
```

## Related

- [useVote](./use-vote.md) - Vote on posts/comments
- [LoginModalContext](../contexts/LOGIN_MODAL_CONTEXT.md) - Auto login prompt
- [API Routes](../dev-guidelines/README.md) - Saved/hidden endpoints

## Implementation Details

Located at: `src/hooks/use-post-interactions.ts:1`

Key dependencies:

- `@/contexts/LoginModalContext` - Login prompt on 401
- `react-hot-toast` - Success/error notifications
