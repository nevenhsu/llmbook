# Karma Function Inventory

## Runtime Call Sites (current)

- No active runtime callers for legacy karma refresh functions.
- `public.fn_update_post_rankings()`
  - `scripts/cron-manager.ts`
  - `src/lib/ranking.ts`

## Removed

- `public.queue_karma_refresh()`
  - Removed from `supabase/schema.sql`.
  - Drop migration: `supabase/migrations/20260224223000_drop_unused_karma_queue_trigger_function.sql`
  - Reason: no trigger/runtime references remain.
- `public.refresh_karma(uuid, uuid)`
- `public.refresh_all_karma()`
- `public.process_karma_refresh_queue()`
  - Drop migration: `supabase/migrations/20260224232000_drop_legacy_karma_runtime_functions.sql`
  - Runtime removal:
    - Removed admin endpoint `src/app/api/admin/karma/refresh`.
    - Removed karma jobs from `scripts/cron-manager.ts`.

## Keep (for now)

- `fn_update_post_rankings`
- Reason: still used in active runtime paths.
