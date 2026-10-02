-- Excel's Gallery: post views + "love" reactions
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New
-- query), after 0001, 0002 and 0003. It is safe to run more than once.
--
-- Additive only: no existing table, column, policy or row is touched.
--
-- How it works
--   * Visitors have no accounts, so the browser keeps a random visitor_id
--     (a uuid in localStorage). It is only used to stop one browser from
--     loving the same post twice and from inflating the view count by
--     refreshing.
--   * The two tables below are NOT readable or writable by the public
--     directly. All public access goes through the three functions at the
--     bottom, which only ever do the one narrow thing they are named for.

-- ============================================================================
-- 1. gallery_post_views: one row each time a post is opened
-- ============================================================================

create table if not exists public.gallery_post_views (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.gallery_projects(id) on delete cascade,
  visitor_id uuid not null,
  viewed_at  timestamptz not null default now()
);

comment on table public.gallery_post_views is
  'One row per post open. The same visitor re-opening the same post within 30 minutes is not counted again (see record_post_view).';

create index if not exists gallery_post_views_project_idx
  on public.gallery_post_views (project_id);
create index if not exists gallery_post_views_dedupe_idx
  on public.gallery_post_views (project_id, visitor_id, viewed_at desc);

-- ============================================================================
-- 2. gallery_post_reactions: one row per visitor per reaction per post
-- ============================================================================

create table if not exists public.gallery_post_reactions (
  project_id uuid not null references public.gallery_projects(id) on delete cascade,
  visitor_id uuid not null,
  reaction   text not null default 'love',
  created_at timestamptz not null default now(),

  -- One love per visitor per post, enforced by the database itself.
  primary key (project_id, visitor_id, reaction),

  -- Only "love" for now. To add more reactions later, widen this list.
  constraint gallery_post_reactions_reaction_check
    check (reaction in ('love'))
);

comment on table public.gallery_post_reactions is
  'Reactions (currently only "love") left on posts by anonymous visitors.';

create index if not exists gallery_post_reactions_project_idx
  on public.gallery_post_reactions (project_id, reaction);

-- ============================================================================
-- 3. Row Level Security
-- ============================================================================
-- RLS is on and there is deliberately NO policy for anon, so visitors cannot
-- read, insert, update or delete these tables directly. They can only use the
-- functions in section 4. The signed-in admin may read both tables.

alter table public.gallery_post_views enable row level security;
alter table public.gallery_post_reactions enable row level security;

drop policy if exists "gallery_post_views_admin_read" on public.gallery_post_views;
create policy "gallery_post_views_admin_read"
  on public.gallery_post_views
  for select
  to authenticated
  using (true);

drop policy if exists "gallery_post_reactions_admin_read" on public.gallery_post_reactions;
create policy "gallery_post_reactions_admin_read"
  on public.gallery_post_reactions
  for select
  to authenticated
  using (true);

-- ============================================================================
-- 4. Functions the website calls
-- ============================================================================
-- security definer = they run with the table owner's rights, so they can write
-- to the locked-down tables above. search_path is pinned for safety.

-- 4a. Record that a post was opened.
create or replace function public.record_post_view(
  p_project_id uuid,
  p_visitor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_project_id is null or p_visitor_id is null then
    return;
  end if;

  -- Ignore ids that are not a real post.
  if not exists (select 1 from public.gallery_projects where id = p_project_id) then
    return;
  end if;

  -- Same visitor, same post, within 30 minutes = same visit. Change the
  -- interval below if you want a different window.
  if exists (
    select 1
    from public.gallery_post_views
    where project_id = p_project_id
      and visitor_id = p_visitor_id
      and viewed_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  insert into public.gallery_post_views (project_id, visitor_id)
  values (p_project_id, p_visitor_id);
end;
$$;

-- 4b. Love or un-love a post.
create or replace function public.set_post_love(
  p_project_id uuid,
  p_visitor_id uuid,
  p_loved boolean
)
returns table (love_count bigint, loved boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_project_id is not null
     and p_visitor_id is not null
     and exists (select 1 from public.gallery_projects where id = p_project_id) then

    if p_loved then
      insert into public.gallery_post_reactions (project_id, visitor_id, reaction)
      values (p_project_id, p_visitor_id, 'love')
      on conflict do nothing;
    else
      delete from public.gallery_post_reactions
      where project_id = p_project_id
        and visitor_id = p_visitor_id
        and reaction = 'love';
    end if;
  end if;

  return query
    select
      (select count(*) from public.gallery_post_reactions r
        where r.project_id = p_project_id and r.reaction = 'love'),
      exists (select 1 from public.gallery_post_reactions r
        where r.project_id = p_project_id
          and r.visitor_id = p_visitor_id
          and r.reaction = 'love');
end;
$$;

-- 4c. Read a post's totals (and whether this visitor has loved it).
create or replace function public.get_post_stats(
  p_project_id uuid,
  p_visitor_id uuid default null
)
returns table (view_count bigint, love_count bigint, loved boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.gallery_post_views v
      where v.project_id = p_project_id),
    (select count(*) from public.gallery_post_reactions r
      where r.project_id = p_project_id and r.reaction = 'love'),
    coalesce(
      (select true from public.gallery_post_reactions r
        where r.project_id = p_project_id
          and r.visitor_id = p_visitor_id
          and r.reaction = 'love'),
      false
    );
$$;

-- Only the website (anon / signed-in) may call these.
revoke all on function public.record_post_view(uuid, uuid) from public;
revoke all on function public.set_post_love(uuid, uuid, boolean) from public;
revoke all on function public.get_post_stats(uuid, uuid) from public;

grant execute on function public.record_post_view(uuid, uuid) to anon, authenticated;
grant execute on function public.set_post_love(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.get_post_stats(uuid, uuid) to anon, authenticated;

-- ============================================================================
-- Handy admin queries (run in the SQL Editor whenever you like)
-- ============================================================================
--   -- Views and loves per post, busiest first:
--   select p.title,
--          (select count(*) from public.gallery_post_views v where v.project_id = p.id) as views,
--          (select count(*) from public.gallery_post_reactions r where r.project_id = p.id) as loves
--   from public.gallery_projects p
--   order by views desc;

-- ============================================================================
-- Rollback (only if you ever need to undo this migration)
-- ============================================================================
--   drop function if exists public.record_post_view(uuid, uuid);
--   drop function if exists public.set_post_love(uuid, uuid, boolean);
--   drop function if exists public.get_post_stats(uuid, uuid);
--   drop table if exists public.gallery_post_views;
--   drop table if exists public.gallery_post_reactions;
