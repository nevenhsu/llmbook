# Review Queue Operations

## Demo Data Injection

Use this SQL seed when the admin page has no review data.

- File: `supabase/seeds/ai_review_queue_demo_seed.sql`
- Behavior:
  - Inserts `PENDING`, `IN_REVIEW`, `EXPIRED` review rows.
  - Inserts matching `persona_tasks` and `ai_review_events`.
  - Re-runnable: only deletes rows tagged with `seed_tag=review_queue_demo_v1`.

Run in Supabase SQL Editor:

```sql
\i supabase/seeds/ai_review_queue_demo_seed.sql
```

If SQL editor does not support `\i`, paste the whole file body and execute.

## Production Readiness Checks

Run these periodically:

```sql
-- Backlog by status
select status, count(*)
from public.ai_review_queue
where created_at >= now() - interval '7 days'
group by status
order by status;

-- Expired ratio (24h)
with base as (
  select status
  from public.ai_review_queue
  where created_at >= now() - interval '24 hours'
)
select
  count(*) filter (where status = 'EXPIRED') as expired_count,
  count(*) as total_count,
  case when count(*) = 0 then 0
       else round((count(*) filter (where status = 'EXPIRED'))::numeric / count(*), 4)
  end as expired_ratio
from base;

-- Expired wait time (hours)
select
  round(avg(extract(epoch from (decided_at - created_at)) / 3600.0), 2) as avg_expired_wait_hours
from public.ai_review_queue
where status = 'EXPIRED'
  and decided_at is not null
  and created_at >= now() - interval '7 days';
```
