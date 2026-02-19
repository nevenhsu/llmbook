# useVote Hook

## Overview

The `useVote` hook manages voting on posts and comments with **optimistic updates**, **automatic login prompts**, and **race condition protection**.

## Features

- ✅ **Optimistic updates**: UI updates instantly before server response
- ✅ **Automatic rollback**: Reverts on error
- ✅ **Login prompt**: Opens login modal on 401 errors
- ✅ **Race condition protection**: Ignores stale responses
- ✅ **Disabled state**: Prevents voting on archived/deleted content
- ✅ **Score reconciliation**: Updates with server-confirmed score

## Usage

```tsx
import { useVote } from "@/hooks/use-vote";
import { votePost, voteComment } from "@/lib/api/votes";

function PostVoteButtons({ post }: { post: Post }) {
  const { score, userVote, handleVote, voteDisabled } = useVote({
    id: post.id,
    initialScore: post.score,
    initialUserVote: post.user_vote,
    voteFn: votePost,
    disabled: post.status === "ARCHIVED" || post.status === "DELETED",
    onScoreChange: (id, score, userVote) => {
      // Optional: update parent state after server confirms
      console.log(`Post ${id} score: ${score}, user vote: ${userVote}`);
    },
  });

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleVote(1)}
        disabled={voteDisabled}
        className={userVote === 1 ? "text-orange-500" : "text-gray-500"}
      >
        ▲ Upvote
      </button>
      <span className="font-semibold">{score}</span>
      <button
        onClick={() => handleVote(-1)}
        disabled={voteDisabled}
        className={userVote === -1 ? "text-blue-500" : "text-gray-500"}
      >
        ▼ Downvote
      </button>
    </div>
  );
}
```

## API

### Parameters

```typescript
interface UseVoteOptions {
  id: string;                      // Post or comment ID
  initialScore: number;            // Initial score from server
  initialUserVote: 1 | -1 | null;  // User's current vote
  voteFn: VoteFn;                  // API function (votePost or voteComment)
  disabled?: boolean;              // Disable voting (e.g., archived posts)
  onScoreChange?: (                // Callback after server confirms
    id: string,
    score: number,
    userVote: 1 | -1 | null
  ) => void;
}

type VoteFn = (id: string, value: 1 | -1) => Promise<VoteResponse>;
```

### Return Value

```typescript
interface UseVoteReturn {
  score: number;              // Current score (optimistic)
  userVote: 1 | -1 | null;    // User's vote (optimistic)
  isVoting: boolean;          // Loading state
  handleVote: (value: 1 | -1) => Promise<void>; // Vote handler
  voteDisabled: boolean;      // Combined: isVoting || disabled
}
```

## Vote Functions

Use the provided API functions from `@/lib/api/votes`:

```tsx
import { votePost, voteComment } from "@/lib/api/votes";

// For posts
voteFn: votePost

// For comments
voteFn: voteComment
```

## Behavior Details

### Optimistic Updates

When user clicks vote:
1. **Immediate UI update**: Score and userVote update instantly
2. **API call**: Request sent to server in background
3. **Server reconciliation**: Score updated with server value on success
4. **Rollback on error**: Reverts to previous state if API fails

### Vote Toggle Logic

| Current Vote | New Vote | Result |
|--------------|----------|--------|
| `null` (no vote) | `1` (upvote) | Upvoted, score +1 |
| `null` | `-1` (downvote) | Downvoted, score -1 |
| `1` (upvoted) | `1` (upvote again) | Removed vote, score -1 |
| `-1` (downvoted) | `-1` (downvote again) | Removed vote, score +1 |
| `1` (upvoted) | `-1` (downvote) | Changed to downvote, score -2 |
| `-1` (downvoted) | `1` (upvote) | Changed to upvote, score +2 |

This logic is handled by `applyVote` from `@/lib/optimistic/vote`.

### Race Condition Protection

The hook uses a sequence counter to ignore stale responses:

```tsx
// User clicks upvote twice rapidly:
// 1. First click: seq=1, sends request A
// 2. Second click: seq=2, sends request B
// 3. Response B arrives first → applied (seq=2 matches)
// 4. Response A arrives later → ignored (seq=1 < current)
```

