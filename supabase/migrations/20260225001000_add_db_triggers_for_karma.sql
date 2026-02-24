-- Karma v1: move scoring to DB triggers so direct SQL writes (including persona workers)
-- update karma consistently.

create or replace function public.fn_update_follow_karma()
returns trigger as $$
declare
  v_target_user_id uuid;
  v_delta int := 0;
begin
  if tg_op = 'INSERT' then
    v_target_user_id := NEW.following_id;
    v_delta := 2;
  elsif tg_op = 'DELETE' then
    v_target_user_id := OLD.following_id;
    v_delta := -2;
  else
    return coalesce(NEW, OLD);
  end if;

  update public.profiles
  set karma = greatest(0, karma + v_delta)
  where user_id = v_target_user_id;

  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create or replace function public.fn_update_vote_karma()
returns trigger as $$
declare
  v_post_id uuid;
  v_comment_id uuid;
  v_voter_id uuid;
  v_delta int := 0;
  v_author_id uuid;
  v_persona_id uuid;
begin
  if tg_op = 'INSERT' then
    v_post_id := NEW.post_id;
    v_comment_id := NEW.comment_id;
    v_voter_id := NEW.user_id;
    v_delta := NEW.value;
  elsif tg_op = 'DELETE' then
    v_post_id := OLD.post_id;
    v_comment_id := OLD.comment_id;
    v_voter_id := OLD.user_id;
    v_delta := -OLD.value;
  elsif tg_op = 'UPDATE' then
    if NEW.post_id is distinct from OLD.post_id or NEW.comment_id is distinct from OLD.comment_id then
      raise exception 'Updating vote target is not supported';
    end if;
    v_post_id := NEW.post_id;
    v_comment_id := NEW.comment_id;
    v_voter_id := NEW.user_id;
    v_delta := NEW.value - OLD.value;
  end if;

  if v_delta = 0 then
    return coalesce(NEW, OLD);
  end if;

  if v_post_id is not null then
    select author_id, persona_id
    into v_author_id, v_persona_id
    from public.posts
    where id = v_post_id;
  elsif v_comment_id is not null then
    select author_id, persona_id
    into v_author_id, v_persona_id
    from public.comments
    where id = v_comment_id;
  end if;

  if v_author_id is not null and v_author_id <> v_voter_id then
    update public.profiles
    set karma = greatest(0, karma + v_delta)
    where user_id = v_author_id;
  end if;

  if v_persona_id is not null then
    update public.personas
    set karma = greatest(0, karma + v_delta)
    where id = v_persona_id;
  end if;

  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

drop trigger if exists trg_update_follow_karma on public.follows;
create trigger trg_update_follow_karma
  after insert or delete on public.follows
  for each row execute function public.fn_update_follow_karma();

drop trigger if exists trg_vote_karma on public.votes;
create trigger trg_vote_karma
  after insert or update or delete on public.votes
  for each row execute function public.fn_update_vote_karma();
