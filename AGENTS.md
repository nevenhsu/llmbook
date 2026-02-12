# Agent Development Guide

> Read this document before each development session to ensure correct usage of shared libraries

---

## Quick Reference

| Need                      | Import                                                                |
| ------------------------- | --------------------------------------------------------------------- |
| Environment variables     | `import { publicEnv, privateEnv } from '@/lib/env'`                   |
| Image upload              | `import { uploadImage, validateImageFile } from '@/lib/image-upload'` |
| Supabase Client (browser) | `import { createClient } from '@/lib/supabase/client'`                |
| Supabase Server           | `import { createClient } from '@/lib/supabase/server'`                |
| Supabase Admin            | `import { createAdminClient } from '@/lib/supabase/admin'`            |
| Board permissions         | `import { canManageBoard } from '@/lib/board-permissions'`            |
| User context (Client)     | `import { useUserContext } from '@/contexts/UserContext'`             |
| Board context (Client)    | `import { useBoardContext } from '@/contexts/BoardContext'`           |

---

## Shared Libraries

### 1. Environment Configuration (`src/lib/env.ts`)

**Purpose:** Unified environment variable management to avoid duplicate dotenv configuration

**Important Rules:**

- **NEVER** repeat `import dotenv from 'dotenv'; dotenv.config()` in every file

**Example:**

```typescript
import { publicEnv, privateEnv, isIntegrationTest } from "@/lib/env";

// Public env (browser-safe)
const supabaseUrl = publicEnv.supabaseUrl;
const supabaseKey = publicEnv.supabaseAnonKey;

// Private env (server-only)
const serviceRoleKey = privateEnv.supabaseServiceRoleKey;
const bucket = privateEnv.storageBucket;

// Validate environment variables (for tests)
import { validateTestEnv } from "@/lib/env";
beforeAll(() => validateTestEnv());
```

**Public vs Private:**

- `publicEnv`: Variables starting with NEXT*PUBLIC*\*, safe for browser use
- `privateEnv`: All other variables, server-side only

---

### 2. Image Upload (`src/lib/image-upload.ts`)

**Purpose:** Shared logic for image upload, compression, and validation

**When to use:**

- Uploading images to Supabase Storage
- Validating image files (size, type)
- Generating image previews

**Example:**

```typescript
import {
  uploadImage,
  validateImageFile,
  formatBytes,
} from "@/lib/image-upload";

// Upload image
const result = await uploadImage(file, {
  maxWidth: 2048,
  maxBytes: 5 * 1024 * 1024,
  quality: 82,
});
// result: { url, width, height, sizeBytes }

// Validate only
const error = validateImageFile(file, 5 * 1024 * 1024);
if (error) {
  console.error(error.message); // "File size exceeds 5 MB limit"
}
```

**Related Component:** `src/components/ui/ImageUpload.tsx` (reusable UI)

---

### 3. Supabase Clients

**Purpose:** Unified Supabase client configuration

#### Browser Client (`src/lib/supabase/client.ts`)

```typescript
import { createClient } from "@/lib/supabase/client";
// For React components (client-side)
```

#### Server Client (`src/lib/supabase/server.ts`)

```typescript
import { createClient } from "@/lib/supabase/server";
// For API routes, Server Components
const supabase = await createClient(cookies());
```

#### Admin Client (`src/lib/supabase/admin.ts`)

```typescript
import { createAdminClient } from "@/lib/supabase/admin";
// For operations requiring service role key
// ⚠️ Server-side only, NEVER expose to browser
const admin = createAdminClient();
```

---

### 4. Board Permissions (`src/lib/board-permissions.ts`)

**Purpose:** Board permission checking logic

**When to use:**

- Check if user can manage a board
- Check moderator permissions

**Example:**

```typescript
import { canManageBoard, canModerateBoard } from "@/lib/board-permissions";

const canManage = await canManageBoard(supabase, boardId, userId);
const canModerate = await canModerateBoard(supabase, boardId, userId);
```

---

## Pre-Development Checklist

- [ ] Need environment variables? → Use `import { publicEnv, privateEnv } from '@/lib/env'`
- [ ] Need image upload? → Use `import { uploadImage } from '@/lib/image-upload'`
- [ ] Need Supabase? → Choose correct client (client/server/admin)
- [ ] Need permission checks? → Check if `src/lib/` has existing logic

---

## File Structure

```
src/lib/
├── env.ts                    # Environment variables ⭐ Priority
├── image-upload.ts           # Image upload logic ⭐ Priority
├── image-upload.test.ts      # Test examples
├── board-permissions.ts      # Board permissions
├── ranking.ts               # Ranking algorithm
├── notifications.ts         # Notifications logic
└── supabase/
    ├── client.ts            # Browser client
    ├── server.ts            # Server client
    ├── admin.ts             # Admin client (service role)
    ├── middleware.ts        # Middleware config
    └── types.ts             # DB types
```

---

## Agent Tool Usage Rules

### QMD Document Search

**Important:** When using QMD search, always specify `collection: "llmbook"`

**Examples:**

```typescript
// Keyword search (BM25)
await qmd_search({
  query: "board permissions",
  collection: "llmbook",
});

// Semantic search (vector similarity)
await qmd_vsearch({
  query: "how to check user permissions",
  collection: "llmbook",
});

// Hybrid search (most accurate)
await qmd_query({
  query: "upload image to supabase",
  collection: "llmbook",
});
```

**Collection Info:**

- Collection name: `llmbook`
- Path: `/Users/neven/Documents/projects/llmbook`
- Documents: 33 files

**When to use:**

- Search technical documents (plans/, docs/, README.md)
- Query project conventions and standards
- Find code examples

---

## Additional Documentation

- [Library Details](./docs/lib/README.md) - Detailed API documentation for each library
- [Testing Guide](./docs/testing/README.md) - How to write tests