### Error Handling

| Error | Behavior |
|-------|----------|
| **401 Unauthorized** | Opens login modal (via `useLoginModal`) |
| **Network error** | Shows toast: "Failed to vote", rollback |
| **Other errors** | Shows toast: "Failed to vote", rollback |

### Disabled State

When `disabled={true}` or `isVoting={true}`:
- Vote buttons should be disabled
- Click handlers return early
- No API calls made

## Examples

### Post Voting

```tsx
import { useVote } from "@/hooks/use-vote";
import { votePost } from "@/lib/api/votes";
import type { Post } from "@/types/database";

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
      <button onClick={() => handleVote(1)} disabled={voteDisabled}>
        {userVote === 1 ? "❤️" : "🤍"} {score}
      </button>
    </div>
  );
}
```

### Comment Voting

```tsx
import { useVote } from "@/hooks/use-vote";
import { voteComment } from "@/lib/api/votes";
import type { Comment } from "@/types/database";

function CommentVoteButtons({ comment }: { comment: Comment }) {
  const { score, userVote, handleVote, voteDisabled } = useVote({
    id: comment.id,
    initialScore: comment.score,
    initialUserVote: comment.user_vote,
    voteFn: voteComment,
    disabled: comment.status === "DELETED",
  });

  return (
    <div className="flex gap-2">
      <button onClick={() => handleVote(1)} disabled={voteDisabled}>
        ▲
      </button>
      <span>{score}</span>
      <button onClick={() => handleVote(-1)} disabled={voteDisabled}>
        ▼
      </button>
    </div>
  );
}
```

### With Parent State Sync

```tsx
function PostList() {
  const [posts, setPosts] = useState<Post[]>([]);

  const handleScoreChange = (id: string, score: number, userVote: 1 | -1 | null) => {
    // Update post in parent list after server confirms
    setPosts(prev =>
      prev.map(p =>
        p.id === id ? { ...p, score, user_vote: userVote } : p
      )
    );
  };

  return (
    <div>
      {posts.map(post => (
        <PostCard
          key={post.id}
          post={post}
          onScoreChange={handleScoreChange}
        />
      ))}
    </div>
  );
}

function PostCard({ post, onScoreChange }: Props) {
  const { score, userVote, handleVote } = useVote({
    id: post.id,
    initialScore: post.score,
    initialUserVote: post.user_vote,
    voteFn: votePost,
    onScoreChange, // Pass parent callback
  });

  return <VoteButtons score={score} userVote={userVote} onVote={handleVote} />;
}
```

## Common Pitfalls

### ❌ Not Handling Disabled State

```tsx
// Bad: Can vote on archived posts
const { handleVote } = useVote({
  id: post.id,
  initialScore: post.score,
  initialUserVote: post.user_vote,
  voteFn: votePost,
  // Missing: disabled: post.status === "ARCHIVED"
});
```

### ❌ Not Using voteDisabled

```tsx
// Bad: Button stays enabled while voting
<button onClick={() => handleVote(1)}>
  Upvote
</button>

// Good: Button disabled during vote
<button onClick={() => handleVote(1)} disabled={voteDisabled}>
  Upvote
</button>
```

### ❌ Stale Initial Values

```tsx
// Bad: Using stale post object
const { score } = useVote({
  id: post.id,
  initialScore: post.score, // Stale if post changes
  initialUserVote: post.user_vote,
  voteFn: votePost,
});

// Good: Hook handles this with useEffect
// Initial values are synced when post changes (unless actively voting)
```

## Related

- [usePostInteractions](./use-post-interactions.md) - Save/hide posts
- [LoginModalContext](../contexts/LOGIN_MODAL_CONTEXT.md) - Auto login prompt
- [Vote API](../lib/README.md#vote-api) - API functions
- [Optimistic Updates](../lib/README.md#optimistic-updates) - `applyVote` logic

## Implementation Details

Located at: `src/hooks/use-vote.ts:1`

Key dependencies:
- `@/lib/optimistic/vote` - Vote calculation logic
- `@/lib/api/votes` - API functions (votePost, voteComment)
- `@/contexts/LoginModalContext` - Login prompt on 401
- `react-hot-toast` - Error notifications
