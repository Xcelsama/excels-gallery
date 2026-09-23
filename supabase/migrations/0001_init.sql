-- Excel's Gallery: initial schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query),
-- or via `supabase db push` if you use the Supabase CLI.

-- ============================================================================
-- 1. gallery_projects: one row per before/after editing project
-- ============================================================================

create table if not exists public.gallery_projects (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  caption          text,
  note             text,
  tags             text[] not null default '{}',
  before_image_url text not null,
  after_image_url  text not null,
  published_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.gallery_projects is
  'One published before/after Lightroom editing project.';

-- Keep updated_at honest without relying on application code to set it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gallery_projects_set_updated_at on public.gallery_projects;
create trigger gallery_projects_set_updated_at
  before update on public.gallery_projects
  for each row
  execute function public.set_updated_at();

-- Gallery + detail pages read by published date; tag filtering benefits
-- from a GIN index once there are more than a handful of posts.
create index if not exists gallery_projects_published_at_idx
  on public.gallery_projects (published_at desc);
create index if not exists gallery_projects_tags_idx
  on public.gallery_projects using gin (tags);

alter table public.gallery_projects enable row level security;

-- Public visitors may only ever read. Note there is no anon INSERT/UPDATE/
-- DELETE policy at all below, with RLS enabled, the *absence* of a policy
-- is itself the denial, so this is enforced at the database layer, not just
-- hidden in the UI.
create policy "gallery_projects_public_read"
  on public.gallery_projects
  for select
  to anon, authenticated
  using (true);

-- Only a signed-in Supabase Auth user (i.e. you, the admin, there is no
-- public sign-up flow in this app) can write. Because the only account
-- created is yours, "authenticated" and "admin" mean the same thing here.
create policy "gallery_projects_admin_insert"
  on public.gallery_projects
  for insert
  to authenticated
  with check (true);

create policy "gallery_projects_admin_update"
  on public.gallery_projects
  for update
  to authenticated
  using (true)
  with check (true);

create policy "gallery_projects_admin_delete"
  on public.gallery_projects
  for delete
  to authenticated
  using (true);

-- ============================================================================
-- 2. messages: "Message Excel" contact form submissions
-- ============================================================================

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  message    text not null,
  created_at timestamptz not null default now()
);

comment on table public.messages is
  'Contact form submissions from the public Message Excel page.';

create index if not exists messages_created_at_idx
  on public.messages (created_at desc);

alter table public.messages enable row level security;

-- Anyone can send a message (that's the point of the form)...
create policy "messages_public_insert"
  on public.messages
  for insert
  to anon, authenticated
  with check (
    char_length(name) between 1 and 200
    and char_length(email) between 3 and 320
    and char_length(message) between 1 and 4000
  );

-- ...but only you can read or clear them. There is deliberately no public
-- select policy, so submitted messages are write-only for visitors.
create policy "messages_admin_read"
  on public.messages
  for select
  to authenticated
  using (true);

create policy "messages_admin_delete"
  on public.messages
  for delete
  to authenticated
  using (true);

-- ============================================================================
-- 3. Storage: a public "gallery" bucket for before/after images
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

-- Public read of the images themselves (this is what lets <Image> and
-- next/image load them directly from Supabase's CDN with no signing).
create policy "gallery_bucket_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'gallery');

create policy "gallery_bucket_admin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'gallery');

create policy "gallery_bucket_admin_update"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'gallery')
  with check (bucket_id = 'gallery');

create policy "gallery_bucket_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'gallery');

-- ============================================================================
-- Notes
-- ============================================================================
-- * No service-role key is required anywhere in this app. Every write goes
--   through a signed-in user's own session, so it's checked against the
--   policies above by Postgres itself, not just trusted from the client.
-- * To create your one admin account: Supabase Dashboard → Authentication →
--   Users → Add user. There is no public sign-up route in this app, so that
--   dashboard screen (or the Admin API) is the only way an account gets made.
