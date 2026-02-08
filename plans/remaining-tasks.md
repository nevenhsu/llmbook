# Remaining Tasks & Session Handoff

> Last updated: 2026-02-08
> 
> Scope: Webapp board forum (Phase 9 / M6 related)

---

## Completed Tasks (已完成)

### 1) Moderator Management

- ✅ Board Settings can add moderators (with user search)
- ✅ Can remove moderators (owner cannot be removed)
- ✅ Can edit moderator permissions
- ✅ APIs complete:
  - `GET/POST /api/boards/[slug]/moderators`
  - `DELETE/PATCH /api/boards/[slug]/moderators/[userId]`

### 2) Member & Ban Management

- ✅ Moved to dedicated page: `/boards/[slug]/member`
- ✅ Member list viewable (public)
- ✅ Ban list viewable (public)
- ✅ Kick/Ban/Unban only for authorized users
- ✅ Permission rules:
  - Only owner or manager with `manage_users = true` can edit ban list / kick
  - Unauthorized users can view but buttons are disabled

### 3) Board Page UI Navigation

- ✅ Desktop sidebar added independent `Board Management` card (separate from Community Rules)
- ✅ `Board Management` card positioned after Join block, before Community Rules
- ✅ Mobile board header dropdown for quick access to Members/Settings
- ✅ Compact article list adjusted with vertical `padding` (avoids hover background conflict)

### 4) File Upload for Board Icon/Banner

- ✅ `src/lib/image-upload.ts` - Shared image processing logic
- ✅ `src/lib/image-upload.test.ts` - Complete tests (18 unit tests + 2 integration tests)
- ✅ `src/components/ui/ImageUpload.tsx` - Reusable upload component
- ✅ `src/components/board/CreateBoardForm.tsx` - Integrated upload
- ✅ `src/components/board/BoardSettingsForm.tsx` - Integrated upload
- ✅ `src/app/api/media/upload/route.ts` - Updated to support custom maxWidth/quality
- ✅ Features:
  - Drag & drop upload support
  - Real-time preview
  - Auto compression to webp (sharp)
  - Max width 2048px
  - 5MB file limit
  - Manual URL input as fallback
- ✅ Tests:
  - Unit tests: validateImageFile, formatBytes, getAspectRatioClass, createImagePreview, uploadImage mock
  - Integration tests: Actual upload to Supabase (requires `RUN_INTEGRATION=1`)
  - Auto cleanup: afterAll deletes storage files and database records

### 5) Environment Configuration Refactoring

- ✅ `src/lib/env.ts` (NEW) - Unified environment variable management
  - Auto loads .env.local > .env (priority order)
  - Distinguishes publicEnv (NEXT_PUBLIC_*) and privateEnv (server-only)
  - Provides validation functions: validatePublicEnv, validatePrivateEnv, validateTestEnv
  - Constants: isIntegrationTest, nodeEnv, isProduction, isDevelopment
- ✅ Updated test files to use new env imports:
  - `src/lib/image-upload.test.ts`
  - `src/lib/supabase/__tests__/media-upload.integration.test.ts`
- ✅ Benefits:
  - All files just need `import { publicEnv, privateEnv } from '@/lib/env'`
  - No need to repeat `dotenv.config()` in each file
  - Type-safe, unified error handling
  - Clear distinction between browser-safe and server-only variables

### 6) Project Documentation

- ✅ `AGENTS.md` (NEW) - Agent development guide with shared library references
- ✅ Added QMD search rules with collection specification

---

## Important Behavior Notes

1. `/boards/[slug]/member`
   - Everyone can enter to view
   - Only owner/manager can execute actions (kick/ban/unban)

2. `/boards/[slug]/settings`
   - Only moderator/owner can enter (regular users cannot)

3. Board Management card
   - `Members & Bans` displayed to everyone
   - `Board Settings` only displayed to those who can manage (avoids misleading unauthorized users)

---

## Next Session Suggested Start

### High Priority

**Board Statistics Dashboard**
- Create dashboard page: `/boards/[slug]/stats` or integrate into existing pages
- Requirements:
  - Post/member trend charts (last 7/30/90 days)
  - Top contributors list
  - Activity metrics (posts per day, comments, votes)
  - Member growth chart
- Technical approach:
  - Create new API routes: `/api/boards/[slug]/stats`
  - Use chart library (recharts or chart.js)
  - Aggregate data from posts, votes, comments tables
- Reference existing code pattern from `src/lib/ranking.ts` for data aggregation

### Medium Priority

**Poll Enhancement**
- Auto-close polls when they expire
- Countdown display for active polls
- Need to add cron job or scheduled function to check expired polls

**Unarchive Flow**
- Currently only has archive, no unarchive
- Add unarchive button for archived boards
- API endpoint: `POST /api/boards/[slug]/unarchive`

---

## Key Files Reference

### Shared Libraries (Use these!)
- `src/lib/env.ts` - Environment variables ⭐
- `src/lib/image-upload.ts` - Image upload logic ⭐
- `src/lib/board-permissions.ts` - Board permission checks
- `src/lib/supabase/client.ts` - Browser client
- `src/lib/supabase/server.ts` - Server client
- `src/lib/supabase/admin.ts` - Admin client

### Components
- `src/components/ui/ImageUpload.tsx` - Reusable image upload

### Documentation
- `AGENTS.md` - Read before each session

---

## Validation Commands

```bash
# Run tests
npm test

# Build
npm run build

# Run integration tests
RUN_INTEGRATION=1 npm test
```

---

## Current Status

- ✅ `npm run build` passed
- ✅ `npm test` passed (25 passed, 5 skipped)
- ⚠️ daisyUI `@property` warning (non-blocking)
