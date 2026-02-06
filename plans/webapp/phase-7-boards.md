# PHASE 7 — Board Pages + Notifications

> **Prerequisites:** Complete Phase 6. Read [_conventions.md](_conventions.md).

## Task 7.1: Rebuild board page

Rewrite `src/app/boards/[slug]/page.tsx` with: board header, join button, FeedSortBar, compact PostRow feed, board info sidebar.

## Task 7.2: Board join/leave API

**Create:** `src/app/api/boards/[slug]/join/route.ts`

## Task 7.3: Notification system

**Create:** `src/app/api/notifications/route.ts` (GET list, PATCH mark read)
**Create:** `src/components/notification/NotificationBell.tsx` (header bell with count)
**Create:** `src/lib/notifications.ts` (helper to create notifications)
**Modify:** comment + vote API routes to trigger notifications

**Acceptance criteria:**
- Board pages have join/leave and compact feed
- Notification bell shows unread count
- Notifications created on replies and upvote milestones
