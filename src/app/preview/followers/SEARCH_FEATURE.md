# Search Feature for Followers/Following Lists

## ✅ Implementation Complete

Both followers and following lists now support **real-time search functionality**.

---

## 🔍 Search Features

### User Experience

- **Real-time filtering** - Results update as you type
- **Debounced search** - 300ms delay to reduce API calls
- **Case-insensitive** - Matches regardless of case
- **Clear button** - Easy to reset search
- **Search scope** - Searches both username and display name

### UI Components

```tsx
// Search bar with icon and clear button
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={20} />
  <input
    type="text"
    placeholder="Search followers..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="input input-bordered w-full pl-10 pr-10"
  />
  {searchQuery && (
    <button onClick={() => setSearchQuery("")}>
      <X size={18} />
    </button>
  )}
</div>
```

---

## 📡 API Changes

### Endpoints Updated

#### GET `/api/users/[userId]/followers`

```typescript
// Query Parameters
{
  cursor?: string;    // Pagination cursor (ISO timestamp)
  limit?: number;     // Items per page (default: 20, max: 50)
  search?: string;    // NEW: Search query
}
```

#### GET `/api/users/[userId]/following`

```typescript
// Query Parameters
{
  cursor?: string;    // Pagination cursor (ISO timestamp)
  limit?: number;     // Items per page (default: 20, max: 50)
  search?: string;    // NEW: Search query
}
```

### Search Implementation

**Backend (API Route):**

```typescript
// 1. Extract search parameter
const search = searchParams.get("search")?.trim();

// 2. Filter users after fetching from database
if (search) {
  const searchLower = search.toLowerCase();
  users = users.filter(
    (user) =>
      user.username.toLowerCase().includes(searchLower) ||
      user.displayName.toLowerCase().includes(searchLower),
  );
}
```

**Frontend (React Component):**

```typescript
// 1. State management
const [searchQuery, setSearchQuery] = useState("");
const [debouncedSearch, setDebouncedSearch] = useState("");

// 2. Debounce search input
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(searchQuery);
  }, 300);
  return () => clearTimeout(timer);
}, [searchQuery]);

// 3. Reset list when search changes
useEffect(() => {
  if (userId) {
    setFollowers([]);
    setNextCursor(undefined);
    setHasMore(true);
  }
}, [debouncedSearch, userId]);

// 4. Include search in API call
const params = new URLSearchParams();
if (debouncedSearch) params.set("search", debouncedSearch);
```

---

## 🎯 Search Behavior

### What Gets Searched

- ✅ **Username** (e.g., `alice_wonderland`)
- ✅ **Display Name** (e.g., `Alice Wonderland`)

### Search Matching

- **Partial match** - `"ali"` matches `"alice_wonderland"`
- **Case-insensitive** - `"ALICE"` matches `"alice"`
- **Substring search** - `"wonder"` matches `"alice_wonderland"`

### Examples

| Search Query | Matches                                | Doesn't Match      |
| ------------ | -------------------------------------- | ------------------ |
| `"alice"`    | `alice_wonderland`, `Alice Wonderland` | `bob_builder`      |
| `"wonder"`   | `alice_wonderland`, `Alice Wonderland` | `charlie_chaplin`  |
| `"ai_"`      | `ai_sophia`, `ai_einstein`             | `alice_wonderland` |

---

## 🔄 Integration with Infinite Scroll

Search works seamlessly with infinite scroll:

1. **User types search query** → List resets
2. **Initial search results loaded** → First 20 matching items
3. **User scrolls to bottom** → Loads next 20 matching items
4. **Search filter persists** → All pages use same search query

```typescript
// Load more respects search filter
const loadMore = useCallback(async () => {
  const params = new URLSearchParams();
  if (nextCursor) params.set("cursor", nextCursor);
  if (debouncedSearch) params.set("search", debouncedSearch); // ← Search included
  params.set("limit", "20");

  const res = await fetch(`/api/users/${userId}/followers?${params}`);
  // ...
}, [userId, nextCursor, debouncedSearch]);
```

---

## 📊 Performance Considerations

### Current Implementation

- **In-memory filtering** - Fetch all, filter in JavaScript
- **Simple and fast** for small to medium lists (< 1000 items)
- **No database changes required**

### Future Optimization (if needed)

If the follower/following lists grow very large:

1. **Database-level search:**

   ```sql
   -- Use Postgres ILIKE for case-insensitive search
   SELECT * FROM profiles
   WHERE username ILIKE '%search%'
      OR display_name ILIKE '%search%';
   ```

2. **Full-text search:**

   ```sql
   -- Add tsvector column for better performance
   ALTER TABLE profiles
   ADD COLUMN search_vector tsvector
   GENERATED ALWAYS AS (
     to_tsvector('simple', username || ' ' || display_name)
   ) STORED;

   CREATE INDEX idx_profiles_search ON profiles USING gin(search_vector);
   ```

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Type in search box → List filters immediately
- [ ] Clear search → Full list returns
- [ ] Search with no results → Shows empty state
- [ ] Search + scroll → Loads more filtered results
- [ ] Fast typing → Debounced (not spamming API)
- [ ] Case variations → All work the same

### Example Test Queries

```typescript
// Test usernames
"alice"; // Should find alice_wonderland
"ai_"; // Should find AI personas
"@"; // Should find nothing (@ not in usernames)

// Test display names
"Bob"; // Should find Bob the Builder
"wonder"; // Should find Alice Wonderland
"123"; // Should find nothing (no numbers in display names)
```

---

## 📁 Files Modified

### API Routes

- `/src/app/api/users/[userId]/followers/route.ts` - Added search parameter
- `/src/app/api/users/[userId]/following/route.ts` - Added search parameter

### Pages

- `/src/app/u/[username]/followers/page.tsx` - Added search UI and logic
- `/src/app/u/[username]/following/page.tsx` - Added search UI and logic

### Documentation

- `/src/app/preview/followers/README.md` - Updated API documentation
- `/src/app/preview/followers/SEARCH_FEATURE.md` - This file

---

## 🚀 Usage Examples

### Basic Search

```typescript
// Search for users with "alice" in username or display name
GET /api/users/123/followers?search=alice

// Response
{
  "items": [
    {
      "userId": "...",
      "username": "alice_wonderland",
      "displayName": "Alice Wonderland",
      ...
    }
  ],
  "hasMore": false
}
```

### Search + Pagination

```typescript
// First page of search results
GET /api/users/123/followers?search=alice&limit=20

// Next page with same search
GET /api/users/123/followers?search=alice&cursor=2024-02-19T10:30:00Z&limit=20
```

### Clear Search

```typescript
// Remove search parameter to get all results
GET /api/users/123/followers?limit=20
```

---

## 💡 Future Enhancements

Potential improvements for search functionality:

1. **Search History** - Save recent searches
2. **Search Suggestions** - Autocomplete as user types
3. **Advanced Filters**
   - Filter by karma range
   - Filter by follow date
   - Sort by relevance
4. **Highlighted Matches** - Show matched text in results
5. **Search Analytics** - Track popular searches

---

## ✨ Summary

**Search is now fully functional on both followers and following pages!**

- ✅ Real-time filtering with debounce
- ✅ Case-insensitive partial matching
- ✅ Works with infinite scroll
- ✅ Clean and intuitive UI
- ✅ No database changes required

Users can now easily find specific people in their followers/following lists! 🎉
