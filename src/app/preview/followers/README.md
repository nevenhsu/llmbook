# Followers & Following Preview Pages

Preview pages for testing the followers and following list UI components.

## Pages

### 1. Followers Preview

**URL:** `/preview/followers`

Displays a list of users who follow the target user.

**Features:**

- Shows follower list with avatars
- Follow/unfollow button for each user
- Empty state when no followers
- Karma display
- Follow timestamp
- Responsive design

**API Endpoint:**

```
GET /api/users/[userId]/followers
```

Query Parameters:

- `cursor` (optional): ISO timestamp for pagination
- `limit` (optional): Number of items per page (default: 20, max: 50)
- `search` (optional): Search query for filtering by username or display name

---

### 2. Following Preview

**URL:** `/preview/following`

Displays a list of users that the target user follows.

**Features:**

- Shows following list with avatars
- Follow/unfollow button for each user
- Empty state when not following anyone
- Karma display
- Follow timestamp
- Responsive design

**API Endpoint:**

```
GET /api/users/[userId]/following
```

Query Parameters:

- `cursor` (optional): ISO timestamp for pagination
- `limit` (optional): Number of items per page (default: 20, max: 50)
- `search` (optional): Search query for filtering by username or display name

---

## Components Used

### `UserListItem`

Located at: `/src/components/user/UserListItem.tsx`

**Props:**

```typescript
interface UserListItemProps {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  karma: number;
  isFollowing?: boolean;
  showFollowButton?: boolean;
  currentUserId?: string | null;
}
```

---

## Mock Data

Mock data is defined in `/src/app/preview/followers/mock-data.ts`:

- `MOCK_FOLLOWERS`: Array of 6 mock followers
- `MOCK_FOLLOWING`: Array of 4 mock users being followed
- `getMockFollowers()`: Pagination helper for followers
- `getMockFollowing()`: Pagination helper for following

---

## Testing

### Preview Controls

Both pages include preview controls:

- **Show Empty State**: Toggle between populated and empty state
- **Reset**: Reset to initial mock data

### Interactive Elements

- **Follow/Unfollow buttons**: Click to toggle follow state (mock only)
- **User avatars/names**: Click to simulate navigation to profile
- **Pagination**: Load more items (simulated with mock data)

---

## Database Schema

The followers/following system uses the `follows` table:

```sql
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT follows_no_self_follow CHECK (follower_id != following_id),
  CONSTRAINT follows_unique UNIQUE (follower_id, following_id)
);
```

**Key differences:**

- **Followers**: `following_id = target_user_id` (people who follow the target)
- **Following**: `follower_id = target_user_id` (people the target follows)

---

## Related Files

- `/src/app/api/users/[userId]/followers/route.ts` - Followers API endpoint
- `/src/app/api/users/[userId]/following/route.ts` - Following API endpoint
- `/src/app/api/users/[userId]/follow/route.ts` - Follow/unfollow action endpoint
- `/src/components/user/UserListItem.tsx` - User list item component
- `/src/components/profile/FollowButton.tsx` - Follow button component
- `/supabase/schema.sql` - Database schema with follow counts

---

## Next Steps

To integrate into actual user profile pages:

1. **Create profile page routes:**
   - `/u/[username]/followers`
   - `/u/[username]/following`

2. **Fetch real data:**

   ```typescript
   const res = await fetch(`/api/users/${userId}/followers?limit=20`);
   const data = await res.json();
   ```

3. **Implement pagination:**

   ```typescript
   const nextPage = await fetch(`/api/users/${userId}/followers?cursor=${nextCursor}&limit=20`);
   ```

4. **Add real follow/unfollow actions:**
   ```typescript
   await fetch(`/api/users/${targetUserId}/follow`, {
     method: isFollowing ? "DELETE" : "POST",
   });
   ```
